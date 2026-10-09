# ASCS

ASCS（A Simple Comment System）是一个面向多站点博客的评论服务。它提供 Better Auth 账号认证、OAuth 登录、匿名评论、Markdown、嵌套回复、点赞、审核、封禁、站点隔离、邮件通知和 iframe 嵌入。

默认头像使用 Blobatar，按姓名生成，固定 `shape: 0.11` 并支持鼠标悬停动画。用户可在个人设置中填写自定义头像图片地址。

登录后可通过后台侧栏的“个人设置”或评论区自己的昵称进入 `/profile`，修改昵称、头像、个人网站和简介。无站点权限的账号同样可以使用。头像与网站支持不含内嵌凭据的 HTTP(S) 地址，留空可清除；昵称最多 60 字符，简介最多 500 字符。评论显示账号当前的昵称和头像，昵称可链接到个人网站；简介保存在个人资料中，邮箱仅在本人设置页展示。

## 技术结构

- TanStack Start + TanStack Router + TanStack Query
- Tailwind CSS v4 + Cloudflare Kumo UI
- Drizzle ORM + libSQL/Turso
- Better Auth（SQLite 数据库适配器，邮箱密码，可选 GitHub/Google/Microsoft OAuth）
- Nitro Node server，可用于 Vercel、Docker、VPS

## 本地运行

需要 Node.js 20+ 或 Bun。

```bash
cp .env.example .env.local
# 生成随机密钥：openssl rand -hex 32
# 把 BETTER_AUTH_SECRET 和 CRON_SECRET 填入 .env.local
bun install
bun run db:generate
bun run db:migrate
bun run admin:init # 首次运行前设置 ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
bun run dev
```

打开 http://localhost:3000。开发时可用 `ALLOW_LOCALHOST_SITE=true` 创建 `http://localhost:3000` 或 `http://127.0.0.1` 站点并跳过 DNS 验证；生产环境必须使用 HTTPS 和 DNS TXT 验证。

不要把 `.env.local`、`.env`、数据库文件或真实管理员密码提交到仓库。

## 管理员后台

首次管理员仍通过 `bun run admin:init` 初始化。登录 `/` 后，侧栏提供实例管理入口：

- 系统概览：用户、站点、待审核评论、邮件队列统计。
- 用户管理：搜索与分页、创建账号、编辑昵称/额度/管理员角色、停用和启用、撤销所有登录、删除账号。
- 全部站点：搜索与筛选、全局启停、转移所有权、进入评论管理。
- 系统设置：服务名称、注册开关、新用户默认站点额度、SMTP 及邮件连接测试。
- 邮件队列：发送状态、发送次数、手动发送一批和重新排队。
- 操作日志：用户管理、全局设置、站点创建/转移/启停和邮件运维记录。

普通用户可以在额度内创建站点，管理员不受额度限制。新账号默认额度为 1，设置修改仅影响以后注册的用户；已有账号升级时额度为 0，可在用户管理中逐一调整。站点额度按所有者关系计数，降低额度和停用站点都不会删除数据。转移所有权会替换原所有者，保留审核员；删除拥有站点的用户前必须先转移站点。

注册开关同时限制邮箱注册和 OAuth 新用户创建，已有用户仍可登录。停用账号会撤销登录，服务端再次检查账号状态。不能停用/删除自己的管理员账号或移除自己的管理员权限，系统必须保留有效管理员。

系统配置保存在数据库，敏感字段使用由 `BETTER_AUTH_SECRET` 派生的密钥进行 AES-256-GCM 加密。后台不会回传 SMTP 密码，留空表示保留，使用清除选项显式删除。备份和迁移时需要同时保留原 `BETTER_AUTH_SECRET`；更换密钥前需先解密并重新加密配置。

尚未保存后台设置时，邮件继续使用 `SMTP_URL` 和 `MAIL_FROM` 环境变量；首次保存系统设置后，SMTP 使用后台配置，需一并填好 SMTP 信息或明确关闭。连接测试使用已保存的配置，会实际发送 SMTP 测试邮件。

邮件仍由持久化 outbox 和定时任务发送，每批最多 20 封，最多尝试 5 次。后台手动发送不替代持续运行的定时任务。

## 嵌入博客

在静态博客中放置：

```html
<div id="ascs-comments"></div>
<script
  src="https://comments.example.com/embed.js"
  data-site="站点 ID"
  data-target="ascs-comments"
  data-theme="auto"
  defer
></script>
```

可选属性：`data-url` 覆盖文章 URL，`data-page` 使用不会随 URL 改名的稳定文章 ID，`data-accent` 使用 6 位十六进制品牌色。脚本本身约 2 KB，评论 UI 运行在 sandbox iframe 中，博客 CSS 不会污染评论区。登录时会在服务域名打开顶层弹窗完成认证，成功后自动回到文章页；博客页面无法读取该凭据。首次嵌入前，在后台复制验证 TXT 记录到 `_ascs.<域名>`，再点击“检查验证”。

