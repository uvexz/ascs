# 环境变量与认证配置

复制 `.env.example` 为 `.env.local`（本地）或 `.env`（Docker），按需填写。带注释的完整模板以 [`.env.example`](../.env.example) 为准。

## 核心配置

- `DATABASE_URL`：本地默认 `file:./data/ascs.db`；Turso 使用 `libsql://...`。
- `DATABASE_AUTH_TOKEN`：Turso 认证 token，本地 SQLite 留空。
- `BETTER_AUTH_URL`：认证回调与站点地址，生产必须是公开 HTTPS 域名。
- `BETTER_AUTH_SECRET`：至少 32 字符的随机密钥，用于会话、HMAC 和系统设置加密；生产必须重新生成并长期保留。
- `CRON_SECRET`：至少 32 字符，用于保护 `/api/v1/cron/mail`。
- `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_NAME`：仅 `admin:init` 使用的一次性管理员初始化变量，初始化后移除 `ADMIN_PASSWORD`。

## 请求来源与本地开发

- `TRUSTED_IP_HEADER`：**生产环境必须设置**（例如 `x-forwarded-for`），且代理必须覆盖而不是追加该 header。未设置时所有访客会被归入同一个 `unknown` IP，登录、注册、评论和 API 的全部按 IP 限流会退化成全实例共享桶，单个人即可让全站不可用。该 header 只接受单个合法 IP，多值链会被视为不可信。
- `ALLOW_LOCALHOST_SITE`：仅开发环境，允许创建 localhost 站点并跳过 DNS 验证；生产环境必须使用 HTTPS 和 DNS TXT 验证。

## OAuth（可选）

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`，`MICROSOFT_TENANT_ID` 可选，默认 `common`

OAuth callback 为 `/api/auth/callback/github`、`/api/auth/callback/google` 或 `/api/auth/callback/microsoft`。provider credentials 只能留在服务端。

## 邮件

- `SMTP_URL`、`MAIL_FROM`：SMTP 兜底配置，后台未启用 SMTP 时使用，两者需同时设置。凭据需 URL 编码，隐式 TLS 用 `smtps://`。
- 注册需要邮箱验证，正式环境至少要配置一种发信方式；后台 SMTP 配置优先于环境变量，见 [管理员后台](./admin.md#系统设置与邮件)。

## Cap 人机验证（可选）

`CAP_SITE`、`CAP_KEY` 二者都设置后，邮箱注册、邮箱登录、重置密码和发布评论都需要通过验证。

- `CAP_SITE` 为 `https://<instance_url>/<site_key>/`，`CAP_KEY` 为该站点 key 的 secret（不是管理后台密码）。
- 服务端通过 `CAP_SITE` 下的 `siteverify` 校验 token，Cap 实例需允许本站域名的跨域请求。
- 前端的人机验证 WASM 求解器从 `CAP_SITE` 去掉站点 key 得到的实例地址下的 `/assets` 加载，因此 Cap 实例需开启资源服务（`ENABLE_ASSETS_SERVER=true`；`hashwx.wasm` 需要 `@cap.js/wasm` 0.0.8 及以上），并允许本站域名跨域访问 `cap_wasm_bg.wasm` / `hashwx.wasm`。

## AI 反垃圾评论检测（可选）

设置 `DECISION_API_KEY` 即启用，完整变量、阈值和失败模式见 [AI 反垃圾评论检测](./moderation.md)。

## 认证 Cookie 与跨站会话

认证 cookie 使用 HttpOnly、SameSite=Lax；生产环境从 HTTPS URL 自动使用安全 cookie。Better Auth 的表和 ASCS 业务表由同一次 Drizzle 迁移创建。

跨站 iframe 的登录流程、短期凭据和拒绝规则见 [安全模型与上线检查](./security.md) 与 [嵌入博客](./embed.md#跨站登录)。
