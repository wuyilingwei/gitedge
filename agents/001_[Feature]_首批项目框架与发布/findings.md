# 001 Findings

## 需求结论

- [原项目书将 PR、Issue、CI 列为非目标] -> [用户明确要求首批包括 Issue、PR、Wiki] -> [以用户的新范围为准，CI 仍不进入首批]
- [前端技术与中文品牌最初未指定] -> [用户补充 Vue、i18n、中文译名“码锋”] -> [前端统一使用 Vue 3 + Vue I18n，语言包承担用户可见文案]
- [部署拓扑与访问入口最初未指定] -> [用户补充多 Worker 架构与授权门户] -> [拆分 Gateway/Auth/Forge/Git 服务；只让 Gateway 暴露产品 UI，协作页面要求有效会话]

## 上游与产品边界

- [`zllovesuki/git-on-cloudflare` 为 MIT 且已实现 Git Smart HTTP v2 核心] -> [对比从零实现 pkt-line、pack、push 并发风险] -> [固定上游提交并复用 Git transport/storage 核心，Vue 与 Forge 层独立演进]
- [成熟 Forge 的仓库级信息架构高度一致] -> [比较 GitHub/GitLab/Gitea/Forgejo] -> [首批仓库导航固定为 Code / Issues / Pull Requests / Wiki]
- [Wiki 若首批直接实现独立 Git 仓库会扩大协议与权限面] -> [比较 D1 版本化正文方案] -> [首批用 `wiki_pages` + `wiki_revisions`，附件走 R2]

## 待核验

- `git-on-cloudflare` 的当前上游实现、许可与可复用边界。
- Cloudflare 账户、Wrangler、GitHub CLI 的发布条件。
- 当前 Cloudflare Worker/D1/DO/R2/Containers 配置与 API 形状。
