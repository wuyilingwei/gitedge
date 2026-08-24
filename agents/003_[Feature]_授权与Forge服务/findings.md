# 003 Findings

服务目录尚未由基础任务建立；本任务将在限定目录内创建独立 Worker package 和根目录服务测试。

Auth 与 Forge 均为 service-only Worker：Gateway 通过 `WorkerEntrypoint` RPC 调用，不暴露面向浏览器的直接 HTTP 路由。Auth 将会话 token 只写入 HttpOnly/Secure/SameSite=Lax cookie，并只在 D1 中存 SHA-256 hash。

为与 Git transport 共享仓库事实来源，schema 使用 `users`、`namespaces`、`namespace_memberships`、`repositories`。注册会在 D1 batch 中建立小写标识符的用户和同名个人 namespace；Forge 创建仓库写入 `repositories` 并生成 `do_name`。

Pull Request 只包含元数据创建、查询和关闭；没有实现 merge、ref 校验、代码 diff 或完整组织权限，接口不会将这些能力标注为已完成。