文章 URL 必须和站点 origin 完全匹配；服务端会重新规范化 URL、校验站点归属和文章标识，不信任脚本传入的权限或用户 ID。

## 环境变量

完整示例见 `.env.example`：

- `DATABASE_URL`：本地 `file:./data/ascs.db`，Turso 使用 `libsql://...`
- `DATABASE_AUTH_TOKEN`：Turso token
- `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`：认证回调地址和至少 32 字符密钥
- `TRUSTED_IP_HEADER`：只有反向代理会覆盖此 header 时才设置，用于限流和封禁 IP
- `ALLOW_LOCALHOST_SITE`：仅开发环境，允许创建 localhost 站点并跳过 DNS 验证
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`、`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`：可选 OAuth（`MICROSOFT_TENANT_ID` 可选，默认 `common`）
- `SMTP_URL`、`MAIL_FROM`：可选 SMTP；站点邮件写入 outbox，由 cron 或 VPS 定时任务发送
- `CRON_SECRET`：至少 32 字符，用于 `/api/v1/cron/mail`
- `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_NAME`：仅 `admin:init` 使用的一次性管理员初始化变量

认证 cookie 使用 HttpOnly、SameSite=Lax；生产环境从 HTTPS URL 自动使用安全 cookie。Better Auth 的表和 ASCS 业务表由同一次 Drizzle 迁移创建。

评论区嵌入在其它域名的页面时，浏览器不会在第三方 iframe 中发送该 cookie（Safari 等还会直接拦截第三方 cookie）。为此，评论区登录会在服务域名的顶层弹窗中完成，再由服务端签发一个 12 小时、可撤销的短期会话凭据，通过 `postMessage` 回传给 iframe；iframe 仅凭该凭据调用公开评论接口。Cookie 属性保持不变，未放宽 SameSite 或 CSRF 保护。

## 部署

### Docker / VPS

```bash
cp .env.example .env
# 设置生产 BETTER_AUTH_URL、BETTER_AUTH_SECRET、CRON_SECRET
# 以及一次性初始化用的 ADMIN_EMAIL、ADMIN_PASSWORD（可选 ADMIN_NAME）
docker compose up -d --build
# 迁移在容器启动时自动执行；管理员必须在容器内的数据库中初始化
docker compose exec ascs npm run admin:init
```

`compose.yaml` 将 `DATABASE_URL` 固定为 `file:/app/data/ascs.db` 并挂载到 `ascs-data` volume。初始化完成后从 `.env` 移除 `ADMIN_PASSWORD` 并重启容器。`compose.yaml` 让容器以非 root 用户运行，并带健康检查。生产 VPS 应在 Nginx/Caddy 后使用 HTTPS；如果配置 IP header，必须让代理覆盖 header 并阻止外部直连容器端口。SMTP outbox 可用 cron 每分钟调用：

```cron
* * * * * curl -fsS -H 'Authorization: Bearer <CRON_SECRET>' https://comments.example.com/api/v1/cron/mail >/dev/null
```

### Vercel

导入仓库，设置 `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、Turso `DATABASE_URL`/`DATABASE_AUTH_TOKEN` 及所需 OAuth、SMTP、`CRON_SECRET`。`vercel.json` 已声明每天运行邮件 outbox；Vercel Cron 需要在项目设置中启用并确保 cron 请求带上配置的授权策略。部署后执行一次：

```bash
bun run db:migrate
ADMIN_EMAIL=... ADMIN_PASSWORD=... bun run admin:init
```

libSQL/Turso 推荐用于 Vercel；本地 SQLite 适合单机 VPS。数据库迁移必须在发布前运行，生产不要使用 `db:push`。

## 安全默认值

匿名评论默认需要审核，所有 mutation 要求 same-origin JSON 请求，公开接口仅返回已发布内容；Markdown 使用 `react-markdown` 且不渲染 raw HTML，链接带 `nofollow noopener noreferrer ugc`；评论内容限制 5,000 字符，回复最多五层，challenge 防止简单机器人，honeypot、屏蔽词、链接数量、重复提交和 libSQL 原子计数限流共同降低垃圾评论。删除评论会清除正文和身份摘要但保留树结构；IP、邮箱只保存 HMAC 摘要。

## 检查与升级

```bash
bun run typecheck
bun run build
```

当前仓库不保留自动化测试代码。功能和安全流程需进行人工验收；类型检查和构建成功不代表业务流程已验证。

升级时先备份 Turso/SQLite 数据库，在 staging 执行 `bun run db:generate` 检查 SQL，再执行 `bun run db:migrate`，最后滚动重启应用。不要直接删除迁移文件；schema 的破坏性变更需要单独的数据迁移。

## 当前边界

邮件使用可靠 outbox 和 SMTP worker，尚未集成模板化邮件供应商；统计包含实例与站点维度的基础聚合，不包含访问量分析；OAuth 需自行配置 provider credentials。操作日志覆盖实例管理操作，不包含所有评论审核与站点成员操作。
