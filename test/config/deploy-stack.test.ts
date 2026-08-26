import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { findUnresolvedResourceIds, workerConfigs } from "../../scripts/deploy-stack.mjs";

describe("production deployment preflight", () => {
  it("finds every unresolved D1/KV placeholder without returning its value", () => {
    const findings = findUnresolvedResourceIds();

    expect(findings).toHaveLength(5);
    expect(findings.map(({ configPath }) => configPath)).toEqual(
      expect.arrayContaining(workerConfigs.slice(0, 3))
    );
    expect(JSON.stringify(findings)).not.toContain("REPLACE_WITH_");
  });

  it("stops before build or Wrangler when resource IDs are unresolved", () => {
    const result = spawnSync(process.execPath, ["scripts/deploy-stack.mjs", "--dry-run"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain("REPLACE_WITH_");
    expect(result.stderr).not.toContain("REPLACE_WITH_");
    expect(result.stderr).toContain("Production deployment stopped");
  });
});
