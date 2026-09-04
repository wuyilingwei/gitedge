# 调研记录

- [任务范围] 用户要求 Vue UI、GitHub 基础功能与语义、组织、外部登录及 GitHub OAuth 两档权限 -> 以当前多 Worker 架构实现可验证的最小端到端能力，不扩张为 GitHub 全功能复制。
- [架构基线] 当前 `PRODUCT.md` 与源码已经采用 Vue 3 + Gateway/Auth/Forge/Git 多 Worker，而根目录旧说明存在 React SSR 路径滞后 -> 以后续源码、`PRODUCT.md` 和实际配置为准。
- [数据迁移] 用户明确不保留向后兼容 -> 新 schema 直接表达目标模型，不增加双写、兼容字段或运行时 fallback。
- [组织模型] -> [复用 namespaces 与 namespace_memberships] -> `0004_organizations.sql` 将 namespace 表达为 personal 或 organization，加入展示字段；membership 表达 owner 或 member。个人 namespace 的 owner 角色由 D1 trigger 在注册写入 membership 时维护。
- [写入边界] -> [组织与首位 owner 需共同成功] -> Forge 以单次 D1 batch 写入 namespace 和 membership；成员删除通过带 owner 数量条件的单条 DELETE RETURNING，不能移除最后一名 owner。
- [仓库创建] -> [旧契约隐式查找个人 namespace] -> 契约强制 owner slug，Forge 对个人 namespace 核验创建者，对组织核验 membership owner；不保留旧 fallback。
