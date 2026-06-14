# 极智岛 AI 完整项目恢复档案

> 档案日期：2026-06-14（北京时间）
> 档案基准提交：`ccef97b`（移动端聊天输入体验优化）
> 安全声明：本文只记录配置名称和技术结构，不记录任何真实密钥、密码或用户业务数据。

## 一、项目目标

极智岛 AI 是面向中文用户的多模型 AI 聚合网站。用户通过邮箱 Magic Link 注册登录，选择 OpenAI 或 DeepSeek 模型进行聊天，并使用点数计费。平台提供人工充值订单、用户订单中心、点数流水、账户管理和管理员运营后台。

## 二、技术架构

```text
浏览器
  │
  ├─ Next.js App Router 页面
  │
  └─ Next.js Route Handlers
       ├─ Supabase Auth（Magic Link）
       ├─ Supabase PostgreSQL（业务数据/RPC）
       ├─ OpenAI API
       └─ DeepSeek API

GitHub main ──> Vercel Production ──> www.jizhidao-ai.com
```

- 前端/服务端：Next.js 16、React 19、TypeScript
- 样式：Tailwind CSS 4
- 登录与数据库：Supabase
- 部署：Vercel
- AI：OpenAI、DeepSeek
- 内容渲染：React Markdown、Remark GFM

## 三、目录结构

```text
src/app/
  account/                账户管理
  admin/                  管理后台
  api/                    服务端接口
  auth/callback/          Magic Link 回调
  chat/                   AI 聊天
  login/                  登录注册
  orders/                 用户充值订单
  points/                 点数明细
  pricing/                套餐与充值
  privacy/ refund/ terms/ 法务页面
  support/                帮助与反馈
src/lib/
  admin-auth.ts           管理员身份判断
  point-description.ts    点数流水说明
  recharge-plans.ts       套餐定义
  supabase.ts             浏览器 Supabase 客户端
supabase/migrations/      已版本化数据库迁移
```

## 四、页面与接口清单

### 用户页面

- `/`：首页
- `/login`：邮箱登录/注册
- `/auth/callback`：登录回调
- `/chat`：多模型 AI 聊天
- `/pricing`：套餐价格与创建订单
- `/orders`：用户订单中心
- `/points`：点数明细
- `/account`：账户导出与安全删除
- `/terms`、`/privacy`、`/refund`、`/support`

### 管理页面

- `/admin`：运营概览
- `/admin/users`：用户管理
- `/admin/recharge`：手动点数调整
- `/admin/transactions`：点数流水
- `/admin/orders`：充值订单
- `/admin/system`：环境与数据库诊断

### 服务端接口

- 身份：`/api/auth/login`
- 聊天：`/api/chat`、`/api/chat/config`、`/api/chat/history`、`/api/chat/sessions`
- 用户：`/api/points`、`/api/orders`
- 账户：`/api/account/export`、`/api/account/delete`
- 管理：`/api/admin/dashboard`、`users`、`recharge`、`transactions`、`orders`、`system`
- 运维：`/api/health`

## 五、数据库依赖

代码依赖以下业务表：

- `user_points`
- `point_transactions`
- `chat_sessions`
- `chat_messages`
- `chat_request_ledger`
- `recharge_orders`

代码依赖以下 RPC：

- `reserve_chat_points`
- `complete_chat_request`
- `refund_chat_request`
- `recover_stale_chat_reservations`
- `complete_recharge_order`

### 已保存迁移

1. `20260611_chat_billing_safety.sql`
2. `20260612_recharge_orders.sql`
3. `20260612_recharge_orders_permissions.sql`
4. `20260613_chat_ledger_permissions.sql`

### 重要恢复风险

`user_points`、`point_transactions`、`chat_sessions`、`chat_messages` 的最初建表 SQL 是项目早期在 Supabase 控制台执行的，目前没有对应的基础迁移文件。

因此：

- 现有生产 Supabase 项目不要删除或重建。
- 仅执行当前四个迁移，不能在全新 Supabase 项目完整重建系统。
- 后续应从生产数据库结构生成一份**不含数据**的 schema-only 基线迁移，再纳入 Git。
- 生成基线前不要凭猜测重写生产表结构。

仓库已经提供安全导出工具：

```powershell
$env:SUPABASE_DB_URL='从 Supabase 控制台复制的数据库连接 URI'
npm run db:schema:export
Remove-Item Env:SUPABASE_DB_URL
```

输出位于 `supabase/schema-snapshots/`。脚本会拒绝包含业务数据语句或常见密钥格式的文件，并检查六张核心业务表。连接生产数据库需要由项目管理员在本机手动完成，数据库连接 URI 不得写入 Git。

