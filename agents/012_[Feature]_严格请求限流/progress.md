# Progress

- 2026-08-26：读取 agent-mode、Cloudflare、Durable Objects、Workers best practices、Wrangler 指南及项目指令。
- 2026-08-26：检查 Gateway、Wrangler 配置、既有 Gateway 测试与审计目录。
- 2026-08-26：新增 SQLite DO、SHA-256 32 分片、IP 与 Forge 用户组滚动窗口限流，更新 Gateway migration/vars，并生成 Gateway Worker 类型。
- 2026-08-26：Gateway 定向测试 6 项通过；Gateway typecheck 通过；Gateway dry-run 通过。完整 unit test 有既有 `vue-i18n` 缺失环境阻断（19 个文件/74 项通过）。
- 2026-08-26：最终审查发现 Git PAT 只经过 Gateway IP 限流，未消耗用户组 RPM；新增私有 Limits Worker 作为单一计数 authority，Gateway 与 Git 通过外部 DO binding 共享 32 个分片，并补充 Git PAT RPM 回归测试和部署顺序。
- 2026-08-26：首次增量发布时 Cloudflare 拒绝删除仍与外部 binding 同名的 Gateway 本地类；将共享类改为独立名称，并在 Limits Worker 中声明正式 rename migration 后继续发布。
- 2026-08-26：采用两阶段 Gateway 切换后完成生产部署；最终 Limits/Auth/Forge/Git/Gateway 版本分别为 `b4d1e7ef-c675-46c6-92ab-df916ba44135`、`1f622e58-d9b4-4354-917a-6a91c4ff70cc`、`ee8da910-c696-4ba0-b89e-5ef8f35c281c`、`3f5a71a5-d696-4ead-a917-23e62bcab3ef`、`c02c8216-11ea-40df-8529-bb57c92720a5`。线上首页与注册页为 200；无会话 401、开放注册的无效输入 400、匿名公开仓库缺失 404、匿名写入 401、Git 缺失仓库 404；D1 只读查询确认用户、仓库与会话均为空。
- 2026-08-26：最终根单元测试 22 文件/90 项与 Worker 测试 54 文件/323 项全部通过；Worker 测试进程退出码为 0，workerd 在 teardown 时另有一条非失败的 `Network connection lost` 通知。类型检查与五 Worker dry-run 均通过。
