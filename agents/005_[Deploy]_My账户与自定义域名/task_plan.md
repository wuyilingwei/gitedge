# 005 My 账户与自定义域名部署计划

- [x] 核验 `My` Cloudflare account 与 `wuyilingwei.com` zone 的归属一致
- [x] 获取当前 Workers、Wrangler 与资源配置依据
- [x] 检查 D1、KV、R2、Queue、Worker 和自定义域名是否已有同名资源
- [x] 创建缺失的生产资源并记录实际资源 ID
- [x] 配置四 Worker 的 account、binding 与 Gateway 自定义域名
- [x] 运行 types、测试、构建、startup、dry-run 与提交关键词自检
- [x] 应用远端 D1 migration 并按内部服务优先顺序部署四 Worker
- [x] 验证内部 Worker 无公开入口且自定义域名只指向 Gateway
- [x] 在部署站点完成授权、仓库、Issue、PR、Wiki、i18n、退出与 Git discovery 验收
- [ ] 更新项目与审计记录，检查 main 保护并交付远端
- [ ] 停止部署期间的子 agent 监控
