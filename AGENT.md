# AGENT.md

## 项目目标

ASCS（A Simple Comment System）是现代、轻量、安全、易部署的多站点博客评论系统。维护时优先保证真实的数据读写、认证授权、站点隔离、类型安全、可访问性和可部署性。不要用静态原型、模拟数据或仅客户端权限检查代替业务实现。

本文件供后续编码代理使用。操作前先阅读 `package.json`、`README.md` 和相关模块；实现行为与文档不一致时，以实际代码为核查对象，并同步修正文档。

## 技术栈

- TanStack Start、TanStack Router：全栈应用和文件路由。
- TanStack Query：服务端状态、缓存和 mutation 后的精确失效。
- React 19、TypeScript strict。
- Tailwind CSS v4、`@cloudflare/kumo`：优先复用 Kumo/Base UI 的组件。
- Drizzle ORM、`@libsql/client`：本地 SQLite 和远程 Turso。
- Better Auth：数据库 session、邮箱密码、可选 GitHub/Google/Microsoft OAuth。
- `react-markdown`、`remark-gfm`：安全 Markdown 渲染。
- Nodemailer：SMTP；数据库 outbox 负责持久化、重试和任务租约。
- Nitro：Node server 和 PaaS 部署适配。

依赖的实际版本应从 lockfile 或安装后的包核实，不要只根据 `package.json` 的版本范围推断 API。仓库同时存在 `package-lock.json` 和 `bun.lock`，两者都要保持同步；Docker 与 Vercel 使用 `npm ci` / `npm run build`（基于 `package-lock.json`），本地开发可用 bun。依赖变更后必须同时更新两个 lockfile。

## 模块地图

| 路径                                | 职责                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `src/db/schema.ts`                  | Better Auth 表、站点、成员、评论、点赞、封禁、限流、邮件队列 |
| `src/db/index.ts`                   | libSQL client 和 Drizzle 实例，仅服务端使用                  |
| `src/lib/auth.ts`                   | Better Auth 服务端配置和数据库适配                           |
| `src/lib/auth-client.ts`            | 浏览器认证客户端                                             |
| `src/lib/validation.ts`             | Zod 输入校验、共享枚举和分页常量                             |
| `src/lib/api.ts`                    | 浏览器 fetch、错误类型、查询参数编码                         |
| `src/lib/cache.ts`                  | TanStack Query 缓存失效 helper                               |
| `src/lib/system-settings.ts`        | 系统设置的类型、默认值和 Zod schema                          |
| `src/server/security.server.ts`     | session、站点授权、来源检查、HMAC、原子限流、challenge       |
| `src/server/http.server.ts`         | 请求体读取、查询参数解析和 JSON 响应 helper                  |
| `src/server/api.server.ts`          | `/api/v1/*` 分发及评论、站点管理业务                         |
| `src/server/profile.server.ts`      | 个人资料、账户绑定和邮箱变更服务                             |
| `src/server/mail.server.ts`         | 持久化邮件 outbox 和 SMTP worker                             |
| `src/start.ts`                      | 请求中间件和安全响应头                                       |
| `src/router.tsx`                    | 每个 router 独立的 QueryClient                               |
| `src/routes/`                       | 页面和 API 文件路由                                          |
| `src/components/admin-app.tsx`      | 多站点管理、审核、统计、配置、成员、封禁                     |
| `src/components/admin/`             | 站点后台子模块（评审、统计、集成、设置、成员、站点选择）     |
| `src/components/instance-admin.tsx` | 实例概览、用户管理、全站管理、系统设置、邮件队列和操作日志   |
| `src/components/instance/`          | 实例后台子模块（用户、站点、邮件、审计、系统设置）           |
| `src/server/admin.server.ts`        | 实例管理员接口、用户/站点/邮件运维与审计                     |
| `src/server/settings.server.ts`     | 加密系统设置、脱敏读取和注册策略                             |
| `src/components/comment-widget.tsx` | 评论表单、回复、分页、排序、点赞和嵌入状态                   |
| `src/components/markdown.tsx`       | 统一安全 Markdown 渲染                                       |
| `src/components/`                   | 认证、个人资料和公共 UI 组件                                 |
| `src/styles.css`                    | Tailwind/Kumo 导入、应用样式和响应式布局                     |
| `public/embed.js`                   | 无依赖 iframe 嵌入脚本和高度消息校验                         |
| `scripts/`                          | 环境初始化、数据库迁移、管理员初始化、邮件发送               |
| `drizzle/`                          | 已提交的迁移 SQL 和元数据                                    |
| `Dockerfile`、`compose.yaml`        | 自托管容器、数据 volume 和健康检查                           |
| `vercel.json`                       | Vercel 构建命令和邮件 cron                                   |

