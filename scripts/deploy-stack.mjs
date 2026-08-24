import { spawnSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["--prefix", "apps/web", "run", "build"]);

if (!dryRun) {
  run("npx", [
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "gitedge",
    "--remote",
    "--config",
    "workers/auth/wrangler.jsonc",
  ]);
}

for (const service of ["auth", "forge", "git", "gateway"]) {
  const args = ["wrangler", "deploy", "--config", `workers/${service}/wrangler.jsonc`];
  if (dryRun) args.push("--dry-run");
  run("npx", args);
}
