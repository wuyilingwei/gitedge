# 001 Findings

## 需求结论

- [原项目书将 PR、Issue、CI 列为非目标] -> [用户明确要求首批包括 Issue、PR、Wiki] -> [以用户的新范围为准，CI 仍不进入首批]
- [前端技术与中文品牌最初未指定] -> [用户补充 Vue、i18n、中文译名“码锋”] -> [前端统一使用 Vue 3 + Vue I18n，语言包承担用户可见文案]
- [部署拓扑与访问入口最初未指定] -> [用户补充多 Worker 架构与授权门户] -> [拆分 Gateway/Auth/Forge/Git 服务；只让 Gateway 暴露产品 UI，协作页面要求有效会话]

## 上游与产品边界

- [`zllovesuki/git-on-cloudflare` 为 MIT 且已实现 Git Smart HTTP v2 核心] -> [对比从零实现 pkt-line、pack、push 并发风险] -> [固定上游提交并复用 Git transport/storage 核心，Vue 与 Forge 层独立演进]
- [目标 GitHub 仓库已有 ALE 1.1 + GPL-3.0 根许可证，上游为 MIT] -> [核对两段现有许可证与目标仓库历史] -> [保留目标仓库根许可证，并把上游 MIT 声明独立保存于 `LICENSES/MIT-git-on-cloudflare.txt`]
- [成熟 Forge 的仓库级信息架构高度一致] -> [比较 GitHub/GitLab/Gitea/Forgejo] -> [首批仓库导航固定为 Code / Issues / Pull Requests / Wiki]
- [Wiki 若首批直接实现独立 Git 仓库会扩大协议与权限面] -> [比较 D1 版本化正文方案] -> [首批用 `forge_wiki_pages` 保存正文与 revision；附件不进入首批]

## 待核验

- `git-on-cloudflare` 的当前上游实现、许可与可复用边界。
- Cloudflare 账户、Wrangler、GitHub CLI 的发布条件。
- 当前 Cloudflare Worker/D1/DO/R2/Containers 配置与 API 形状。

## 基线验证

- [上游 `npm run test` 有 5 个 suite 在导入期失败] -> [在 Node Vitest 中复现并定位 `cloudflare:workers` 无法解析] -> [34 个测试通过、5 个 suite 未执行；这是固定上游基线问题，不能把单元测试整体宣称通过]
- [上游锁文件安装后报告 15 个依赖漏洞] -> [运行 `npm audit --json`] -> [0 critical、11 high、4 moderate；直接依赖 Hono 版本低于修复版本，Wrangler/Vite 工具链也有传递漏洞，GitEdge 整合后必须刷新锁文件并重新审计]
- [怀疑固定上游无法构建] -> [执行 `npm run typecheck` 与 `npm run build`] -> [两者成功；构建仍包含旧 React SSR 客户端，最终 Vue 入口整合后需避免把它当作码锋前端]
- [更新 Workers 工具链后 ExecutionContext 新增 `tracing`/`abort` 且 Node Vitest 无法解析 `cloudflare:workers`] -> [补齐 fallback context，并在根 `/test/support` 提供 Node-only runtime alias] -> [根单元测试恢复为 52/52 通过，typecheck 通过]
- [依赖更新可能只移动版本而未消除高危项] -> [更新 semver 范围内依赖，并将 `@cloudflare/vitest-pool-workers` 升至当前版本] -> [npm audit 降至 0 high / 0 critical / 4 moderate]
- [需要验证真实 Workers runtime 路径] -> [执行完整 `npm run test:workers`] -> [54 个文件、320 个测试通过；基线与最终整合两次均在测试完成时出现 workerd `Network connection lost` teardown 警告，未造成失败但需保留为工具链观察项]

## 集成验证

- [Vue 表单字段与 Forge schema 存在错位] -> [在真实四 Worker 栈中操作建仓库、PR 与 Wiki] -> [修正 `name/slug`、`head/base`、Wiki PUT path 与 `content` 字段，并增加 API client 测试]
- [Forge 创建仓库只写 D1] -> [公开 `git ls-remote` 返回 404] -> [Forge 同步写入 KV 候选路由；复验 discovery 返回 Git v2 advertisement，`git ls-remote` 退出码为 0]
- [Issue 列表显示内部 user UUID] -> [浏览器验收发现用户可见内部标识] -> [Forge join 用户 identifier，界面显示账号名]
- [浏览器 UI 与 API 静态测试不足以覆盖会话边界] -> [在本地 Gateway 走完整流程] -> [登录、仓库、Issue、PR、Wiki、i18n、退出与匿名重定向均通过；匿名 Forge API 返回 401]
- [本机 Wrangler 登录到六个 Cloudflare 账户且没有既有 gitedge 资源] -> [账户选择会决定计费与域名所有权] -> [不猜测目标账户；Cloudflare 正式发布等待用户指定 account]