`src/routeTree.gen.ts` 由路由生成器维护，不要手动修改。不要编辑 `.output`、`.tanstack`、`.nitro`、`.vercel`、`node_modules` 或生成的报告来修复源代码问题。

## 开发命令

默认开发端口为 3000。首次运行需要 Node.js、配置文件和数据库迁移。

```bash
bun install
bun run setup
# 检查 .env.local；已有文件不会被 setup 覆盖。
bun run db:migrate
# 在环境中设置 ADMIN_EMAIL、ADMIN_PASSWORD 和可选 ADMIN_NAME。
bun run admin:init
bun run dev
```

常用验证：

```bash
bun run generate-routes
bun run typecheck
bun run lint
bun run check
bun run build
```

生产 Node 产物在 `.output/`，不是 `dist/`：

```bash
bun run build
bun run start
```

## 必须保持的安全约束

### 认证和权限

- 用户身份只能来自 Better Auth 验证后的 session，不可信任请求中的 `userId`、昵称、角色或审核状态。
- 管理接口独立调用服务端 session 和站点权限检查。前端隐藏按钮不是授权。
- 实例管理员可不限额度创建站点，普通用户只能在账号 `siteLimit` 范围内创建；所有权转移同样检查新所有者额度。站点所有者管理配置、验证和成员；审核员只能进行获授权的站点操作。
- 对评论执行审核、删除、封禁或点赞时，数据库条件必须同时约束资源 ID 和站点归属；公共评论操作还须校验文章标识。
- 不允许普通用户通过注册、客户端字段或未认证的初始化接口成为管理员。
- 初始化已有管理员账号时必须验证密码，不能只凭邮箱直接提权。
- 不要关闭 Better Auth 的 CSRF、来源检查或 cookie 安全保护。OAuth provider credentials 必须仅留在服务端。

### 站点和文章隔离

- 公开评论服务必须要求站点已通过域名验证。
- 公开站点使用 HTTPS；localhost 的 DNS 验证豁免只可用于显式启用的非生产环境。
- `pageUrl` 的 origin 必须与已保存的站点 origin 完全相同；拒绝非 HTTP(S) 协议和 URL 内嵌凭据。
- URL 默认去除 fragment；`pageKey` 可提供稳定文章 ID，但不能绕过 URL 归属检查。
- 回复父评论必须属于同站点、同文章且已发布；最多五层，`depth` 为 0 到 4。
- 权限和隔离必须出现在服务端查询条件中，不能只在返回数据后由客户端过滤。

### 输入、隐私和滥用防护

- 所有外部输入使用 Zod 校验；保持正文 5,000 字符、请求体 24,000 字节及分页边界限制。
- mutation 要求可信 same-origin 和 `application/json`。邮件 cron 使用独立 Bearer secret，不套用浏览器 mutation 的来源规则。
- 邮箱和 IP 仅保存带服务端密钥的 HMAC 摘要；公开响应不返回这些摘要、原始邮箱、IP 或 OAuth token。
- 原子限流存储在数据库，不能替换为仅进程内 Map，也不能采用非原子的“先读取再增加”。
- `TRUSTED_IP_HEADER` 只有在可信入口覆盖该 header 且禁止绕过入口时才可配置。未配置时使用共享保守限流，不能直接信任任意代理 header。
- 保持 challenge 签名、最短提交等待、honeypot、重复提交检测、链接数量检查及站点屏蔽词。
- 匿名评论默认审核；垃圾评论不公开。
- 删除评论清除正文和身份信息，保留树节点以维持回复结构；已删除评论不能直接重新批准。
- 不记录密码、密钥、session token、数据库 token 或 SMTP 凭据到日志、文档、测试报告或版本控制。

### XSS 和嵌入

- 评论使用统一的 `Markdown` 组件。禁止启用 raw HTML、未经审计的 `rehype-raw` 或对评论使用 `dangerouslySetInnerHTML`。
- 用户链接维持安全 URL 处理以及 `nofollow noopener noreferrer ugc`；评论图片默认不加载，以避免跟踪。
- 管理页面禁止 iframe 嵌入。widget 的 CSP `frame-ancestors` 仅允许对应已验证站点和自身。
- `postMessage` 必须检查 `origin`、`source`、消息类型、站点 ID 和高度范围；禁止宽泛使用 `*` 作为消息目标。
- 保持 iframe sandbox。跨站浏览器可能阻止第三方 cookie，登录流程需允许在服务域名的顶层窗口完成；不要为兼容性关闭 CSRF 或全局放宽 cookie。