## 六、环境变量

完整变量名称见 `.env.example`。必需核心变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_EMAILS`

AI 至少配置一个服务商：

- OpenAI：`OPENAI_API_KEY`、`OPENAI_MODEL` 等
- DeepSeek：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` 等

注意：

- `SUPABASE_SECRET_KEY` 只能在服务端使用。
- 真实值只放在 `.env.local` 和 Vercel Environment Variables。
- Vercel 修改变量后必须重新部署。
- 管理员权限由 `ADMIN_EMAILS` 控制，不应硬编码到页面。

## 七、登录恢复

Supabase Authentication → URL Configuration 至少允许：

```text
https://www.jizhidao-ai.com/auth/callback
https://www.jizhidao-ai.com/**
```

故障规律：

- Supabase 项目暂停会导致登录和业务接口失效。
- 回调 URL 错误会造成邮箱链接跳转到 localhost 或无法访问。
- 修改回调后必须重新发送新邮件；旧链接不会更新。
- 手机邮件应用可能在系统浏览器打开，因此生产回调必须使用 HTTPS 正式域名。

## 八、聊天与计费原则

1. 浏览器选择模型并提交消息。
2. 服务端验证用户、模型、频率和每日限额。
3. `reserve_chat_points` 原子预扣点数并记录请求。
4. 调用 OpenAI 或 DeepSeek，流式返回内容。
5. 成功后 `complete_chat_request` 完成账本。
6. 失败或中断时 `refund_chat_request` 退款。
7. `recover_stale_chat_reservations` 恢复遗留预扣。

不得把扣点逻辑改为只在浏览器执行，也不得在 AI 成功前直接写普通扣款流水。

## 九、充值订单原则

- 当前是人工收款，不是在线支付。
- 用户选择套餐后创建 `pending` 订单。
- 管理员确认真实到账后调用 `complete_recharge_order`。
- 数据库函数原子更新订单、余额和流水。
- 订单支持 `pending`、`paid`、`cancelled`、`refunded`。
- 待确认订单默认 24 小时过期，可由 `ORDER_EXPIRY_HOURS` 调整。
- 管理员不得绕过订单确认流程直接把订单改成 `paid`。

## 十、安全与异常处理

- API 默认禁止缓存账户和管理数据。
- 配置 CSP、HSTS、防嵌入及权限策略。
- 原始数据库和 AI 错误仅写服务端日志。
- 用户界面显示友好错误和故障编号。
- 管理页面服务端验证 `ADMIN_EMAILS`。
- 账号删除需要邮箱确认。
- `.env*` 默认被 Git 忽略，仅 `.env.example` 可提交。

## 十一、当前已完成状态

- OpenAI / DeepSeek 多模型选择
- 流式聊天、停止、重试、Markdown、会话历史
- 原子扣点、退款、限流、幂等保护
- 邮箱 Magic Link 登录及手机回调
- 用户点数、订单、账户页面
- 管理员用户、充值、流水、订单、运营和系统诊断
- 用户协议、隐私、退款、支持页面
- 全站主要页面手机适配
- 生产 GitHub/Vercel 自动部署

## 十二、尚未完成

按优先级：

1. 由管理员运行 `npm run db:schema:export`，从生产 Supabase 生成并人工审核 schema-only 快照。
2. 使用普通新邮箱验收“注册 → 创建订单 → 管理员确认 → 点数到账 → 流水出现”。
3. 接入正式在线支付和签名回调。
4. 增加订单邮件通知和管理员提醒。
5. 建立定期数据库备份并记录恢复演练。
6. 继续性能、移动端和异常恢复测试。

## 十三、完整恢复验证

### 代码

```powershell
npm install
npx tsc --noEmit
npm run lint
git diff --check
```

### 生产

先执行自动公开检查：

```powershell
npm run test:production
```

该检查不登录账户，不执行聊天或订单写入操作。

1. `/api/health` 返回健康。
2. `/admin/system` 必需环境变量和关键表/函数正常。
3. 普通邮箱 Magic Link 登录成功。
4. OpenAI 与 DeepSeek 至少各测试一次。
5. 失败聊天能自动退点。
6. 用户能创建订单，管理员能确认到账。
7. 用户余额、订单、流水三处结果一致。

## 十四、Git 操作

```powershell
git status
git add .
git commit -m "描述本次修改"
git push origin main
```

Vercel 在推送 `main` 后自动部署。推送前确认 `.env.local` 未进入暂存区。
