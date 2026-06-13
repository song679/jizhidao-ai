# 极智岛 AI 项目状态档案

> 用途：当 Codex 对话丢失、换电脑或开启新对话时，用本文件恢复项目上下文。  
> 最后更新：2026-06-13（北京时间）
> 生产网站：https://www.jizhidao-ai.com  
> GitHub：https://github.com/song679/jizhidao-ai  
> 当前分支：`main`

## 1. 技术栈

- Next.js 16（App Router）
- React 19 + TypeScript
- Supabase：邮箱 Magic Link 登录、PostgreSQL 数据库
- Vercel：生产部署和环境变量
- AI 服务：OpenAI / DeepSeek
- 点数制计费

## 2. 已完成功能

### 用户与登录

- 邮箱 Magic Link 登录/注册。
- 新用户自动初始化点数。
- 独立 `/auth/callback` 登录回调页面。
- 生产域名和手机浏览器登录跳转兼容。
- 普通用户与管理员权限区分。
- 账户数据导出。
- 安全删除账户。

### AI 聊天

- OpenAI 与 DeepSeek API 接入。
- 顶部下拉框选择可用模型。
- 服务端根据用户所选模型调用对应供应商。
- 流式输出、停止生成和重新生成。
- Markdown 与 GFM 内容展示。
- 多会话、历史消息、新建会话和清空记录。
- 移动端聊天导航适配。
- 对外部 AI 错误进行友好提示，不向用户暴露原始接口错误。

### 点数和安全计费

- 用户剩余点数查询。
- AI 请求按模型扣除不同点数。
- 原子预扣点数，失败请求自动退款。
- 请求幂等和重复提交保护。
- 请求频率限制和每日点数限额。
- 遗留预扣记录自动恢复。
- 点数交易流水与点数明细页面。
- 管理员手动充值。

### 价格与充值订单

- 价格套餐页面。
- 用户选择套餐并创建待付款订单。
- 订单表和订单状态：`pending`、`paid`、`cancelled`、`refunded`。
- 管理员订单页面 `/admin/orders`。
- 管理员确认到账后，原子更新订单、用户余额和点数流水。
- 管理员订单支持状态筛选、订单号/邮箱搜索和分页。
- 订单表未安装或权限未配置时返回可操作的诊断提示。
- 当前仍为人工收款流程，尚未接入在线支付渠道。

### 管理后台

- `/admin`：运营概览。
- `/admin/users`：用户管理。
- `/admin/recharge`：手动充值管理。
- `/admin/transactions`：点数流水。
- `/admin/orders`：充值订单管理。
- 管理员权限由 Vercel 环境变量 `ADMIN_EMAILS` 控制。

### 法务与支持页面

- `/terms`：用户协议。
- `/privacy`：隐私政策。
- `/refund`：退款说明。
- `/support`：联系与支持。

### 运维

- `/api/health` 健康检查接口。
- 管理后台近 7 天调用、消耗、充值和模型分布统计。
- 主要生产代码已经提交并推送到 GitHub。

## 3. 主要页面和接口

### 页面

- `/` 首页
- `/login` 登录
- `/auth/callback` 登录回调
- `/chat` AI 聊天
- `/pricing` 套餐价格
- `/points` 点数明细
- `/account` 账户管理
- `/admin` 管理后台
- `/admin/orders` 充值订单

### 主要接口

- `/api/auth/login`
- `/api/chat`
- `/api/chat/config`
- `/api/chat/history`
- `/api/chat/sessions`
- `/api/points`
- `/api/orders`
- `/api/admin/dashboard`
- `/api/admin/users`
- `/api/admin/recharge`
- `/api/admin/transactions`
- `/api/admin/orders`
- `/api/account/export`
- `/api/account/delete`
- `/api/health`

## 4. Supabase 数据库迁移

迁移文件位于 `supabase/migrations/`：

1. `20260611_chat_billing_safety.sql`
   - AI 请求流水
   - 原子预扣、结算、退款
   - 限流和重复请求保护

2. `20260612_recharge_orders.sql`
   - 充值订单表
   - 完成订单并充值的数据库函数

3. `20260612_recharge_orders_permissions.sql`
   - 为 `service_role` 授予充值订单表权限

如果生产环境 `/admin/orders` 或价格页提示加载订单失败，在 Supabase SQL Editor 执行：

```sql
grant select, insert, update, delete
  on table public.recharge_orders
  to service_role;
```

## 5. 环境变量

以下变量只记录名称，密钥值不得写入 GitHub：

### 必需

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_EMAILS`

### AI

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MODEL_OPTIONS`
- `OPENAI_POINT_COST`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_MODEL_OPTIONS`
- `DEEPSEEK_POINT_COST`

### 限流与联系方式

- `CHAT_RATE_LIMIT`
- `CHAT_RATE_WINDOW_SECONDS`
- `CHAT_DAILY_POINT_LIMIT`
- `NEXT_PUBLIC_ADMIN_EMAIL`
- `NEXT_PUBLIC_ADMIN_WECHAT`

Vercel 修改环境变量后必须重新部署生产版本。

## 6. Supabase 登录配置

生产登录需要在 Supabase Authentication 的 URL Configuration 中包含：

```text
https://www.jizhidao-ai.com/auth/callback
```

也可以保留允许生产域名所有路径的配置：

```text
https://www.jizhidao-ai.com/**
```

修改回调配置后，测试邮箱必须重新发送一封新的登录邮件；旧邮件仍可能包含旧回调地址。

## 7. 当前待验证事项

1. 在 Supabase 生产项目确认已执行：
   - `20260612_recharge_orders.sql`
   - `20260612_recharge_orders_permissions.sql`
2. 确认 `/admin/orders` 可以正常加载订单，不再显示“加载充值订单失败”。
3. 使用非管理员的新邮箱重新发送 Magic Link，确认能完成首次注册并进入聊天页。
4. 使用普通用户完成一次完整流程：
   - 登录
   - 创建充值订单
   - 管理员确认到账
   - 用户点数增加
   - 点数流水出现充值记录
5. 检查 `recharge_orders` 迁移文件中历史中文字符串的编码；如果数据库流水描述出现乱码，需要新增迁移修正函数文本。

## 8. 后续开发顺序

1. 完成普通邮箱注册和充值订单全流程验收。
2. 增加管理员订单详情及更完整的支付信息录入。
3. 接入正式在线支付及支付回调。
4. 增加邮件通知、订单通知和管理员提醒。
5. 完成上线前安全、移动端、性能和异常恢复测试。
6. 补充监控、数据库备份和运营文档。

## 9. 最近关键提交

- `0ab9b98` 修复 Magic Link 回调和充值订单权限
- `b0755e0` 增加充值订单工作流
- `7c33c5b` 增加使用限额与健康监控
- `8c5c791` 增加流式聊天控制
- `53d9fe7` 增加安全删除账户
- `996a544` 强化聊天会话处理
- `f4c316a` 修复生产环境 Magic Link 跳转
- `bfea508` 改进移动端聊天导航

## 10. 新 Codex 对话恢复提示

如果原对话丢失，在项目目录打开新对话并发送：

> 请先完整阅读 `PROJECT_STATUS.md`、最近的 Git 提交和当前代码，然后继续极智岛 AI 项目。不要读取或输出 `.env.local` 中的密钥。先检查“当前待验证事项”，再按“后续开发顺序”继续。
