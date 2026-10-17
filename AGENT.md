# AGENT.md

## 项目目标

ASCS（A Simple Comment System）是现代、轻量、安全、易部署的多站点博客评论系统。维护时优先保证真实的数据读写、认证授权、站点隔离、类型安全、可访问性和可部署性；不要用静态原型、模拟数据或仅客户端权限检查代替业务实现。

本文件供编码代理使用。操作前先阅读 `package.json`、`README.md`、`docs/` 和相关模块；实现行为与文档不一致时，以实际代码为核查对象，并同步修正文档。

## 技术栈与包管理

- TanStack Start / Router / Query、React 19、TypeScript strict。
- Tailwind CSS v4、`@cloudflare/kumo`；优先复用 Kumo/Base UI 组件。
- Drizzle ORM、`@libsql/client`（本地 SQLite / 远程 Turso）。
- Better Auth（邮箱密码 + 可选 GitHub/Google/Microsoft OAuth）。
- `react-markdown` + `remark-gfm`、Nodemailer、Nitro。
- 本地使用 bun：`bun install`、`bun run <script>`；Docker 与 Vercel 使用 `npm ci` / `npm run build`（基于 `package-lock.json`）。依赖变更后同时更新 `bun.lock` 和 `package-lock.json`，版本以 lockfile 或实际安装包为准。

## 模块地图

完整职责表见 [`docs/architecture.md`](docs/architecture.md)。

| 路径                                                 | 职责                                                     |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `src/db/`                                            | Drizzle schema 和 libSQL 实例（仅服务端）                |
| `src/lib/`                                           | 校验、API 客户端、鉴权客户端、widget 会话、AI 检测纯逻辑 |
| `src/server/`                                        | 认证授权、限流、评论/站点/邮件/设置/实例管理业务         |
| `src/routes/`                                        | 页面与 `/api/v1/*` 文件路由                              |
| `src/components/admin/`                              | 站点后台（评审、统计、集成、设置、成员）                 |
| `src/components/instance/`                           | 实例后台（用户、站点、邮件、审计、系统设置）             |
| `src/components/`                                    | 评论 widget、认证、个人资料和公共 UI                     |
| `public/embed.js`                                    | 无依赖 iframe 嵌入脚本                                   |
| `scripts/`、`drizzle/`、`Dockerfile`、`compose.yaml` | 初始化/迁移/管理员/邮件、已提交迁移和部署配置            |

`src/routeTree.gen.ts` 由路由生成器维护，不要手动修改。不要编辑 `.output`、`.tanstack`、`.nitro`、`.vercel`、`node_modules` 或生成的报告来修复源代码问题。

## 开发命令

开发端口为 3000。首次运行需要 Node.js、配置文件和数据库迁移。

```bash
bun install
bun run setup                 # 可选：生成带随机密钥的 .env.local，不覆盖已有文件
bun run db:migrate
ADMIN_EMAIL=... ADMIN_PASSWORD=... bun run admin:init
bun run dev
```

修改后运行：

```bash
bun run generate-routes
bun run typecheck
bun run lint
bun run check
bun run build
```

生产 Node 产物在 `.output/`（不是 `dist/`），用 `bun run start` 启动。仓库不含自动化测试，`typecheck`、`lint`、`check`、`build` 通过不代表业务流程已验证。

## 必须保持的安全约束

### 认证和权限

- 用户身份只能来自 Better Auth 验证后的 session，不可信任请求中的 `userId`、昵称、角色或审核状态。
- 管理接口独立调用服务端 session 和站点权限检查；前端隐藏按钮不是授权。
- 实例管理员可不限额度创建站点，普通用户受账号 `siteLimit` 限制；所有权转移同样检查新所有者额度。所有者管理配置、验证和成员，审核员只能进行获授权的站点操作。
- 不能停用/删除自己的管理员账号或移除自己的管理员权限，系统必须保留有效管理员。
- 审核、删除、封禁或点赞的数据库条件必须同时约束资源 ID 和站点归属；公共评论操作还须校验文章标识。
- 不允许普通用户通过注册、客户端字段或未认证的初始化接口成为管理员；初始化已有管理员账号时必须验证密码。
- 跨站评论凭据只能由服务端在验证 cookie 会话后签发，短有效期、随会话撤销，且仅适用于公开评论接口；`requireSession` 拒绝带 bearer 的请求。
- 不要关闭 Better Auth 的 CSRF、来源检查或 cookie 安全保护；OAuth provider credentials 必须仅留在服务端。

### 站点和文章隔离

- 公开评论服务必须要求站点已通过域名验证；公开站点使用 HTTPS，localhost 豁免只用于显式启用的非生产环境。
- `pageUrl` 的 origin 必须与已保存的站点 origin 完全相同；拒绝非 HTTP(S) 协议和 URL 内嵌凭据。
- URL 默认去除 fragment；`pageKey` 可提供稳定文章 ID，但不能绕过 URL 归属检查。
- 回复父评论必须属于同站点、同文章且已发布；最多五层，`depth` 为 0 到 4。
- 权限和隔离必须出现在服务端查询条件中，不能只在返回数据后由客户端过滤。

### 输入、隐私和滥用防护

