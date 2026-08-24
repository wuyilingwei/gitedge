# 003 Findings

服务目录尚未由基础任务建立；本任务将在限定目录内创建独立 Worker package 和根目录服务测试。

Auth 与 Forge 均为 service-only Worker：Gateway 通过 HTTP Service Binding 调用，不暴露面向浏览器的直接路由。Auth 将会话 token 只写入 HttpOnly/Secure/SameSite=Lax cookie，并只在 D1 中存 SHA-256 hash。

为与 Git transport 共享仓库事实来源，schema 使用 `users`、`namespaces`、`namespace_memberships`、`repositories`。注册会在 D1 batch 中建立小写标识符的用户和同名个人 namespace；Forge 创建仓库写入 `repositories` 并生成 `do_name`。

Pull Request 只包含元数据创建、查询和关闭；没有实现 merge、ref 校验、代码 diff 或完整组织权限，接口不会将这些能力标注为已完成。

验收补强：两个 Worker 都有 service-only Wrangler 配置，并以同一个部署时填入的 D1 database ID 使用 `DB` binding。Forge 只接受 Gateway 的 `X-GitEdge-User-Id` 与 `X-GitEdge-User-Name`，不接受旧的 trust header 或 Email。

密码派生采用 PBKDF2-HMAC-SHA256 600,000 iterations。实际成本必须在本地 workerd 和部署环境量测，目标单次派生少于一秒；本轮仅验证了类型和服务路由，未把本机 Node 计时当作边缘性能证据。
