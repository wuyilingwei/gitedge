# 调研记录

- [任务范围] 用户要求 Vue UI、GitHub 基础功能与语义、组织、外部登录及 GitHub OAuth 两档权限 -> 以当前多 Worker 架构实现可验证的最小端到端能力，不扩张为 GitHub 全功能复制。
- [架构基线] 当前 `PRODUCT.md` 与源码已经采用 Vue 3 + Gateway/Auth/Forge/Git 多 Worker，而根目录旧说明存在 React SSR 路径滞后 -> 以后续源码、`PRODUCT.md` 和实际配置为准。
- [数据迁移] 用户明确不保留向后兼容 -> 新 schema 直接表达目标模型，不增加双写、兼容字段或运行时 fallback。
- [前端契约] 现有 API client 统一解包 `{data}` envelope；组织与 GitHub 外部身份字段直接以严格接口表达，仓库创建请求显式携带 `owner`。
- [验证] 初次测试因离线依赖未安装无法启动；执行离线 npm install 后，8 个 UI/API 测试和生产构建均通过。
