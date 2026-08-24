import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["wrangler", "deploy", "--config", "workers/git/wrangler.jsonc", ...process.argv.slice(2)],
  {
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
