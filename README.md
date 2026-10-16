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

需要 Node.js 22.12+（推荐 24，与 `.nvmrc`、Docker 镜像一致）或 Bun。

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

可选属性：`data-url` 覆盖文章 URL，`data-page` 使用不会随 URL 改名的稳定文章 ID，`data-title` / `data-description` 提供文章标题和摘要（仅用于 AI 反垃圾检测判断相关性，可省略），`data-accent` 使用 6 位十六进制品牌色，`data-border` 为评论区添加边框和圆角（设为 `false` 关闭），`data-background` 设置背景色（`#rgb` / `#rrggbb`，或带透明通道的 `#rgba` / `#rrggbbaa`）或 http/https 背景图片，`data-background-opacity`（0 到 1）统一调整背景透明度。脚本本身约 2 KB，评论 UI 运行在 sandbox iframe 中，博客 CSS 不会污染评论区。登录时会在服务域名打开顶层弹窗完成认证，成功后自动回到文章页；博客页面无法读取该凭据。首次嵌入前，在后台复制验证 TXT 记录到 `_ascs.<域名>`，再点击“检查验证”。

文章 URL 必须和站点 origin 完全匹配；服务端会重新规范化 URL、校验站点归属和文章标识，不信任脚本传入的权限或用户 ID。

## 环境变量

完整示例见 `.env.example`：

- `DATABASE_URL`：本地 `file:./data/ascs.db`，Turso 使用 `libsql://...`
- `DATABASE_AUTH_TOKEN`：Turso token
- `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`：认证回调地址和至少 32 字符密钥
- `TRUSTED_IP_HEADER`：只有反向代理会覆盖此 header 时才设置，用于限流和封禁 IP
- `ALLOW_LOCALHOST_SITE`：仅开发环境，允许创建 localhost 站点并跳过 DNS 验证
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`、`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`：可选 OAuth（`MICROSOFT_TENANT_ID` 可选，默认 `common`）
- `SMTP_URL`、`MAIL_FROM`：SMTP；注册需要邮箱验证，因此正式环境必须配置。站点邮件与验证邮件写入 outbox，由 cron 或 VPS 定时任务发送
- `CRON_SECRET`：至少 32 字符，用于 `/api/v1/cron/mail`
- `CAP_SITE`、`CAP_KEY`：可选 [Cap](https://github.com/tiagozip/cap) 人机验证。二者都设置后，邮箱注册、邮箱登录、重置密码和发布评论都需要通过验证；`CAP_SITE` 为 `https://<instance_url>/<site_key>/`，`CAP_KEY` 为该站点 key 的 secret（不是管理后台密码）。服务端通过 `CAP_SITE` 下的 `siteverify` 校验 token，Cap 实例需允许本站域名的跨域请求。前端的人机验证 WASM 求解器从 `CAP_SITE` 去掉站点 key 得到的实例地址下的 `/assets` 加载，因此 Cap 实例需开启资源服务（`ENABLE_ASSETS_SERVER=true`；`hashwx.wasm` 需要 `@cap.js/wasm` 0.0.8 及以上），并允许本站域名跨域访问 `cap_wasm_bg.wasm` / `hashwx.wasm`
- `ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_NAME`：仅 `admin:init` 使用的一次性管理员初始化变量
- `DECISION_API_KEY` 等 AI 反垃圾评论检测变量：可选，设置 `DECISION_API_KEY` 即启用，详见下一节

认证 cookie 使用 HttpOnly、SameSite=Lax；生产环境从 HTTPS URL 自动使用安全 cookie。Better Auth 的表和 ASCS 业务表由同一次 Drizzle 迁移创建。

评论区嵌入在其它域名的页面时，浏览器不会在第三方 iframe 中发送该 cookie（Safari 等还会直接拦截第三方 cookie）。为此，评论区登录会在服务域名的顶层弹窗中完成，再由服务端签发一个 12 小时、可撤销的短期会话凭据，通过 `postMessage` 回传给 iframe；iframe 仅凭该凭据调用公开评论接口。Cookie 属性保持不变，未放宽 SameSite 或 CSRF 保护。

## AI 反垃圾评论检测

ASCS 内置可选的 AI 反垃圾评论检测。它在本地规则（屏蔽词、链接数量、蜜罐、challenge、限流、重复提交）之后运行，对评论做语义判断，并用可配置阈值决定自动通过、人工审核还是隔离。

### 为什么选用 decision.vllm-sr.ai 与 `vllm-sr/d3`

