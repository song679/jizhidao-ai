# 极智岛 AI 生产故障记录

> 本文件只记录故障现象、诊断和修复过程，不保存密钥或用户数据。

## INC-20260614-01：生产域名 DNS 不存在

- 发现时间：2026-06-14（北京时间）
- 恢复时间：2026-06-14 14:00 左右（北京时间）
- 状态：已恢复，部分本地递归 DNS 缓存可能仍需等待
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

### 根本原因

Namecheap 域名仍在有效期内，但注册局的 Nameserver 委派一度未正常对公网解析。重新确认使用 `Namecheap BasicDNS` 后，以下记录恢复：

```text
A      @     76.76.21.21
CNAME  www   cname.vercel-dns.com
```

### 恢复验证

- Verisign RDAP：域名有效至 2027-05-12，无 `clientHold`
- 注册局 Nameserver：`dns1.registrar-servers.com`、`dns2.registrar-servers.com`
- Cloudflare `1.1.1.1`：根域名与 `www` 均正常解析
- Google `8.8.8.8`：根域名与 `www` 均正常解析
- 根域名 HTTPS：307 跳转到 `https://www.jizhidao-ai.com/`
- 首页：HTTP 200
- 登录页：HTTP 200
- `/api/health`：`healthy`，数据库为 `ok`
- HTTPS 证书与安全响应头正常

### 处理步骤（历史记录）

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

### 后续注意

部分 Windows 或运营商 DNS 可能继续缓存旧 NXDOMAIN。若浏览器仍打不开，可执行：

```powershell
ipconfig /flushdns
```

或者临时改用 `1.1.1.1` / `1.0.0.1`，不要再次修改已经正确的 DNS 记录。
