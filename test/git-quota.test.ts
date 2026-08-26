import { describe, expect, it } from "vitest";

import { parseUserGroupLimits } from "../packages/contracts/src/index";
import {
  assertStorageQuota,
  GitStorageQuotaError,
  measureStorageUsage,
} from "@/worker/git/quota/storage";
import { assertPackSizeLimit, PackSizeLimitError } from "@/worker/git/receive/r2Upload";

describe("Git group quotas", () => {
  it("loads the production defaults and permits explicit environment overrides", () => {
    const defaults = parseUserGroupLimits(undefined);
    expect(defaults.free).toMatchObject({
      rpm: 120,
      maxRepositories: 10,
      maxPushBytes: 268_435_456,
      maxRepositoryBytes: 1_073_741_824,
      maxStorageBytes: 5_368_709_120,
    });

    const custom = parseUserGroupLimits('{"free":{"maxRepositories":3,"maxStorageBytes":99}}');
    expect(custom.free.maxRepositories).toBe(3);
    expect(custom.free.maxStorageBytes).toBe(99);
    expect(custom.free.rpm).toBe(120);
  });

  it("rejects oversized pushes, repositories, and account storage", () => {
    expect(() => assertPackSizeLimit(11, 10)).toThrow(PackSizeLimitError);
    expect(() => assertPackSizeLimit(10, 10)).not.toThrow();

    const quota = {
      ownerUserId: "owner-1",
      groupKey: "free",
      maxPushBytes: 10,
      maxRepositoryBytes: 100,
      maxStorageBytes: 200,
    };
    expect(() => assertStorageQuota({ repositoryBytes: 101, ownerBytes: 150 }, quota)).toThrowError(
      GitStorageQuotaError
    );
    expect(() => assertStorageQuota({ repositoryBytes: 90, ownerBytes: 201 }, quota)).toThrowError(
      GitStorageQuotaError
    );
    expect(() =>
      assertStorageQuota({ repositoryBytes: 100, ownerBytes: 200 }, quota)
    ).not.toThrow();
  });

  it("meters every R2 object under repositories owned by the account", async () => {
    const pages = new Map([
      [
        "do/id-repo-a/",
        [
          { key: "pack", size: 70 },
          { key: "idx", size: 30 },
        ],
      ],
      ["do/id-repo-b/", [{ key: "pack", size: 50 }]],
    ]);
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({
              results: [{ do_name: "repo-a" }, { do_name: "repo-b" }],
              meta: { changes: 0 },
            }),
          }),
        }),
      },
      REPO_DO: {
        idFromName: (name: string) => ({ toString: () => `id-${name}` }),
      },
      REPO_BUCKET: {
        list: async ({ prefix }: { prefix: string }) => ({
          objects: pages.get(prefix) ?? [],
          truncated: false,
        }),
      },
    } as unknown as Env;
    const usage = await measureStorageUsage({
      env,
      ownerUserId: "owner-1",
      repositoryDoName: "repo-a",
      limiter: { run: async (_op: string, task: () => Promise<unknown>) => task() } as never,
      countSubrequest: () => {},
    });
    expect(usage).toEqual({ repositoryBytes: 100, ownerBytes: 150 });
  });
});
