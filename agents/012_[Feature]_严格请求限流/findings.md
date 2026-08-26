# Findings

- Gateway 当前通过 Service Bindings 转发 Auth、Forge、Git；静态资源走 ASSETS。
- Gateway 原先所有 Forge 路由都强制认证；本任务要求匿名 GET Forge 继续转发，而未认证写请求保持 401。
- Cloudflare Rate Limiting binding 不适用于严格滚动窗口；采用 SQLite Durable Object RPC，并按 SHA-256 摘要首字节分片。
- Auth session 兼容 `{id,identifier,groupKey}`；缺失 groupKey 时按 `free` 处理，避免旧 session 响应破坏路由。
- 默认组配额：free/team/admin 分别为 120/600/1200 RPM，并共享仓库数、push、单仓库与总存储字段；JSON 可覆盖任意正整数。
- 完整 `npm test` 未能完成：仓库现有 UI 测试导入 `vue-i18n`，当前根依赖未安装 apps/web 依赖；非 UI 的 19 个文件、74 项测试通过。