- 所有外部输入使用 Zod 校验；保持正文 5,000 字符、请求体 24,000 字节及分页边界限制。
- mutation 要求可信 same-origin 和 `application/json`；邮件 cron 使用独立 Bearer secret。
- 评论者邮箱和 IP 在评论表中仅保存带服务端密钥的 HMAC 摘要；账号邮箱、邀请邮箱和邮件 outbox 收件地址按明文保存但只在服务端使用。公开响应不返回 HMAC 摘要、原始邮箱、IP 或 OAuth token。
- 原子限流存储在数据库，不能替换为仅进程内 Map，也不能采用非原子的“先读取再增加”。
- `TRUSTED_IP_HEADER` 只有在可信入口覆盖该 header 且禁止绕过入口时才可配置。
- 保持 challenge 签名、最短提交等待、honeypot、重复提交检测、链接数量检查及站点屏蔽词。
- AI 反垃圾检测（可选）只在服务端运行：`DECISION_API_KEY` 只放服务端环境变量、不用公开前缀；只发送评论正文与公开上下文，不发送邮箱、IP 或其 HMAC；不可信内容围栏为数据；启用时以 AI 决策为准（`approved`→直接发布，`review`→待审核，`quarantined`→垃圾/隔离），站点 `moderation` 策略仅在 AI 关闭时生效，`unavailable` 统一由 `SPAM_FAIL_MODE` 决定；任何单一分数都不直接永久删除评论。
- 匿名评论默认审核，垃圾评论不公开；删除评论清除正文和身份信息，仅当层级下仍有可见回复时保留“评论已删除”占位，没有任何可见回复的删除评论直接不展示。
- 不记录密码、密钥、session token、数据库 token 或 SMTP 凭据到日志、文档、测试报告或版本控制。

### XSS 和嵌入

- 评论使用统一的 `Markdown` 组件。禁止启用 raw HTML、未经审计的 `rehype-raw` 或对评论使用 `dangerouslySetInnerHTML`。
- 用户链接维持安全 URL 处理以及 `nofollow noopener noreferrer ugc`；评论图片默认不加载，以避免跟踪。
- 管理页面禁止 iframe 嵌入；widget 的 CSP `frame-ancestors` 仅允许对应已验证站点和自身。
- `postMessage` 必须校验 `origin` 和 `source`；登录凭据消息还要校验类型、一次性 `state` 与 token，iframe 高度消息还要校验类型、站点 ID 并限制高度范围。禁止宽泛使用 `*` 作为消息目标。
- 保持 iframe sandbox。登录必须在服务域名的顶层窗口完成（`/widget-login`），短期限凭据经 `postMessage` 回传；不要为兼容性关闭 CSRF 或全局放宽 cookie。

## 代码和 UI 约定

- 优先已有模块、组件和 helper；保持修改范围聚焦，避免不必要的依赖与过度抽象。
- 业务数据库、认证配置和环境密钥只用于服务端；客户端引用服务端推导类型时使用 `import type`。
- Query key 包含站点、文章、父评论、排序和分页等依赖；mutation 成功后失效相关缓存；QueryClient 不可在 SSR 请求间共享。
- widget 路由启用 SSR 与 loader 预取：`embed` 参数决定内嵌或顶层布局，服务端与首次客户端渲染必须一致；SSR 不得依赖浏览器状态，主题/时间/localStorage 在挂载后处理。
- 尽量使用 Kumo Input、Button、Dialog 等组件；图标使用项目现有 Phosphor 图标库。
- Dialog 保持挂载，以 `open` 控制状态；图标按钮必须提供可访问名称和 tooltip/title。
- 正文及控件通常为 14px，标题使用适度大小和 `font-semibold`；不要随意改变字距。
- 后台采用紧凑、可扫描的工作界面，不增加营销首页、巨型 hero 或装饰性嵌套卡片。
- 必须处理加载、空状态、错误和 mutation pending 状态；禁止只完成成功路径。
- 验证桌面与移动端无横向溢出、遮挡和文本重叠；不能只依赖截图生成成功来宣称视觉检查通过。
- 不撤销、覆盖或删除不属于本次工作的用户改动。

## 数据库和部署

- 本地数据库默认 `file:./data/ascs.db`，Turso 使用 `libsql://...` 和 `DATABASE_AUTH_TOKEN`。
- schema 修改后使用 `bun run db:generate`，检查 SQL 后再提交迁移与元数据；生产不要用 `db:push` 替代受控迁移。
- 升级前备份数据库；不要删除旧迁移、改写已应用的迁移或重置生产数据库。
- Docker 使用非 root 用户和持久化 volume，启动时执行迁移；管理员必须初始化在容器实际使用的数据库中。
- `BETTER_AUTH_URL` 必须匹配公开服务域名，生产密钥必须重新生成。OAuth callback 为 `/api/auth/callback/{github,google,microsoft}`。
- 邮件 outbox 通过 `bun run mail:flush` 或受保护的 `/api/v1/cron/mail` 发送；SMTP 是至少一次投递，worker 每批最多 20 封。
- `.env.example` 只放变量说明和空凭据；不要覆盖已存在的 `.env.local` 或 `.env`。
- 构建期通过 Nitro `compressPublicAssets` 生成预压缩产物；`/embed.js` 的缓存头在 `vite.config.ts` 的 routeRules 中设置。

## 验证状态

- 修改后重新运行 typecheck、lint、check 和 build；构建应保持零告警。
- `vite.config.ts` 的 Nitro `onwarn` 只抑制第三方依赖的 `use client`/`use server` 指令告警及已知噪声。
- Docker 实际构建运行、Vercel 部署、真实 DNS 验证、Turso 远程连接、SMTP 实际送达、真实 OAuth 登录和浏览器 UI 验收默认未执行，未验证的项目要如实标注。

## 特别的

- 不要新增自动化测试（含 UI 单元测试）；列出本次改动受影响的 UI 和手工验证 Todo list，由用户自行验证。
- 不要主动做 e2e 测试。
- README 是入口，专题说明放 `docs/`；AGENT 只保留代理必要信息，不恢复历史测试命令或通用行为准则。