## 代码和 UI 约定

- 优先已有模块、组件和 helper；保持修改范围聚焦，避免不必要的依赖与过度抽象。
- 业务数据库、认证配置和环境密钥只用于服务端。客户端引用服务端推导类型时使用 `import type`。
- Query key 包含站点、文章、父评论、排序和分页等依赖，避免跨站缓存污染；mutation 成功后失效相关缓存。
- QueryClient 不可在 SSR 请求间共享全局实例。
- 尽量使用 Kumo Input、Button、Dialog 等组件；图标使用项目现有 Phosphor 图标库。
- Dialog 保持挂载，以 `open` 控制状态；图标按钮必须提供可访问名称和 tooltip/title。
- 正文及控件通常为 14px，标题使用适度大小和 `font-semibold`。不要随意改变字距。
- 后台采用紧凑、可扫描的工作界面，不增加营销首页、巨型 hero 或装饰性嵌套卡片。
- 必须处理加载、空状态、错误和 mutation pending 状态；禁止只完成成功路径。
- 验证桌面与移动端无横向溢出、遮挡和文本重叠；不能只依赖截图生成成功来宣称视觉检查通过。
- 不撤销、覆盖或删除不属于本次工作的用户改动。

## 数据库和部署

- 本地数据库默认 `file:./data/ascs.db`，Turso 使用 `libsql://...` 和 `DATABASE_AUTH_TOKEN`。
- Better Auth 表与业务表一起通过 Drizzle 迁移。schema 修改后使用 `bun run db:generate`，检查 SQL，再提交 SQL 和元数据。
- `bun run db:migrate` 使用 libSQL migrator；生产不要使用 `db:push` 替代受控迁移。
- 升级前备份数据库。不要删除旧迁移、直接改写已应用的迁移或重置生产数据库。
- 本地 SQLite 适合单机持久化部署；Vercel 应使用 Turso 等远程持久化数据库，不能依赖临时文件系统。
- Docker 使用非 root 用户和持久化 volume。迁移在容器启动时执行；管理员必须初始化在容器实际使用的数据库中，不能把宿主机的另一个数据库当作已初始化 volume。
- `BETTER_AUTH_URL` 必须匹配公开服务域名，生产密钥必须重新生成；本地及测试凭据不得用于生产。
- OAuth callback 为 `/api/auth/callback/github`、`/api/auth/callback/google` 或 `/api/auth/callback/microsoft`。
- 邮件 outbox 通过 `bun run mail:flush` 或受保护的 `/api/v1/cron/mail` 发送。SMTP 是至少一次投递，不能保证严格 exactly-once。
- 根据队列量设置 cron 频率；当前 worker 每批最多 20 封，默认 Vercel 日任务不适合即时通知和较大邮件量。
- `.env.example` 只放变量说明和空凭据；不要覆盖已存在的 `.env.local` 或 `.env`。

## 当前验证状态和接续工作

以下是生成本文件时的最近验证记录，不代表未来修改后的状态：

- 当前仓库已移除自动化测试代码、测试配置及对应依赖；不要使用已删除的测试命令。业务与安全流程需人工验收。
- `bun run typecheck`、`bun run lint` 和 `bun run build` 均通过；后续修改仍需重新运行相关检查。
- 构建带 Kumo 依赖的既有 `use client` 指令告警，不应隐藏其他构建错误。
- 尚未完成截图和真实 UI 验证，不能声称 UI 或 E2E 验收已通过。
- Docker 实际构建运行、Vercel 远程部署、真实 DNS 验证、Turso 远程连接、SMTP 实际送达和真实 OAuth provider 登录尚未完成验收。
- 初始 Vercel 配置需要验证 Nitro preset 产物和 cron 授权行为。
- 邮件失败运维、实例管理员管理 UI、系统设置和实例操作日志已实现。跨站 OAuth/第三方 cookie 兼容性、完整 CSP、真实 SMTP 外部连接和 UI 浏览器验收仍需验证。

接续时先解决会影响安全、真实业务和部署的缺口，再进行外观调整；验证报告明确区分通过、失败、未执行和受环境阻塞的项目。

## 特别的

- 禁止 UI 单元测试，列出本次改动受影响的 UI 并给出测试 Todo list，我自行验证。
- 不要主动 e2e 测试。
