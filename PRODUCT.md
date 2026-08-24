# GitEdge / 码锋产品约束

## 产品定位

码锋是面向个人开发者和小团队的边缘 Git Forge。首批目标不是复刻大型代码托管平台，而是让授权、仓库、Git transport、Issue、Pull Request 和 Wiki 形成一个可信的最小端到端产品。

## 品牌与语言

- 英文名称：GitEdge
- 中文名称：码锋
- 界面默认简体中文，并提供英文切换。
- 气质：精确、克制、偏工具化；技术事实优先于营销文案。

## 前端

- Vue 3、TypeScript、Vite、Vue Router、Vue I18n。
- 深色界面优先，保留明确的键盘焦点、错误、加载和空状态。
- 不用演示数据掩盖 API 故障；页面只呈现真实服务数据。
- 仓库一级导航固定为 Code、Issues、Pull Requests、Wiki。

## 服务边界

- Gateway 是唯一公开 Worker，负责静态资源、路由和可信身份转换。
- Auth、Forge、Git 关闭 `workers.dev` 与公开 route，只允许 Service Binding 访问。
- Auth 拥有凭证与会话；Forge 拥有协作元数据；Git 拥有协议、refs 与对象存储。
- D1 是用户、namespace、仓库和协作元数据的事实来源；KV 只作为 Git 路由候选缓存，不能独立授权。

## 首批明确边界

- Issue 支持创建、列表和状态更新 API。
- Pull Request 支持创建、列表和状态更新 API，但不声称已有 diff 或 merge。
- Wiki 使用 D1 保存正文与 revision，不建立第二套 Git 仓库。
- Git Smart HTTP v2 核心保留；公开 fetch 路径可用，push 需要后续接通 PAT 签发与管理界面。
- CI、组织级权限、SSH、代码评审线程和通知不在首批范围。
