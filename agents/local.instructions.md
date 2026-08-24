---
description: Always Load
applyTo: "**"
---

# GitEdge 项目指令

- 英文品牌统一使用 `GitEdge`，中文品牌统一使用“码锋”。
- 前端使用 Vue 3，所有用户可见文案进入 Vue I18n 语言包。
- 首批产品范围必须同时呈现仓库、Issue、Pull Request 与 Wiki。
- 使用多 Worker 架构，公开 Gateway、Auth、Forge、Git transport 按职责拆分并优先使用 Service Bindings。
- 授权门户是首批入口；匿名用户不得直接进入仓库协作页面。
- 测试只放在仓库根目录 `/test`。
- 不用占位实现冒充完整 Git Smart HTTP、完整权限模型或生产就绪能力。
