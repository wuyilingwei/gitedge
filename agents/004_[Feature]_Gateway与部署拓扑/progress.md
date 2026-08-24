# 004 Progress

- 读取 repo AGENTS.md、agent-mode、Cloudflare、Wrangler、Workers best-practices 技能与任务文件。
- 新增 `workers/gateway/src/index.ts`：Auth/Forge/Git 路由、安全身份头重写、Static Assets SPA fallback。
- 新增 `workers/gateway/wrangler.jsonc`：公开 Gateway、Vue assets、Auth/Forge/Git Service Bindings。
- 新增 `workers/git/src/index.ts` 与 `workers/git/wrangler.jsonc`：复用 `src/worker/index.ts`，保留 DO/R2/KV/D1/Queue 配置并关闭 workers.dev。
- 新增 `test/gateway/routing.test.ts`，覆盖 Auth 直通、未登录拦截、身份头防伪、Git 路由和 SPA fallback。
- 新增 `scripts/deploy-gateway.mjs`、`scripts/deploy-git.mjs`、`scripts/dev-stack.sh` 与 `docs/gateway-topology.md`。
- 验证：`npm ci --ignore-scripts` 完成（仅生成被忽略的 `node_modules`）；Gateway 测试 5/5 通过；Gateway/Gateway 测试目标的独立 TypeScript 检查通过；Git `wrangler deploy --dry-run` 成功并列出 DO/KV/D1/R2/Queue 绑定；Gateway dry-run 仍等待 UI agent 生成 `apps/web/dist`。
- 补充修复：发现全局 ignore 规则误忽略两个 `wrangler.jsonc` 与 `test/gateway/routing.test.ts`；已确认它们不含 node_modules、dist 或 secret，使用精确 `git add -f` 纳入补充提交。
