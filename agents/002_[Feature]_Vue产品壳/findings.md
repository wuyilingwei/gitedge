# 002 Findings

# 002 Findings

- [根仓库 Vitest 配置依赖 Worker 专用 pool，且根 node_modules 未安装该依赖] -> [直接从 apps/web 调用根配置失败] -> [为 UI 建立独立 apps/web/vitest.config.ts，仍扫描根 `/test/ui`，不修改根测试配置]
- [API 服务尚未在本地运行] -> [页面加载捕获请求错误] -> [保留可操作的错误/空状态，并在断开 API 时用 dashboard 示例数据维持产品壳可浏览；未伪装 Forge 写操作完成]
- [尝试启动本地 Vite 并连接应用内浏览器] -> [本机当前没有可用浏览器实例] -> [无法完成交互式烟测；已用 vue-tsc、Vite production build 与 Vitest 2 个测试覆盖静态验证]
- [首版 UI 用 `/api/forge/repos`、owner/name 路径和本地 sessionStorage] -> [服务契约要求 `{data}` 包装、repository id 路径与 HttpOnly session] -> [API client 统一解包，仓库页先从列表解析 id，session 改为 reactive state + `/api/auth/session` 守卫]
- [首版 API 失败时展示示例仓库和伪造 README/src] -> [这会掩盖服务不可用且不代表真实 Git 状态] -> [删除 fallback/demo 文案，失败显示 error/retry，Code 页改为真实仓库 id clone URL 与空代码提示]
- [首版表单仅有授权入口] -> [首批 Forge 页面必须能操作创建协作资源] -> [新增仓库、Issue、Pull Request、Wiki 创建表单，成功后刷新对应列表]
