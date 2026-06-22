# 极智岛 AI 项目恢复入口

> 最后更新：2026-06-14（北京时间）
> 本文件是对话丢失、换电脑、重装环境或交接项目时的第一入口。

## 1. 当前项目位置

- GitHub：`https://github.com/song679/jizhidao-ai`
- 生产网站：`https://www.jizhidao-ai.com`
- 生产分支：`main`
- 部署平台：Vercel
- 数据库与登录：Supabase

## 2. 最短恢复流程

```powershell
git clone https://github.com/song679/jizhidao-ai.git
Set-Location jizhidao-ai
npm install
Copy-Item .env.example .env.local
```

随后：

1. 从 Vercel 和 Supabase 控制台恢复环境变量值，不从聊天记录复制密钥。
2. 阅读 `PROJECT_STATUS.md`。
3. 阅读 `docs/PROJECT_RECOVERY_ARCHIVE.md`。
4. 阅读最近提交：`git log --oneline -30`。
5. 运行 `npx tsc --noEmit`、`npm run lint`。
6. 运行 `npm run test:production` 检查正式网站公开功能。
7. 启动 `npm run dev`，测试登录、聊天、点数和订单。

## 3. 文档地图

| 文件 | 用途 |
| --- | --- |
| `PROJECT_STATUS.md` | 当前已完成内容、环境变量、迁移和待办 |
| `docs/PROJECT_RECOVERY_ARCHIVE.md` | 架构、路由、数据库、部署和恢复全过程 |
| `docs/DEVELOPMENT_HISTORY.md` | 从项目恢复到当前阶段的开发里程碑 |
| `docs/INCIDENT_LOG.md` | 生产故障、诊断结果与恢复记录 |
| `OPERATIONS.md` | 日常检查、备份、回滚和生产故障处理 |
| `.env.example` | 环境变量名称与安全示例，不含真实密钥 |
| `supabase/migrations/` | 已纳入版本管理的数据库迁移 |
| `supabase/schema-snapshots/` | 生产数据库纯结构快照及安全导出说明 |
| `.github/workflows/production-smoke.yml` | 每日生产公开功能自动检查 |
| `.github/workflows/code-quality.yml` | 每次推送和 PR 的 TypeScript、ESLint 门禁 |

## 4. 新 Codex 对话开场词

复制下面这段到新对话：

> 请先完整阅读 `RECOVERY_INDEX.md`、`PROJECT_STATUS.md`、`docs/PROJECT_RECOVERY_ARCHIVE.md`、`OPERATIONS.md` 和最近 30 条 Git 提交，然后继续极智岛 AI 项目。不要读取、显示或提交 `.env.local` 的任何值。先执行 TypeScript、ESLint 和 Git 状态检查，再根据“当前待办”继续。

## 5. 重要限制

- GitHub 保存代码、迁移、技术决策和恢复说明。
- GitHub 不保存 Codex/ChatGPT 对话的逐字副本。
- GitHub 不保存生产数据库内容、用户邮箱清单、聊天消息或订单明细。
- `.env.local` 被 Git 忽略；真实密钥应保存在 Vercel、Supabase 和密码管理器中。
- 当前仓库缺少项目早期四张基础表的原始建表迁移，详情见完整恢复档案。
- 使用 `npm run db:schema:export` 可安全生成不含业务数据的结构快照。
- 2026-06-14 检测到生产域名 DNS 为 NXDOMAIN，恢复前查看 `docs/INCIDENT_LOG.md`。
- GitHub Actions 每天北京时间 09:15 自动运行生产冒烟检查。


## Latest recovery addendum

- Read `docs/RECENT_PROGRESS_20260616.md` after this index to recover the latest payment, export, dynamic API, and CI progress.
- Latest verified payment-safety work includes:
  - payment provider adapter contract: `src/lib/payments/contract.ts`
  - payment runtime status logic: `src/lib/payments/status.ts`
  - public payment mode endpoint: `/api/payments/status`
  - admin system payment diagnostics: `/admin/system`
  - payment contract regression test: `npm.cmd run test:payment-contract`
  - latest production smoke result: 45 checks passed
- `.env.example` and the payment adapter contract now include explicit online
  payment guardrails and a pre-launch checklist.
- The pricing page payment mode notice is guarded by
  `npm.cmd run test:payment-contract`.
- Production smoke also checks payment runtime safety invariants.
- Online payment is still intentionally disabled until a real provider adapter
  and signed webhook flow are implemented. Manual recharge remains the live
  production flow.
