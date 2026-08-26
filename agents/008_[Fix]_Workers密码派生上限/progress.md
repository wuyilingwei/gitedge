# 008 Progress

## 2026-08-26

- 生产部署后首次真实注册返回 500；Auth tail 精确定位到 PBKDF2 600000 超出 Workers 100000 上限。
- 远端 D1 schema 完整且无待应用 migration。
- 已调整 Auth 派生参数并新增根目录回归测试；尚未重新部署。
- 通过 11 项定向测试、Auth/Forge typecheck 与 Auth Worker dry-run；准备发布修复。
