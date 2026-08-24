# 002 Findings

# 002 Findings

- [根仓库 Vitest 配置依赖 Worker 专用 pool，且根 node_modules 未安装该依赖] -> [直接从 apps/web 调用根配置失败] -> [为 UI 建立独立 apps/web/vitest.config.ts，仍扫描根 `/test/ui`，不修改根测试配置]
- [API 服务尚未在本地运行] -> [页面加载捕获请求错误] -> [保留可操作的错误/空状态，并在断开 API 时用 dashboard 示例数据维持产品壳可浏览；未伪装 Forge 写操作完成]
- [尝试启动本地 Vite 并连接应用内浏览器] -> [本机当前没有可用浏览器实例] -> [无法完成交互式烟测；已用 vue-tsc、Vite production build 与 Vitest 2 个测试覆盖静态验证]
