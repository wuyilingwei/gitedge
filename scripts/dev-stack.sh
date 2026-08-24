#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
gateway_port="${GITEDGE_GATEWAY_PORT:-8877}"
persist_dir="$root_dir/.wrangler/state"

declare -a pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

for config in workers/auth/wrangler.jsonc workers/forge/wrangler.jsonc workers/git/wrangler.jsonc; do
  if [[ ! -f "$root_dir/$config" ]]; then
    echo "Missing $config; add the internal Worker config before starting the local stack." >&2
    exit 1
  fi
done

(cd "$root_dir" && npx wrangler dev --config workers/auth/wrangler.jsonc --persist-to "$persist_dir" --port 8788 --inspector-port 9231) & pids+=("$!")
(cd "$root_dir" && npx wrangler dev --config workers/forge/wrangler.jsonc --persist-to "$persist_dir" --port 8789 --inspector-port 9232) & pids+=("$!")
(cd "$root_dir" && npx wrangler dev --config workers/git/wrangler.jsonc --persist-to "$persist_dir" --port 8790 --inspector-port 9233) & pids+=("$!")
(cd "$root_dir" && npx wrangler dev --config workers/gateway/wrangler.jsonc --persist-to "$persist_dir" --port "$gateway_port" --inspector-port 9234) & pids+=("$!")

wait "${pids[3]}"
