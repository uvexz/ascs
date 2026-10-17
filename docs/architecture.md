# 技术结构与模块地图

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

## 请求链路

1. `src/start.ts` 的请求中间件为所有响应附加安全响应头，并为 `/widget` 按站点生成 CSP。
2. 页面与 `/api/*` 由 `src/routes/` 的文件路由接收，业务逻辑集中在 `src/server/`。
3. 服务端通过 Better Auth session、站点授权、来源检查与限流完成认证和隔离，再经 Drizzle 读写 libSQL。
4. 客户端用 TanStack Query 调用 `/api/v1/*`，mutation 成功后按 query key 精确失效缓存。

## 模块地图

| 路径                                       | 职责                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/db/schema.ts`                         | Better Auth 表、站点、成员、邀请、评论、点赞、封禁、限流、邮件队列、系统设置和操作日志                 |
| `src/db/index.ts`                          | libSQL client 和 Drizzle 实例，仅服务端使用                                                            |
| `src/lib/auth.ts`                          | Better Auth 服务端配置和数据库适配                                                                     |
| `src/lib/auth-client.ts`                   | 浏览器认证客户端                                                                                       |
| `src/lib/validation.ts`                    | Zod 输入校验、共享枚举和分页常量                                                                       |
| `src/lib/api.ts`                           | 浏览器 fetch、错误类型、查询参数编码                                                                   |
| `src/lib/widget-session.ts`                | 跨站 iframe 的短期会话令牌存储与查询                                                                   |
| `src/lib/widget-queries.ts`                | widget 配置/评论的 queryOptions 与服务端函数（SSR 预取，复用 `handleApi`）                             |
| `src/lib/cache.ts`                         | TanStack Query 缓存失效 helper                                                                         |
| `src/lib/queries.ts`                       | 共享 queryOptions（dashboard / siteDetail / profile）                                                  |
| `src/lib/query-keys.ts`                    | 全站 query key 定义                                                                                    |
| `src/lib/system-settings.ts`               | 系统设置的类型与 Zod schema（默认值在 `settings.server.ts`）                                           |
| `src/lib/moderation.ts`                    | AI 反垃圾评论纯逻辑：环境变量解析与校验、System One 请求/响应、决策、缓存键、spamReason 标签（无 I/O） |
| `src/server/security.server.ts`            | session、站点授权、来源检查、HMAC、原子限流、challenge                                                 |
| `src/server/site-cache.server.ts`          | 站点记录的短 TTL 进程内缓存（CSP 中间件与公开接口复用，写操作显式失效）                                |
| `src/server/captcha.server.ts`             | 可选 Cap 人机验证（`CAP_SITE`/`CAP_KEY`），供注册、登录、重置密码和评论使用                            |
| `src/server/moderation.server.ts`          | AI 反垃圾评论服务端：配置记忆化、带超时/退避重试的 System One 调用、TTL 缓存、分级日志                 |
| `src/server/http.server.ts`                | 请求体读取、查询参数解析和 JSON 响应 helper                                                            |
| `src/server/api.server.ts`                 | `/api/v1/*` 分发及评论、站点管理业务                                                                   |
| `src/server/profile.server.ts`             | 个人资料、账户列表和邮箱变更服务                                                                       |
| `src/server/mail.server.ts`                | 持久化邮件 outbox 和 SMTP worker                                                                       |
| `src/server/admin.server.ts`               | 实例管理员接口、用户/站点/邮件运维与审计                                                               |
| `src/server/settings.server.ts`            | 加密系统设置、脱敏读取和注册策略                                                                       |
| `src/server/network.server.ts`             | SMTP 主机的 SSRF 检查（拒绝回环、内网和链路本地地址）                                                  |
| `src/start.ts`                             | 请求中间件和安全响应头                                                                                 |
| `src/router.tsx`                           | 每个 router 独立的 QueryClient                                                                         |
| `src/routes/`                              | 页面和 API 文件路由                                                                                    |
| `src/routes/admin/`                        | 后台子路由：站点视图 `/admin/site/$siteId/*`、实例视图 `/admin/instance/*`                             |
| `src/components/admin-shell.tsx`           | 后台外壳：侧栏导航、顶栏、创建站点和未保存设置拦截                                                     |
| `src/components/admin/`                    | 站点后台子模块（评审、统计、集成、设置、成员、站点选择）                                               |
| `src/components/instance/`                 | 实例后台子模块（用户、站点、邮件、审计、系统设置）                                                     |
| `src/components/comment-widget.tsx`        | 评论组件外壳：按 `embed` 参数分支、会话切换、列表、分页与排序                                          |
| `src/components/inline-comment-widget.tsx` | 顶层（非 iframe）widget，按需加载 cookie 登录 UI                                                       |
| `src/components/comment-composer.tsx`      | 评论表单、匿名字段、预览与蜜罐                                                                         |
| `src/components/comment-thread.tsx`        | 单条评论、嵌套回复、点赞和展开                                                                         |
| `src/components/markdown.tsx`              | 统一安全 Markdown 渲染                                                                                 |
| `src/components/captcha.tsx`               | `cap-widget` 包装，上报一次性 token                                                                    |
| `src/components/`                          | 认证、个人资料和公共 UI 组件                                                                           |
| `src/styles.css`                           | Tailwind/Kumo 导入、应用样式和响应式布局                                                               |
| `public/embed.js`                          | 无依赖 iframe 嵌入脚本和高度消息校验                                                                   |
| `scripts/`                                 | 环境初始化、数据库迁移、管理员初始化、邮件发送                                                         |
| `drizzle/`                                 | 已提交的迁移 SQL 和元数据                                                                              |
| `Dockerfile`、`compose.yaml`               | 自托管容器、数据 volume 和健康检查                                                                     |
| `vercel.json`                              | Vercel 构建命令和邮件 cron                                                                             |

`src/routeTree.gen.ts` 由路由生成器维护，不要手动修改。不要编辑 `.output`、`.tanstack`、`.nitro`、`.vercel`、`node_modules` 或生成的报告来修复源代码问题。
