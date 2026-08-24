# 004 Findings

- `[路由边界]` -> Gateway 仅将 `/api/auth/*`、鉴权后的 `/api/forge/*` 与 `/:owner/:repo.git/*` 交给 Service Binding -> 其余 GET/HEAD 交给 Static Assets 并在 404 时回退 `/index.html`，其他方法返回 404。
- `[可信身份]` -> 客户端可能伪造 `X-GitEdge-User-*` -> Gateway 转 Forge 前删除这些头，只接受 Auth `/internal/session` JSON 返回的身份 -> Forge 不依赖客户端 Cookie 或未经验证的身份头。
- `[Git Worker 边界]` -> 上游协议实现位于 `src/worker/index.ts` -> `workers/git/src/index.ts` 只做 re-export -> 保留现有 DO/R2/D1/Queue 与 Git 协议实现，不复制协议代码。
- `[Wrangler gateway dry-run]` -> `apps/web/dist` 尚未出现在本分支 -> Wrangler 在读取 assets.directory 时停止 -> 等 UI agent 合并 Vue 构建产物后重跑。
- `[Wrangler git dry-run]` -> 初次 wrapper 构建因 worktree 未安装 npm 依赖失败 -> `npm ci --ignore-scripts` 后 dry-run 成功，显示 DO/KV/D1/R2/Queue 绑定 -> 说明 Git Worker 配置和 wrapper 可被 Wrangler 打包。
- `[资源 ID]` -> Git Worker 配置需要 KV/D1 ID -> 使用明确的 `REPLACE_WITH_*` deploy-time placeholders，不写入秘密，也不伪造生产资源。
- `[服务契约对齐]` -> Auth 对外 Gateway 前缀为 `/api/auth`、内部路由为 `/session`，session 成功返回 `{data:{id,identifier}}`；Forge 内部路由不含 `/api/forge` -> Gateway 统一做前缀剥离，并仅向 Forge 注入 `X-GitEdge-User-Id`/`X-GitEdge-User-Name`，同时删除 Cookie 和客户端同名可信头。
