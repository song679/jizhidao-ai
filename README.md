# 极智岛 AI

中文多模型 AI 聚合平台，基于 Next.js、Supabase 和 Vercel 构建，支持 OpenAI / DeepSeek、邮箱登录、聊天计费、充值订单及管理员后台。

生产网站：[https://www.jizhidao-ai.com](https://www.jizhidao-ai.com)

## 恢复项目

如果 Codex 对话丢失、换电脑或需要从零接管项目，请按顺序阅读：

1. [`RECOVERY_INDEX.md`](RECOVERY_INDEX.md) — 恢复入口和最短操作步骤
2. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — 当前功能、环境变量和待办事项
3. [`docs/PROJECT_RECOVERY_ARCHIVE.md`](docs/PROJECT_RECOVERY_ARCHIVE.md) — 完整技术恢复档案
4. [`docs/DEVELOPMENT_HISTORY.md`](docs/DEVELOPMENT_HISTORY.md) — 项目开发过程和重要决策
5. [`OPERATIONS.md`](OPERATIONS.md) — 生产运维、备份、回滚和故障处理

以上文件不保存任何 API 密钥、数据库密码或用户聊天内容。

## 本地开发

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

提交前检查：

```powershell
npx tsc --noEmit
npm run lint
git diff --check
```

## 部署

- GitHub：`song679/jizhidao-ai`
- 主分支：`main`
- Vercel 监听 `main` 并自动部署
- 环境变量修改后必须重新部署
- Supabase 登录回调必须允许：

```text
https://www.jizhidao-ai.com/auth/callback
https://www.jizhidao-ai.com/**
```

## 安全提醒

- 不要提交 `.env.local`
- 不要将 Supabase Secret Key、OpenAI Key、DeepSeek Key 写入文档
- 不要把数据库导出、用户邮箱、聊天记录或订单明细上传到公开仓库
