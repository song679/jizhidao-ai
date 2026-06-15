# Supabase Schema 快照

本目录用于保存生产数据库 `public` schema 的**纯结构快照**，不保存任何业务数据。

项目脚本使用 Docker 官方 PostgreSQL 镜像运行 `pg_dump`，不依赖本机 PostgreSQL 或 Supabase CLI。执行前需要安装并启动 [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)。

先验证 Docker：

```powershell
docker version
```

如果命令不存在，先安装 Docker Desktop；如果只显示客户端而服务端报错，打开 Docker Desktop 并等待引擎启动。

## 生成快照

推荐使用临时数据库连接变量：

```powershell
# 在 Supabase 项目顶部点击 Connect，复制 Session pooler 连接字符串。
# 保留连接字符串中的 [YOUR-PASSWORD]，密码单独输入，避免特殊字符破坏 URI。
$env:SUPABASE_DB_URL='从 Supabase 控制台复制的 Session pooler 连接 URI'
$securePassword = Read-Host "输入数据库密码" -AsSecureString
$credential = [pscredential]::new("db", $securePassword)
$env:SUPABASE_DB_PASSWORD = $credential.GetNetworkCredential().Password
npm run db:schema:export
Remove-Item Env:SUPABASE_DB_URL,Env:SUPABASE_DB_PASSWORD
Remove-Variable securePassword,credential
```

脚本会：

1. 使用 Docker 官方 PostgreSQL 17 镜像导出 `public` schema。
2. 不使用 `--data-only`，因此不会导出用户、聊天或订单数据。
3. 检测并拒绝 `COPY ... FROM stdin` 数据块；函数定义内部合法的 `INSERT INTO` 不会被误判。
4. 检测常见 API 密钥格式。
5. 检查六张核心业务表是否存在。
6. 生成 SHA256 校验文件。

脚本开始时会检查 Docker 是否已安装并运行。导出失败时会删除未完成的 SQL 文件。

## 自动验证快照

```powershell
npm.cmd run db:schema:validate
```

校验器会验证每份快照的 SHA256、六张核心表、数据库函数和 RLS，并拒绝真实数据块、邮箱、数据库连接 URI、常见 API 密钥和 JWT。GitHub `Code quality` 工作流也会在每次推送和 Pull Request 时自动执行。

## 提交前人工检查

- 文件中应包含表、索引、函数、触发器、权限和 RLS 策略。
- 文件中不应出现真实邮箱、聊天消息、订单记录或点数流水数据。
- 不要提交数据库连接 URI、密码或控制台截图。
- 快照文件应作为恢复参考，不要直接在生产库盲目执行。

## 为什么需要快照

项目早期四张基础表的原始建表 SQL 没有进入 Git。生成完整快照后，才能在现有生产项目损坏时准确恢复结构，而不是根据代码猜测表定义。

参考：[PostgreSQL `pg_dump` 官方文档](https://www.postgresql.org/docs/current/app-pgdump.html)
