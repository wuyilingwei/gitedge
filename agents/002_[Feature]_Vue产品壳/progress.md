# 002 Progress

## 2026-08-24

- 读取仓库 `AGENTS.md`、`PRODUCT.md`、项目级 `agents/project.md`、任务计划和既有审计记录。
- 确认 `apps/web` 尚未存在；本任务将建立独立 Vue/Vite 工程，不触碰根 package.json 或 Worker 代码。
- 先建立最小工程与路由/i18n骨架，再接入页面、API client 和测试。
- 新增 `apps/web` 独立 package、Vite 配置、Vue Router、Vue I18n、API client、授权页、dashboard、仓库四标签页和响应式深色 UI。
- 新增根目录 `test/ui/product-shell.test.ts`，验证中英文语言包和四类仓库导航契约。
- `npm install`（apps/web）通过；`npm run build` 通过（vue-tsc + Vite）；`npm test` 通过（2 tests）。
- 本地浏览器烟测受阻：当前无可用浏览器实例；未修改代码绕过该环境限制。
- 跨分支验收补强：API client 对齐 Auth `{identifier,password}`、Forge `{data}` wrapper 与 repository-id 路径；移除所有 dashboard fallback/demo 文案。
- 增加 reactive HttpOnly session 状态，路由守卫调用 `/api/auth/session`，退出调用真实 logout；密码最小长度改为 12。
- 增加仓库、Issue、Pull Request、Wiki 创建表单及 POST 操作，成功后刷新列表；Code 页展示真实 clone URL 与 Git transport 空仓状态。
- 增加 fetch mock 测试覆盖响应解包、API 路径及 401 错误；Prettier 格式化完成。
- 补强验证：`npm run build` 通过；`npm test` 通过，4 tests。
- 主分支集成修正 Forge payload 与 Wiki 路径，更新 Vue 生态依赖；最终前端测试 6/6、production build 通过，并完成真实浏览器全流程验证。
