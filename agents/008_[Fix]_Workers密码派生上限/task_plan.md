# 008 Workers 密码派生上限修复计划

- [x] 复现生产注册 1101 并抓取 Auth 异常栈
- [x] 确认 D1 schema 与 migration 已完整应用
- [x] 将 PBKDF2 调整到 Workers 支持上限并增加回归测试
- [x] 运行定向测试、typecheck、dry-run 与提交自检
- [x] 重新部署并完成生产注册、登录与协作功能验证