- [decision.vllm-sr.ai](https://decision.vllm-sr.ai) 提供**免费**的 System One 决策 API：一次请求对同一段输入回答多个**带校准概率**的固定选择题，正好适合“这条评论是不是垃圾、是不是推广、风险多高”这类结构化判断，比生成式模型延迟更低、输出更可控。
- `vllm-sr/d3` 是该服务文本榜上最强的 27B 模型（文本 66.26 / 视觉 71.26），对多语言垃圾、伪装推广与正常外链的区分更稳。需要更轻量时可换成同系列 `vllm-sr/d3-flash`、`d3-mini`、`d3-nano` 等，仅需改 `DECISION_MODEL`。
- **免费获取 key**：打开 <https://decision.vllm-sr.ai> 一键创建（key 只显示一次）。限额与每日配额见 <https://decision.vllm-sr.ai/docs#rate-limits>，按 key 与来源地址分别限流，日内配额 UTC 0 点重置（`429` 会带 `Retry-After`）。
- 该服务会记录请求与响应并可能用于模型改进，**请勿发送敏感个人信息**。ASCS 只发送：评论正文、文章 URL/标题/摘要、作者公开昵称与账号类型、作者在本站的评论计数、父评论正文/作者、评论中的链接。**不发送**邮箱、IP 或它们的 HMAC 摘要。

### 工作方式

- 一次请求用 System One 的 `choice` / `noul` / `score` 三类问题评估：`classification`（`normal` / `promotion` / `seo` / `flood` / `keyword_stuffing` / `other_spam`）、`spam`、`promotion`、`relevance`、`risk`，以及是否试图操纵审核系统的 `manipulation`。
- 评论正文、标题、摘要等不可信内容被围栏标记为“仅数据”，模型输出结构固定，提示词注入无法改变解析 schema（只能试图影响概率），`manipulation` 问题和高风险回退到人工审核进一步兜底。
- 决策综合分类概率、垃圾概率、推广概率、风险评分与结果完整性：

| 状态          | 何时产生                                                                                            | 数据库 `status`                             |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `approved`    | 垃圾概率与推广/风险都低、正常分类概率高且分类为 `normal`（仍受站点审核策略约束）                    | `approved`（或站点策略的 `pending`）        |
| `review`      | 疑似推广、风险偏高、疑似注入、置信度不足、结果冲突或字段缺失                                        | `pending`                                   |
| `quarantined` | 垃圾概率 ≥ `SPAM_AUTO_QUARANTINE_THRESHOLD` 且垃圾分类概率 ≥ `SPAM_AUTO_QUARANTINE_CLASS_THRESHOLD` | `spam`（隔离，可在后台恢复）                |
| `unavailable` | 配置错误、超时、限流、HTTP 错误、无效 JSON 等                                                       | 由 `SPAM_FAIL_MODE` 决定 `pending` / `spam` |

- 本地规则优先且不会被 AI 放宽；AI 只会让结果更严格——自动通过仍遵循站点自身审核策略（“全部审核”不会被绕过）。**任何单一分数都不会直接永久删除评论。**

### 环境变量

除 `DECISION_API_KEY` 外均有默认值。设置 `DECISION_API_KEY` 即启用；也可用 `SPAM_DETECTION_ENABLED` 显式开关。所有变量只在服务端解析、类型转换、默认值处理与校验；非法值会抛出明确错误（检测关闭时不校验其余变量）。布尔仅接受 `true/false`（也接受 `1/0`）。

| 变量                                   | 必填 | 默认值                                     | 可选范围                               | 说明                                          |
| -------------------------------------- | ---- | ------------------------------------------ | -------------------------------------- | --------------------------------------------- |
| `DECISION_API_KEY`                     | 是   | 无（未设置则不启用）                       | `sk-vsr-...`                           | System One API 密钥，服务端专用，勿泄露或提交 |
| `DECISION_API_URL`                     | 否   | `https://decision.vllm-sr.ai/v1/systemone` | http(s) URL，无凭据                    | 请求地址；仅自建/代理时修改                   |
| `DECISION_MODEL`                       | 否   | `vllm-sr/d3`                               | 服务发布的模型 ID                      | 使用的模型                                    |
| `SPAM_DETECTION_ENABLED`               | 否   | 设置了 key 时为 `true`，否则 `false`       | `true` / `false`                       | 是否启用 AI 检测                              |
| `SPAM_DETECTION_TIMEOUT_MS`            | 否   | `15000`                                    | `1`–`120000` 整数                      | 单次请求超时                                  |
| `SPAM_DETECTION_MAX_RETRIES`           | 否   | `1`                                        | `0`–`10` 整数                          | 可重试错误的最大重试次数                      |
| `SPAM_DETECTION_MAX_CONTENT_LENGTH`    | 否   | `10000`                                    | `1`–`200000` 整数                      | 送入检测的评论正文最大长度                    |
| `SPAM_AUTO_QUARANTINE_THRESHOLD`       | 否   | `0.95`                                     | `0`–`1`                                | 自动隔离所需垃圾概率                          |
| `SPAM_AUTO_QUARANTINE_CLASS_THRESHOLD` | 否   | `0.80`                                     | `0`–`1`                                | 自动隔离所需的垃圾分类概率                    |
| `SPAM_AUTO_APPROVE_THRESHOLD`          | 否   | `0.05`                                     | `0`–`1`                                | 自动通过所需的最大垃圾概率                    |
| `SPAM_AUTO_APPROVE_NORMAL_THRESHOLD`   | 否   | `0.90`                                     | `0`–`1`                                | 自动通过所需的最小正常分类概率                |
| `SPAM_PROMOTION_REVIEW_THRESHOLD`      | 否   | `0.80`                                     | `0`–`1`                                | 触发人工审核的推广概率                        |
| `SPAM_RISK_REVIEW_THRESHOLD`           | 否   | `3`                                        | `0`–`10`                               | 触发人工审核的风险分数（0–5 量表）            |
| `SPAM_FAIL_MODE`                       | 否   | `review`                                   | `review` / `quarantine`                | 检测不可用时的处理：保持待审核，或安全隔离    |
| `SPAM_LOG_LEVEL`                       | 否   | `info`                                     | `silent`/`error`/`warn`/`info`/`debug` | 审核模块日志级别                              |
| `SPAM_CACHE_TTL_SECONDS`               | 否   | `300`                                      | `0`–`86400` 整数                       | 相同内容检测结果缓存秒数，`0` 关闭缓存        |

日志只记录状态、原因码、概率、模型版本、策略版本与延迟；不会记录 API key、正文全文或私密标识。密钥不使用 `VITE_` 等公开前缀，因此不会进入客户端代码或打包产物。

### 缓存、重试与失败

- 缓存键是“内容 + 上下文”的指纹哈希（正文、文章 URL/标题/摘要、作者公开资料与站内历史、父评论、链接、模型与问题集版本）。因此修改评论或换文章会得到新键，不会跨文章或跨上下文错误复用。仅缓存可用的决策（`approved`/`review`/`quarantined`），不缓存 `unavailable`。
- 仅对可重试错误（网络/超时、`429`、`5xx`、无效 JSON）做有限次指数退避重试，并遵守 `Retry-After`（上限 2 秒）；`4xx`（除 `429`）不重试。
- 全部失败或响应结构无效 → `unavailable`，按 `SPAM_FAIL_MODE` 处理，绝不静默自动通过。

### 本地与生产配置

- **本地**：`cp .env.example .env.local`，填入 `DECISION_API_KEY=sk-vsr-...`，重启 `bun run dev` 即启用。未填 key 时检测保持关闭，评论按原有本地规则与站点审核策略处理。
- **Docker / VPS**：写入 `.env`（`compose.yaml` 会注入容器）或服务器环境变量。
- **Vercel / PaaS**：在项目环境变量设置中注入；不要在客户端使用这些变量，也不要把真实 `.env` 提交到版本控制。

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

匿名评论默认需要审核，所有 mutation 要求 same-origin JSON 请求，公开接口仅返回已发布内容；Markdown 使用 `react-markdown` 且不渲染 raw HTML，链接带 `nofollow noopener noreferrer ugc`；评论内容限制 5,000 字符，回复最多五层，challenge 防止简单机器人，honeypot、屏蔽词、链接数量、重复提交和 libSQL 原子计数限流共同降低垃圾评论。启用 AI 检测后，语义判断由服务端在本地规则之后执行，只向第三方发送评论正文与公开上下文（不含邮箱、IP），API key 仅存于服务端环境变量。删除评论会清除正文和身份摘要但保留树结构；IP、邮箱只保存 HMAC 摘要。

## 检查与升级

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

`bun run test` 运行 AI 反垃圾评论模块的单元测试（环境变量解析、响应解析、决策、缓存与失败模式），使用 Node 内置测试运行器和模拟响应，不调用外部 API。其余功能和安全流程需进行人工验收；类型检查和构建成功不代表业务流程已验证。

升级时先备份 Turso/SQLite 数据库，在 staging 执行 `bun run db:generate` 检查 SQL，再执行 `bun run db:migrate`，最后滚动重启应用。不要直接删除迁移文件；schema 的破坏性变更需要单独的数据迁移。

## 当前边界

邮件使用可靠 outbox 和 SMTP worker，尚未集成模板化邮件供应商；统计包含实例与站点维度的基础聚合，不包含访问量分析；OAuth 需自行配置 provider credentials。操作日志覆盖实例管理操作，不包含所有评论审核与站点成员操作。AI 反垃圾检测依赖第三方服务（decision.vllm-sr.ai），其可用性、限额与数据保留策略由该服务决定；阈值默认值尚未基于真实审核数据校准。
