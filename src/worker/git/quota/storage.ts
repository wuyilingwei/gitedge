import type { SubrequestLimiter } from "@/worker/git/operations/limits";

import { doPrefix } from "@/worker/keys";

export type RepositoryStorageQuota = {
  ownerUserId: string;
  groupKey: string;
  maxPushBytes: number;
  maxRepositoryBytes: number;
  maxStorageBytes: number;
};

export type StorageUsage = {
  repositoryBytes: number;
  ownerBytes: number;
};

type RepositoryOwnerRow = {
  owner_user_id: string;
  group_key: string;
};

type RepositoryStorageRow = {
  do_name: string;
};

export async function loadRepositoryQuotaOwner(
  env: Env,
  repositoryId: string
): Promise<{ ownerUserId: string; groupKey: string } | null> {
  const row = await env.DB.prepare(
    "SELECT repositories.created_by AS owner_user_id, users.group_key FROM repositories JOIN users ON users.id = repositories.created_by WHERE repositories.id = ?"
  )
    .bind(repositoryId)
    .first<RepositoryOwnerRow>();
  return row ? { ownerUserId: row.owner_user_id, groupKey: row.group_key } : null;
}

async function listPrefixBytes(args: {
  env: Env;
  prefix: string;
  limiter: SubrequestLimiter;
  countSubrequest(op: string, n?: number): void;
}): Promise<number> {
  let cursor: string | undefined;
  let bytes = 0;
  do {
    args.countSubrequest("r2:list-storage");
    const page = await args.limiter.run("r2:list-storage", async () =>
      args.env.REPO_BUCKET.list({ prefix: args.prefix, cursor, limit: 1_000 })
    );
    for (const object of page.objects) bytes += object.size;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return bytes;
}

export async function measureStorageUsage(args: {
  env: Env;
  ownerUserId: string;
  repositoryDoName: string;
  limiter: SubrequestLimiter;
  countSubrequest(op: string, n?: number): void;
}): Promise<StorageUsage> {
  args.countSubrequest("d1:list-owner-repositories");
  const rows = await args.env.DB.prepare(
    "SELECT do_name FROM repositories WHERE created_by = ? ORDER BY id"
  )
    .bind(args.ownerUserId)
    .all<RepositoryStorageRow>();

  let repositoryBytes = 0;
  let ownerBytes = 0;
  for (const row of rows.results) {
    const durableObjectId = args.env.REPO_DO.idFromName(row.do_name).toString();
    const bytes = await listPrefixBytes({
      env: args.env,
      prefix: `${doPrefix(durableObjectId)}/`,
      limiter: args.limiter,
      countSubrequest: args.countSubrequest,
    });
    ownerBytes += bytes;
    if (row.do_name === args.repositoryDoName) repositoryBytes = bytes;
  }

  return { repositoryBytes, ownerBytes };
}

export class GitStorageQuotaError extends Error {
  readonly reason: "repository-storage-limit" | "owner-storage-limit";

  constructor(reason: GitStorageQuotaError["reason"], message: string) {
    super(message);
    this.name = "GitStorageQuotaError";
    this.reason = reason;
  }
}

export function assertStorageQuota(usage: StorageUsage, quota: RepositoryStorageQuota): void {
  if (usage.repositoryBytes > quota.maxRepositoryBytes) {
    throw new GitStorageQuotaError(
      "repository-storage-limit",
      `Repository storage exceeds the ${quota.maxRepositoryBytes}-byte limit for group ${quota.groupKey}.`
    );
  }
  if (usage.ownerBytes > quota.maxStorageBytes) {
    throw new GitStorageQuotaError(
      "owner-storage-limit",
      `Account storage exceeds the ${quota.maxStorageBytes}-byte limit for group ${quota.groupKey}.`
    );
  }
}
