# 009 Findings

- [临时生产 QA 账号是否仍可登录] -> [检查上一部署审计] -> [`deploy-check-20260826a` 与临时密码已在验收后精确删除，当前没有预置账号]
- [现有 public 语义] -> [检查 Vue、Gateway、Forge 与 Git 路由] -> [创建表单已有 public/private，Git 读取路径已有公开仓库基础，但 Gateway 对全部 Forge API 强制会话且 Vue 路由保护阻止匿名仓库页面]
- [Cloudflare Rate Limiting binding 的一致性] -> [对照当前官方文档] -> [binding 按数据中心局部、宽松且最终一致，不适合“严格 RPM”；改用 SQLite Durable Object 序列化滚动 60 秒窗口]
- [存储配额的计量口径] -> [检查 receive-pack、压缩与清理路径] -> [按 R2 物理对象字节计量 pack、idx、refs 与 loose objects，避免只统计活跃 pack 而遗漏尚未清理的对象]
- [配额归属] -> [检查 PAT 授权和仓库 created_by] -> [push 限制按仓库所有者用户组执行，防止协作者 PAT 改变或绕过仓库存储策略]
