# 012_[Feature]_严格请求限流

- [x] 梳理 Gateway 路由、认证响应与 Wrangler DO 配置边界
- [x] 实现 SQLite-backed Durable Object、SHA-256 分片与滚动窗口 RPC
- [x] 将限流接入动态 API 与 Git Smart HTTP，并保留匿名 Forge GET
- [x] 增加 Gateway 定向测试，执行测试、类型检查与部署 dry-run
- [x] 检查变更范围并提交
- [x] 将限流 authority 拆为独立内部 Worker，让 Gateway 会话与 Git PAT 共用同一用户组计数
