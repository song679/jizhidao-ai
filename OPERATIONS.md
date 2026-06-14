# 极智岛 AI 运维与恢复手册

> 本文档不保存任何 API 密钥、数据库密码或用户隐私数据。

## 1. 日常检查

建议每周至少检查一次：

```powershell
npm run test:production
```

该命令不需要登录或密钥，会检查生产公开页面、健康接口、HTTPS 跳转、安全响应头、robots、sitemap 和意外 localhost 地址。

GitHub Actions 中的 `Production smoke check` 会在每天北京时间 09:15 自动执行，也可以在 GitHub → Actions → Production smoke check → Run workflow 手动运行。失败日志保留 14 天；要及时收到通知，需要在 GitHub 账户通知设置中启用 Actions 失败邮件或网页通知。

`Code quality` 工作流会在每次推送 `main` 或创建 Pull Request 时运行 `npm ci`、TypeScript 和 ESLint。它不使用生产密钥，只检查代码质量；该工作流失败时应先修复再继续部署。

如果首先提示 `DNS preflight failed`，不要排查 Next.js 代码；应检查域名是否过期、Nameserver 和 Vercel Domains 要求的 DNS 记录。

如果提示 `Public DNS is healthy, but the Windows resolver still has stale DNS data`，说明公网已经恢复，仅当前电脑仍缓存旧结果。执行 `ipconfig /flushdns`、重启浏览器或临时使用 `1.1.1.1`，不要重复修改 DNS 记录。

自定义域名故障期间，可以用 Vercel 默认生产域名临时检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Test-ProductionSmoke.ps1 `
  -BaseUrl "https://你的项目.vercel.app"
```

如果临时切换正式入口，只需修改 Vercel 的 `NEXT_PUBLIC_SITE_URL` 并重新部署，同时把新地址加入 Supabase Authentication Redirect URLs。站点 metadata、robots、sitemap、系统诊断和新登录邮件都会使用该变量。

1. 打开 `https://www.jizhidao-ai.com/admin/system`。
2. 确认必需环境变量全部显示“已配置”。
3. 确认核心数据库表和订单充值函数均为“正常”。
4. 确认业务数据一致性没有负数余额、滞留扣点或异常订单。
5. 打开 `/admin` 检查退款率、滞留请求和 AI 服务商状态。
6. 打开 `/api/health`，确认返回 `status: healthy`。

## 2. Supabase 暂停后的恢复

1. 登录 Supabase，恢复对应项目。
2. 等待数据库状态恢复为可用。
3. 访问 `/api/health` 检查数据库连接。
4. 访问 `/admin/system` 检查所有表和函数。
5. 分别测试登录、点数查询、AI 聊天和充值订单。

不要重复执行会重置或删除数据的 SQL。

## 3. 数据库备份

### 结构快照

项目仓库提供 `scripts/Export-SupabaseSchema.ps1`，用于导出不含业务数据的 `public` schema：

```powershell
$env:SUPABASE_DB_URL='从 Supabase 控制台复制的数据库连接 URI'
npm run db:schema:export
Remove-Item Env:SUPABASE_DB_URL
```

生成文件位于 `supabase/schema-snapshots/`。提交前必须人工确认没有真实邮箱、聊天内容、订单或连接信息。

### Supabase 控制台备份

- 付费方案优先使用 Supabase Dashboard 提供的数据库备份和时间点恢复功能。
- 免费方案应定期导出关键业务表。

### 建议备份的业务表

- `user_points`
- `point_transactions`
- `chat_sessions`
- `chat_messages`
- `chat_request_ledger`
- `recharge_orders`

认证用户由 Supabase Auth 管理，不应只依赖业务表导出。

### 手动导出注意事项

- 导出文件可能包含邮箱、聊天内容和订单信息，必须加密保存。
- 不要上传到公开 GitHub 仓库。
- 不要通过公开网盘分享。
- 备份完成后记录日期、项目、导出人和文件校验结果。

## 4. 数据恢复原则

1. 先停止管理员充值和订单确认操作。
2. 记录故障发生时间和最后一笔正常业务流水。
3. 优先恢复数据库副本，不直接覆盖当前生产库。
4. 在副本中核对用户余额和点数流水是否一致。
5. 确认恢复点后再执行生产恢复。
6. 恢复后抽查：
   - 用户余额
   - 最近充值订单
   - 点数流水
   - 聊天计费账本

## 5. Vercel 部署故障

1. 在 Vercel Deployments 查看失败日志。
2. 确认当前生产提交与 GitHub `main` 一致。
3. 检查环境变量是否应用到 Production。
4. 环境变量修改后必须重新部署。
5. 新版本异常时，可在 Vercel 将上一个正常部署重新设为 Production。

## 6. 登录故障

检查 Supabase Authentication URL Configuration：

```text
https://www.jizhidao-ai.com/auth/callback
https://www.jizhidao-ai.com/**
```

修改后必须重新发送新的 Magic Link；旧邮件不会自动更新回调地址。

## 7. 订单故障

如果订单表或权限异常，按顺序确认已经执行：

1. `supabase/migrations/20260612_recharge_orders.sql`
2. `supabase/migrations/20260612_recharge_orders_permissions.sql`

不要在未确认收款的情况下手动修改订单为 `paid`。应通过管理员订单页面确认到账，以保证订单、余额和流水原子更新。

## 8. AI 服务故障

1. 在 `/admin/system` 检查对应供应商密钥是否已配置。
2. 在聊天页切换另一模型进行对照测试。
3. 检查 OpenAI 或 DeepSeek 服务状态和账户额度。
4. 用户请求失败时确认预扣点数已经退款。
5. 检查 `/admin` 中的退款率和滞留请求。

## 9. 上线检查清单

- [ ] `npm run test:production` 全部通过
- [ ] 普通新邮箱能够注册登录
- [ ] 手机邮箱 Magic Link 能返回生产网站
- [ ] DeepSeek 模型正常回复
- [ ] OpenAI 模型正常回复
- [ ] 失败请求自动退还点数
- [ ] 用户可以创建和取消订单
- [ ] 管理员可以确认到账并增加点数
- [ ] 用户订单状态与点数流水同步
- [ ] 管理员页面仅管理员可访问
- [ ] `/api/health` 返回正常
- [ ] `/admin/system` 没有必需项异常
- [ ] 用户协议、隐私政策、退款和帮助页面可访问
- [ ] 已完成最近一次数据库备份

## 10. 故障记录

每次生产故障建议记录：

- 发生和恢复时间
- 影响页面及用户范围
- 故障编号
- 根本原因
- 临时处理方法
- 永久修复提交
- 是否需要补偿用户点数
