# 技术发现

- [现有 Forge 要求可信用户头] -> [为严格保持写入与私有数据边界，公开能力限制为单独路径上的 GET] -> [所有其他匿名 Forge 请求维持 401，公开路径中的非公开仓库统一返回 404]
- [Gateway 不在本任务修改范围] -> [前端使用独立公开 Forge 路径] -> [依赖 Gateway 的匿名 GET 放行同步交付，不在此分支绕过或修改 Gateway]
- [定向测试首次执行失败：`vitest: command not found`] -> [独立 worktree 未安装根依赖] -> [先安装 lockfile 声明的依赖，再继续验证]
- [公开 API 客户端测试报 `Body is unusable`] -> [同一 Response 被四次读取] -> [mock 为每次请求创建新的 Response]
