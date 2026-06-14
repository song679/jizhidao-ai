# 极智岛 AI 生产故障记录

> 本文件只记录故障现象、诊断和修复过程，不保存密钥或用户数据。

## INC-20260614-01：生产域名 DNS 不存在

- 发现时间：2026-06-14（北京时间）
- 状态：待处理
- 影响：`https://www.jizhidao-ai.com` 及根域名无法通过公网 DNS 解析，用户无法访问正式网站
- 代码影响：未发现代码构建错误；GitHub 仓库和 Vercel 项目与域名 DNS 是不同层级

### 诊断结果

执行生产冒烟测试时，所有请求均返回：

```text
The remote name could not be resolved: 'www.jizhidao-ai.com'
```

随后分别查询系统 DNS 和 Google 公共 DNS `8.8.8.8`：

```text
jizhidao-ai.com       -> NXDOMAIN
www.jizhidao-ai.com   -> NXDOMAIN
```

这说明问题不是浏览器缓存，而是域名注册、Nameserver 或 DNS 记录当前未对公网生效。

### 处理步骤

1. 登录域名注册商，确认 `jizhidao-ai.com` 未过期、未暂停。
2. 确认 Nameserver 与 DNS 托管平台一致。
3. 打开 Vercel → 项目 → Domains，查看域名要求的记录。
4. 在 DNS 平台恢复 Vercel 要求的根域名和 `www` 记录。
5. 若需临时恢复访问，可将 `NEXT_PUBLIC_SITE_URL` 改为 Vercel 默认生产域名并重新部署，同时在 Supabase Authentication Redirect URLs 添加对应 `/auth/callback`。
6. 等待 DNS 生效后运行：

```powershell
npm run test:production
```

7. 全部通过后，将本故障状态改为“已恢复”，并记录恢复时间和根本原因。
