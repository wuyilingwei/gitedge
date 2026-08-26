# Findings

- Gateway 当前通过 Service Bindings 转发 Auth、Forge、Git；静态资源走 ASSETS。
- Gateway 原先所有 Forge 路由都强制认证；本任务要求匿名 GET Forge 继续转发，而未认证写请求保持 401。
- Cloudflare Rate Limiting binding 不适用于严格滚动窗口；采用 SQLite Durable Object RPC，并按 SHA-256 摘要首字节分片。
- Auth session 必须返回 `{id,identifier,groupKey}`；Gateway 不接受缺失用户组的认证响应。
- 默认组配额：free/team/admin 分别为 120/600/1200 RPM，并共享仓库数、push、单仓库与总存储字段；JSON 可覆盖任意正整数。
- 集成分支安装完整依赖后，根单元测试 90 项、Worker 测试 322 项全部通过。
- Gateway 会话和 Git PAT 若分别持有 Durable Object，会形成两套独立计数；独立 Limits Worker 可以让二者使用相同 key 与相同滚动窗口，同时避免 Gateway 与 Git 的服务绑定环。
