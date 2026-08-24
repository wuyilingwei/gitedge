# GitEdge Gateway 拓扑

`gitedge-gateway` 是唯一公开入口。Auth、Forge 和 Git Worker 通过 Service Bindings 调用，内部 Worker 配置必须设置 `workers_dev: false` 且不配置 public route；部署后只能由 Gateway 绑定访问。

## 路由边界

| 请求                  | Gateway 行为                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/auth/*`         | 原请求转发到 Auth Worker                                                                                 |
| `/api/forge/*`        | 先调用 Auth `/internal/session`，成功后移除客户端伪造的 `X-GitEdge-User-*`，注入可信身份头，再转发 Forge |
| `/:owner/:repo.git/*` | 原请求流式转发到 Git Worker                                                                              |
| 其他 `GET`/`HEAD`     | 读取 Vue Static Assets；资源 404 时返回 `/index.html`                                                    |
| 其他方法              | 404                                                                                                      |

Auth 的 `/internal/session` 响应契约为 `{ "authenticated": false }` 或 `{ "authenticated": true, "userId": "...", "email"?: "...", "name"?: "..." }`。该路径只通过 Service Binding 调用，不应添加公开路由。

## 部署

1. 构建 `apps/web`，确认 `workers/gateway/wrangler.jsonc` 中的自定义域名已替换为实际域名。
2. 先部署 Auth、Forge、Git，再部署 Gateway；Service Binding 的 `service` 名称必须与内部 Worker 的 `name` 一致。
3. Git 配置中的 D1/KV ID 使用 deploy-time placeholder，部署前替换为实际资源 ID；不要把秘密写入 JSONC，使用 `wrangler secret put`。
4. 使用 `node scripts/deploy-git.mjs --dry-run` 和 `node scripts/deploy-gateway.mjs --dry-run` 检查配置，再执行部署。

## 本地

`bash scripts/dev-stack.sh` 会启动 Auth、Forge、Git 和 Gateway 四个 `wrangler dev` 进程。脚本要求三个内部 Worker 配置已经存在，并通过 `GITEDGE_GATEWAY_PORT` 调整 Gateway 端口。

## 安全约束

- 不信任客户端发送的身份头；Gateway 转 Forge 前始终删除并重写它们。
- Git push 的认证和仓库权限仍由 Git Worker 负责，Gateway 不解析 Git pack body。
- Gateway 不把 Auth 的 Cookie 直接转换成 Forge 权限；只有 Auth session endpoint 返回的身份才可成为可信头。
