# 006 Findings

- `[范围]` -> 生产配置仅涉及 `workers/auth/wrangler.jsonc`、`workers/forge/wrangler.jsonc`、`workers/git/wrangler.jsonc`、`workers/gateway/wrangler.jsonc` 与 `scripts/deploy-stack.mjs`；不创建或修改 Cloudflare 资源。
- `[资源 ID]` -> 共享 D1 与 ROUTES KV 仍是 `REPLACE_WITH_*` 占位符，不能猜测或替换；部署脚本必须在迁移或部署前停止。
- `[安全]` -> 部署失败输出应隐藏潜在 secret/token 内容，只显示命令名、配置路径与安全错误摘要。
