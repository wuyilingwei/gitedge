# 009 公共访问与分组配额计划

- [x] 获取当前 Cloudflare 限流、Durable Objects、Workers 与 R2 依据并审查现有写入路径
- [x] 定义公开注册开关、默认用户组和用户组限制的环境变量契约
- [x] 增加用户组 D1 migration，并让 Auth 会话返回可信用户组
- [x] 允许匿名读取公开仓库页面、Issue、PR、Wiki 与 Git；私有仓库继续隐藏
- [x] 在 Forge 强制仓库数配额，并向 Git 传递可信组配额
- [x] 在 Git receive-pack 强制单次写入、单仓库与用户总存储配额
- [x] 用按 IP 分片的 Durable Object 在 Gateway 强制动态请求严格 RPM
- [x] 补充根目录测试、类型生成、类型检查、构建、启动分析与部署 dry-run
- [x] 应用远端 migration，部署四 Worker 并完成生产匿名/注册/限流/配额验收
- [x] 更新审计，检查 main 保护，合并推送并停止进度监控
