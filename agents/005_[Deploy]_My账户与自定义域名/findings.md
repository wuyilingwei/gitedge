# 005 Findings

- [此前 Cloudflare 发布因账户不明确而暂停] -> [用户指定 `My` 与 `gitedge.wuyilingwei.com`] -> [本轮只在 zone 所属的 `My` account 创建和部署资源]
- [自定义域名可能已绑定其他 Worker 或 DNS 记录] -> [先做账户、zone、现有资源和 route 只读核验] -> [确认无冲突后才创建资源与部署]
- [`My` 是否拥有目标 zone 未经当前验证] -> [使用当前 Wrangler OAuth 只读查询 zone] -> [`wuyilingwei.com` 为 active，account ID 与 `My` 完全一致]
- [目标 hostname 可能已有 DNS/route/domain] -> [公共 DNS、Workers routes 与 Workers domains 查询] -> [公共 DNS 无记录，目标 route/custom domain 均为空；OAuth 缺少 DNS record read，DNS API 返回 403，但不影响 Wrangler 创建 Custom Domain]
- [同名生产资源可能已存在] -> [列出 My 的 D1、KV、R2、Queue 与 Worker scripts] -> [未发现任何 `gitedge` 同名资源或 Worker]
- [`wrangler r2 bucket list --json` 与 `queues list --json`] -> [按其他列表命令假设 JSON flag] -> [Wrangler 4.125.0 不支持该参数；去掉后成功完成只读检查]
- [项目 Wrangler 为 4.125.0] -> [检查最新包与 Workers types] -> [Wrangler 4.126.0 可用；最新 Workers types 为 5.20260826.1，配置 schema 可加载]
- [生产资源创建] -> [仅在已核验的 `My` account 创建目标资源] -> [D1 `gitedge` ID `c9a00d9d-db41-494e-b096-55b8b6bfe3a9`、KV `gitedge-routes` ID `ece920cc5b2b4d4ca8972716ee16e4b4`、R2 `gitedge-git-repos` 与 Queue `gitedge-git-repo-maint` 均已创建]
