import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const workerConfigs = [
  "workers/auth/wrangler.jsonc",
  "workers/forge/wrangler.jsonc",
  "workers/git/wrangler.jsonc",
  "workers/gateway/wrangler.jsonc",
];

const unresolvedIdPattern = /REPLACE_WITH_[A-Z0-9_]+/;

export function findUnresolvedResourceIds(configPaths = workerConfigs) {
  const findings = [];

  for (const configPath of configPaths) {
    const lines = readFileSync(configPath, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (unresolvedIdPattern.test(line)) findings.push({ configPath, line: index + 1 });
    });
  }

  return findings;
}

function assertProductionResourceIds() {
  const findings = findUnresolvedResourceIds();
  if (findings.length === 0) return true;

  console.error("Production deployment stopped: replace the configured D1/KV resource IDs first.");
  for (const finding of findings) {
    console.error(`- ${finding.configPath}:${finding.line}: unresolved resource ID`);
  }
  return false;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    console.error(`Command failed to start: ${command}`);
    process.exitCode = 1;
    return false;
  }
  if (result.status !== 0) {
    console.error(`Command failed with status ${result.status ?? "unknown"}: ${command}`);
    process.exitCode = result.status ?? 1;
    return false;
  }
  return true;
}

export function deployStack({ dryRun = false } = {}) {
  if (!assertProductionResourceIds()) return false;
  if (!run("npm", ["--prefix", "apps/web", "run", "build"])) return false;

  if (!dryRun) {
    if (
      !run("npx", [
        "wrangler",
        "d1",
        "migrations",
        "apply",
        "gitedge",
        "--remote",
        "--config",
        "workers/auth/wrangler.jsonc",
      ])
    ) {
      return false;
    }
  }

  for (const service of ["auth", "forge", "git", "gateway"]) {
    const args = ["wrangler", "deploy", "--config", `workers/${service}/wrangler.jsonc`];
    if (dryRun) args.push("--dry-run");
    if (!run("npx", args)) return false;
  }

  return true;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  if (!deployStack({ dryRun: process.argv.includes("--dry-run") })) {
    process.exitCode ??= 2;
  }
}
