# 005 Findings

- [此前 Cloudflare 发布因账户不明确而暂停] -> [用户指定 `My` 与 `gitedge.wuyilingwei.com`] -> [本轮只在 zone 所属的 `My` account 创建和部署资源]
- [自定义域名可能已绑定其他 Worker 或 DNS 记录] -> [先做账户、zone、现有资源和 route 只读核验] -> [确认无冲突后才创建资源与部署]
- [`My` 是否拥有目标 zone 未经当前验证] -> [使用当前 Wrangler OAuth 只读查询 zone] -> [`wuyilingwei.com` 为 active，account ID 与 `My` 完全一致]
- [目标 hostname 可能已有 DNS/route/domain] -> [公共 DNS、Workers routes 与 Workers domains 查询] -> [公共 DNS 无记录，目标 route/custom domain 均为空；OAuth 缺少 DNS record read，DNS API 返回 403，但不影响 Wrangler 创建 Custom Domain]
- [同名生产资源可能已存在] -> [列出 My 的 D1、KV、R2、Queue 与 Worker scripts] -> [未发现任何 `gitedge` 同名资源或 Worker]
- [`wrangler r2 bucket list --json` 与 `queues list --json`] -> [按其他列表命令假设 JSON flag] -> [Wrangler 4.125.0 不支持该参数；去掉后成功完成只读检查]
- [项目 Wrangler 为 4.125.0] -> [检查最新包与 Workers types] -> [Wrangler 4.126.0 可用；最新 Workers types 为 5.20260826.1，配置 schema 可加载]
- [生产资源创建] -> [仅在已核验的 `My` account 创建目标资源] -> [D1 `gitedge` ID `c9a00d9d-db41-494e-b096-55b8b6bfe3a9`、KV `gitedge-routes` ID `ece920cc5b2b4d4ca8972716ee16e4b4`、R2 `gitedge-git-repos` 与 Queue `gitedge-git-repo-maint` 均已创建]
- [生产配置可能错绑账户或暴露内部服务] -> [合并独立配置实现与对抗测试] -> [四 Worker 固定到 `My` account，仅 Gateway 绑定生产 Custom Domain，Auth/Forge/Git 保持 `workers_dev: false` 并仅由 Service Binding 访问]
- [`npm audit` 报告 4 个 moderate] -> [检查完整依赖路径与建议修复] -> [均来自仅开发使用的 `drizzle-kit` 旧 esbuild 工具链，审计建议反而降级至 0.18.1；不进入生产 Worker bundle，不执行破坏性降级]
- [全仓库 Prettier 检查] -> [发现 12 个本任务未涉及的存量文件和 2 个本任务文件格式差异] -> [只格式化本任务涉及文件并通过定向 Prettier、`git diff --check` 与提交关键词扫描，保留无关用户文件]
- [Worker 集成测试结束期告警] -> [320 项全部通过且进程退出码为 0，但运行器清理时输出 `Network connection lost`] -> [作为测试运行器清理期告警记录，不冒充无告警结果]
