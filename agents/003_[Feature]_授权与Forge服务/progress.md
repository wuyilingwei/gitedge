# 003 Progress

2026-08-24：读取仓库 AGENTS、Agent Mode、Cloudflare Workers/DO 指引、任务审计文件及现有 D1/Auth 实现。确认本任务服务目录尚不存在，且改动范围允许创建 `workers/auth`、`workers/forge`、`packages/contracts`、`migrations` 与 `test/services`。

2026-08-24：创建共享 Zod 合约、D1 schema、Auth 与 Forge service-only Worker。Auth 使用 Web Crypto PBKDF2 及 token hash；Forge 需要 Gateway 注入受信任用户头。

2026-08-24：执行 `npx tsc --noEmit -p workers/auth/tsconfig.json`、`npx tsc --noEmit -p workers/forge/tsconfig.json`、`npx vitest run --config vitest.unit.config.ts test/services/contracts.test.ts`，均通过。

2026-08-24：补充 service-only Wrangler 配置、Gateway 信任头、仓库前端字段和 Wiki 列表；密码 hash 比较改为 `crypto.subtle.timingSafeEqual`。服务函数测试覆盖拒绝旧头、接受 Gateway 头并返回仓库字段、无效路径输入。

2026-08-24：复跑两个 Worker TypeScript 检查及 `test/services/contracts.test.ts`，4 个测试通过。

2026-08-24：按安全校准将 PBKDF2-HMAC-SHA256 iteration 提升至 600,000；待本地 workerd 与部署环境性能验收（单次目标小于一秒）。
