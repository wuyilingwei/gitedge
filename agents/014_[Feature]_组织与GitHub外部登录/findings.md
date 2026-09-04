# 调研记录

- [任务范围] 用户要求 Vue UI、GitHub 基础功能与语义、组织、外部登录及 GitHub OAuth 两档权限 -> 以当前多 Worker 架构实现可验证的最小端到端能力，不扩张为 GitHub 全功能复制。
- [架构基线] 当前 `PRODUCT.md` 与源码已经采用 Vue 3 + Gateway/Auth/Forge/Git 多 Worker，而根目录旧说明存在 React SSR 路径滞后 -> 以后续源码、`PRODUCT.md` 和实际配置为准。
- [数据迁移] 用户明确不保留向后兼容 -> 新 schema 直接表达目标模型，不增加双写、兼容字段或运行时 fallback。
- [GitHub OAuth] 官方 Web flow 使用 authorization code，建议 state 与 PKCE；认证关联必须使用 `/user` 的稳定 numeric `id`，不能使用可变的 login 或 email。空 scope 仅公开身份；`repo` 是完整仓库权限而不是只读权限，因此 read 档只请求 `read:user user:email read:org`。
- [一次性状态] D1 的 `DELETE ... RETURNING` 以 state hash 和过期时间作为单条原子条件，成功后才允许交换 code，因此重放和过期 state 都无法继续使用。
- [Gateway 回调] Auth Service 看到的是内部 `/github/*` 路径，但 OAuth redirect URI 必须回到 Gateway 暴露的同源 `/api/auth/github/callback`，否则 callback 不会重新进入 Auth 路由。
- [外部身份摘要] OAuth token 只用于当前 API 验证；将经过验证的 login、profile、邮箱和组织快照存入外部身份行，并对 session 中可能损坏的历史 JSON 采取忽略而非抛错的处理。
