# GitEdge / 码锋 项目索引

> 最后更新：2026-08-26

## 项目目标

GitEdge（中文名“码锋”）是部署在 Cloudflare 边缘平台上的 Git 托管与协作服务。首批产品范围包含仓库、Issue、Pull Request 与 Wiki；后续再接入完整 Git Smart HTTP v2、R2 对象存储、Durable Object 仓库一致性，以及 Container 原生 Git GC。

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Vue Router、Vue I18n
- 边缘入口：Cloudflare Workers Static Assets + Gateway Worker
- 授权：独立 Auth Worker、D1 用户/会话、HttpOnly Cookie
- Forge 协作：独立 Forge Worker、D1 元数据
- Git 传输：独立 Git Worker、每仓库 Durable Object、R2 对象
- 元数据：Cloudflare D1
- 仓库协调：Cloudflare Durable Objects（框架边界）
- Git 对象：Cloudflare R2（框架边界）
- 后台重活：Cloudflare Queues + Containers（后续里程碑）
- 测试：Vitest；所有测试位于项目根目录 `/test`

## 模块结构

- `apps/web/`：Vue 单页应用、路由、组件与语言包
- `workers/gateway/`：公开入口、静态资源与服务绑定编排
- `workers/auth/`：授权门户、凭证与会话验证
- `workers/forge/`：仓库、Issue、Pull Request、Wiki API
- `workers/git/`：Git Smart HTTP 与仓库一致性边界
- `packages/contracts/`：服务间及前后端共享契约
- `migrations/`：D1 schema 迁移
- `test/`：单元与集成测试
- `agents/`：任务计划、发现与执行审计

## 项目级指令

见 [local.instructions.md](./local.instructions.md)。

## 当前交付边界

生产站点为 `https://gitedge.wuyilingwei.com`，仅 Gateway 通过 Custom Domain 公开；Auth、Forge 与 Git Worker 关闭 `workers.dev`，只通过 Service Bindings 接入。生产资源为 D1 `gitedge`、KV `gitedge-routes`、R2 `gitedge-git-repos` 与 Queue `gitedge-git-repo-maint`。

本轮交付的是已上线的多 Worker 产品框架、授权入口与仓库、Issue、Pull Request、Wiki 首批垂直切片。完整权限模型和 GC Container 不在本轮伪装为成品；Git transport 优先复用经验证的 MIT 上游实现，不从零重写协议。
