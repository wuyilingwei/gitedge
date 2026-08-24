# GitEdge Gateway 拓扑

`gitedge-gateway` 是唯一公开入口。Auth、Forge 和 Git Worker 通过 Service Bindings 调用，内部 Worker 配置必须设置 `workers_dev: false` 且不配置 public route；部署后只能由 Gateway 绑定访问。

## 路由边界

| 请求                  | Gateway 行为                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `/api/auth/*`         | 去掉 `/api/auth` 前缀后转发到 Auth Worker                                                         |
| `/api/forge/*`        | 先调用 Auth `/session`，成功后移除客户端伪造的可信头和 Cookie，注入 ID/Name，再去掉前缀转发 Forge |
| `/:owner/:repo.git/*` | 原请求流式转发到 Git Worker                                                                       |
| 其他 `GET`/`HEAD`     | 读取 Vue Static Assets；资源 404 时返回 `/index.html`                                             |
| 其他方法              | 404                                                                                               |

Auth 的 `/session` 成功响应契约为 `{ "data": { "id": "...", "identifier": "..." } }`，未登录返回 401。该路径只通过 Service Binding 调用，不应添加公开路由。

## 部署

1. 构建 `apps/web`，确认 `workers/gateway/wrangler.jsonc` 中的自定义域名已替换为实际域名。
2. 先部署 Auth、Forge、Git，再部署 Gateway；Service Binding 的 `service` 名称必须与内部 Worker 的 `name` 一致。
3. Auth、Forge、Git 绑定同一个 D1；Git 另绑定 KV、R2、Queue 和 Durable Object。部署前必须替换配置中的资源 ID；不要把秘密写入 JSONC。
4. 使用 `npm run deploy:dry-run` 检查四个 Worker，再执行 `npm run deploy`。

## 本地

`bash scripts/dev-stack.sh` 会启动 Auth、Forge、Git 和 Gateway 四个 `wrangler dev` 进程，Gateway 默认监听 `8877`。脚本要求三个内部 Worker 配置已经存在，并可通过 `GITEDGE_GATEWAY_PORT` 调整 Gateway 端口。

## 安全约束

- 不信任客户端发送的身份头；Gateway 转 Forge 前始终删除并重写它们。
- Git Worker 的部署入口只注册 Smart HTTP 路由；旧 SSR、管理和 OIDC 路由不会暴露。Git push 的认证和仓库权限仍由 Git Worker 负责，Gateway 不解析 Git pack body。
- Gateway 不把 Auth 的 Cookie 直接转换成 Forge 权限；只有 Auth session endpoint 返回的身份才可成为可信头。
