# 极智岛 AI 项目状态档案

> 用途：当 Codex 对话丢失、换电脑或开启新对话时，用本文件恢复项目上下文。
> 最后更新：2026-06-14（北京时间）
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
- `/orders` 用户订单中心，可查看状态、支付信息和订单详情。
- 用户可取消自己尚未处理的待确认订单，服务端验证订单归属。
- 待确认订单默认 24 小时有效，过期后自动关闭。
- 价格页和用户订单中心显示订单付款联系截止时间，复制信息中包含有效期。
- 管理员确认到账前会再次检查有效期，避免误处理旧订单。
- 订单表和订单状态：`pending`、`paid`、`cancelled`、`refunded`。
- 管理员订单页面 `/admin/orders`。
- 管理员确认到账后，原子更新订单、用户余额和点数流水。
- 管理员订单支持状态筛选、订单号/邮箱搜索和分页。
- 管理员可查看订单详情、支付信息、处理管理员及时间记录。
- 确认到账时可录入微信、支付宝、银行转账或其他人工收款信息。
- 支持保存支付流水号和管理员备注。
- 订单表未安装或权限未配置时返回可操作的诊断提示。
- 当前仍为人工收款流程，尚未接入在线支付渠道。

### 管理后台

- `/admin`：运营概览。
- `/admin/users`：用户管理。
- `/admin/recharge`：手动充值管理。
- `/admin/transactions`：点数流水。
- `/admin/orders`：充值订单管理。
- `/admin/system`：环境变量、数据库表和关键函数检查。
- 系统状态页检查负数余额、滞留扣点和异常订单数据。
- 可选联系方式未配置不会误报系统异常，并检查至少一个 AI 服务商可用。
- 管理员权限由 Vercel 环境变量 `ADMIN_EMAILS` 控制。

### 法务与支持页面

- `/terms`：用户协议。
- `/privacy`：隐私政策。
- `/refund`：退款说明。
- `/support`：联系与支持。

### 运维

- `/api/health` 健康检查接口。
- 管理后台近 7 天调用、消耗、充值和模型分布统计。
- 管理后台显示有效期内待确认充值订单数量和醒目处理入口。
- 用户订单中心显示全部、待确认和已到账订单统计。
- 用户与管理员订单页每 30 秒静默刷新，订单到账后向用户显示站内提示。
- 支持可选的订单邮件通知：新订单提醒管理员，到账或管理员取消时通知用户。
- 管理员充值订单页提供手机卡片视图，可直接查看、确认到账和取消订单。
- 管理员用户管理页提供手机账户卡片，选择用户后自动滚动到账户详情。
- 管理员点数流水页提供手机流水卡片，完整显示变动、余额、说明和操作管理员。
- 管理员点数管理页适配手机操作，并在提交前展示当前余额、本次变动和预计余额。
- 管理员运营概览的近 7 天趋势和最近点数活动提供手机卡片视图。
- 用户点数明细页完善手机导航、刷新与错误恢复，并显示最近充值、消耗和退还汇总。
- 用户账户页增加手机订单入口，并通过邮箱加风险确认双重保护账号注销。
- 价格与充值页完善手机导航、紧凑间距和管理员联系方式一键复制。
- 帮助反馈页优化手机操作，支持一键复制问题报告、管理员邮箱和微信。
- 登录页支持手机键盘提交、发送成功步骤提示、防重复发送倒计时和回调失败帮助入口。
- 首页更新为 OpenAI/DeepSeek 多模型介绍，完善手机导航和真实登录/聊天入口。
- 聊天输入区适配动态视口、手机安全区和窄屏按钮布局，并避免中文输入法回车误发送。
- 全站配置 CSP、HSTS、防嵌入、权限策略等安全响应头。
- 所有 API 响应默认禁止缓存，避免账户与管理数据被中间缓存。
- 数据库原始错误只记录到服务端日志，不再返回给浏览器。
- 页面错误、根级崩溃和 404 均提供恢复入口与故障编号。
- 帮助页自动接收故障编号，并生成包含页面、时间和浏览器环境的诊断信息。
- `OPERATIONS.md` 记录数据库备份、恢复、部署回滚和上线检查流程。
- 提供 Supabase `public` schema 安全导出脚本，自动阻止业务数据或疑似密钥进入结构快照。
- 提供无密钥生产冒烟测试，检查公开页面、健康接口、安全响应头和错误域名跳转。
- GitHub Actions 每天北京时间 09:15 自动执行生产冒烟检查，失败时保存诊断日志。
- GitHub Actions 在每次推送和 Pull Request 时自动执行 TypeScript、ESLint 与格式门禁。
- 支持通过 Vercel 环境变量发布全站运营公告，可设置提示等级和安全详情链接。
- 站点 URL 已集中由 `NEXT_PUBLIC_SITE_URL` 管理，metadata、robots、sitemap、系统诊断和登录回调不再分别硬编码生产域名。
- 主要生产代码已经提交并推送到 GitHub。

## 3. 主要页面和接口

### 页面

- `/` 首页
- `/login` 登录
- `/auth/callback` 登录回调
- `/chat` AI 聊天
- `/pricing` 套餐价格
- `/orders` 用户充值订单
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
- `/api/admin/system`
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

4. `20260613_chat_ledger_permissions.sql`
   - 为 `service_role` 授予聊天计费账本的服务端管理权限

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
- `ORDER_EXPIRY_HOURS`（可选，默认 24，范围 1–168）
- `RESEND_API_KEY`（可选，启用订单邮件通知）
- `NOTIFICATION_FROM_EMAIL`（可选，已验证的发件地址）

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

1. 2026-06-14 的生产域名 DNS 故障已经恢复；部分本地 DNS 缓存可能仍需刷新，详见 `docs/INCIDENT_LOG.md`。
2. 在 Supabase 生产项目确认已执行：
   - `20260612_recharge_orders.sql`
   - `20260612_recharge_orders_permissions.sql`
3. 确认 `/admin/orders` 可以正常加载订单，不再显示“加载充值订单失败”。
4. 使用非管理员的新邮箱重新发送 Magic Link，确认能完成首次注册并进入聊天页。
5. 使用普通用户完成一次完整流程：
   - 登录
   - 创建充值订单
   - 管理员确认到账
   - 用户点数增加
   - 点数流水出现充值记录
6. 充值订单迁移文件已确认使用 UTF-8 中文文本；生产点数流水仍需在完整充值验收时抽查显示结果。

## 8. 后续开发顺序

1. 由管理员运行 `npm run db:schema:export`，生成并审核生产数据库纯结构快照。
2. 完成普通邮箱注册和充值订单全流程验收。
3. 接入正式在线支付及支付回调。
4. 配置并验收 Resend 订单邮件通知和管理员提醒。
5. 继续完成移动端、性能、备份和异常恢复测试。

## 9. 最近关键提交

- `ccef97b` 完善移动端聊天输入体验
- `e61fcec` 更新移动端首页体验
- `0782551` 改进移动端邮箱登录流程
- `62f430c` 改进移动端运营后台
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

> 请先完整阅读 `RECOVERY_INDEX.md`、`PROJECT_STATUS.md`、`docs/PROJECT_RECOVERY_ARCHIVE.md`、`OPERATIONS.md`、最近的 Git 提交和当前代码，然后继续极智岛 AI 项目。不要读取或输出 `.env.local` 中的密钥。先检查“当前待验证事项”，再按“后续开发顺序”继续。
