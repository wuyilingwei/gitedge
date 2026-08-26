# 008 Findings

- [生产 Auth 注册返回 1101] -> [使用 Auth Worker 实时错误日志定位] -> [`crypto.subtle` 抛出 `NotSupportedError`：Workers 的 PBKDF2 迭代次数上限为 100000，当前请求为 600000]
- [可能是 D1 migration 缺失] -> [远端查询完整 sqlite schema 与 migrations 状态] -> [所有首批表均存在且无待应用 migration，排除 D1 结构问题]
- [密码派生需要平台可执行且保持当前最强参数] -> [不引入兼容层或自制 KDF] -> [沿用标准 WebCrypto PBKDF2-SHA-256，使用平台支持的最高 100000 次]
- [修复是否只在本地通过] -> [重新发布 Auth 后在生产域名执行完整 API 流程] -> [注册 201、会话 200、仓库/Issue/PR 创建 201、Wiki 200、登出后 401、再次登录与会话 200]
