# 调研记录

- [任务范围] 用户要求 Vue UI、GitHub 基础功能与语义、组织、外部登录及 GitHub OAuth 两档权限 -> 以当前多 Worker 架构实现可验证的最小端到端能力，不扩张为 GitHub 全功能复制。
- [架构基线] 当前 `PRODUCT.md` 与源码已经采用 Vue 3 + Gateway/Auth/Forge/Git 多 Worker，而根目录旧说明存在 React SSR 路径滞后 -> 以后续源码、`PRODUCT.md` 和实际配置为准。
- [数据迁移] 用户明确不保留向后兼容 -> 新 schema 直接表达目标模型，不增加双写、兼容字段或运行时 fallback。
- [GitHub OAuth 权限] 官方 OAuth App 空 scope 可读取公开身份；`read:user`、`user:email`、`read:org` 分别覆盖用户资料、私有邮箱和组织成员信息 -> 两档定义为 `identity`（空 scope）与 `read`（三项只读 scope），不请求 `repo`，因为经典 OAuth 的仓库 scope 无法限制为只读。
- [OAuth 安全] GitHub 官方 Web Application Flow 推荐 `state`、PKCE 与每次拿到 token 后重新调用 `/user` 验证身份；granted scopes 可被用户缩减 -> callback 必须一次性消费事务、验证稳定 provider id，并按实际 granted scopes 降级/拒绝缺失能力，token 不落盘。
- [Workers 基线] 2026-09-03 Cloudflare 最新最佳实践要求当前 compatibility date、`nodejs_compat`、Wrangler 生成 binding 类型、secret 不入 config/source、请求级状态不放模块可变全局、Promise 必须收敛 -> 集成审查按这些边界执行。
- [组织模型] -> [复用 namespaces 与 namespace_memberships] -> `0004_organizations.sql` 将 namespace 表达为 personal 或 organization，加入展示字段；membership 表达 owner 或 member。个人 namespace 的 owner 角色由 D1 trigger 在注册写入 membership 时维护。
- [写入边界] -> [组织与首位 owner 需共同成功] -> Forge 以单次 D1 batch 写入 namespace 和 membership；成员删除通过带 owner 数量条件的单条 DELETE RETURNING，不能移除最后一名 owner。
- [仓库创建] -> [旧契约隐式查找个人 namespace] -> 契约强制 owner slug，Forge 对个人 namespace 核验创建者，对组织核验 membership owner；不保留旧 fallback。
- [组织成员读取] -> [owner-only guard 会阻止普通成员打开组织页面] -> 成员列表单独核验 membership；仅添加与移除成员继续要求 owner，组织响应返回当前用户 role 供客户端决定管理入口。
- [前端契约] 现有 API client 统一解包 `{data}` envelope；组织与 GitHub 外部身份字段直接以严格接口表达，仓库创建请求显式携带 `owner`。
- [验证] 初次测试因离线依赖未安装无法启动；执行离线 npm install 后，8 个 UI/API 测试和生产构建均通过。
- [权限显示] 组织详情根据服务返回的 `organization.role` 控制成员添加表单；普通成员保留成员列表只读视图，提交错误不覆盖页面加载状态。
- [GitHub OAuth] 官方 Web flow 使用 authorization code，建议 state 与 PKCE；认证关联必须使用 `/user` 的稳定 numeric `id`，不能使用可变的 login 或 email。空 scope 仅公开身份；`repo` 是完整仓库权限而不是只读权限，因此 read 档只请求 `read:user user:email read:org`。
- [一次性状态] D1 的 `DELETE ... RETURNING` 以 state hash 和过期时间作为单条原子条件，成功后才允许交换 code，因此重放和过期 state 都无法继续使用。
- [Gateway 回调] Auth Service 看到的是内部 `/github/*` 路径，但 OAuth redirect URI 必须回到 Gateway 暴露的同源 `/api/auth/github/callback`，否则 callback 不会重新进入 Auth 路由。
- [外部身份摘要] OAuth token 只用于当前 API 验证；将经过验证的 login、profile、邮箱和组织快照存入外部身份行，并对 session 中可能损坏的历史 JSON 采取忽略而非抛错的处理。
