# ASCS

ASCS（A Simple Comment System）是一个面向多站点博客的评论服务。它提供 Better Auth 账号认证、OAuth 登录、匿名评论、Markdown、嵌套回复、点赞、审核、封禁、站点隔离、邮件通知和 iframe 嵌入。

## 功能

- 多站点隔离与域名验证；站点所有者/审核员权限。
- 邮箱密码登录，可选 GitHub / Google / Microsoft OAuth。
- 匿名评论、Markdown、最多五层回复、点赞；回复始终展开，深层回复以「回复 昵称」标明对象；删除评论保留可见回复的占位。
- 实例与站点两级后台：用户、站点、评论审核、统计、成员、邮件队列和操作日志。
- 持久化邮件 outbox 与 SMTP 发送；可选 Cap 人机验证。
- 可选 AI 反垃圾评论检测，基于 System One 决策 API（默认 `vllm-sr/d3`）。
- 无依赖 iframe 嵌入脚本，博客 CSS 不会污染评论区。

技术栈：TanStack Start / Router / Query、React 19、Tailwind CSS v4 + Cloudflare Kumo、Drizzle ORM + libSQL/Turso、Better Auth、Nitro。结构说明见 [技术结构与模块地图](./docs/architecture.md)。

## 快速开始

需要 Node.js 22.12+（推荐 24）或 Bun。

```bash
bun install
cp .env.example .env.local
# 填写 BETTER_AUTH_URL、BETTER_AUTH_SECRET 和 CRON_SECRET（openssl rand -hex 32）
bun run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<10–128 位密码>' bun run admin:init
bun run dev
```

打开 <http://localhost:3000>。完整步骤、本地站点与登录说明见 [快速开始](./docs/quickstart.md)。

## 文档

| 文档                                          | 内容                                  |
| --------------------------------------------- | ------------------------------------- |
| [快速开始](./docs/quickstart.md)              | 安装、初始化、本地运行与开发命令      |
| [管理员后台](./docs/admin.md)                 | 实例/站点后台、额度、所有权与系统设置 |
| [嵌入博客](./docs/embed.md)                   | 嵌入代码、可选属性、跨站登录与 CSP    |
| [环境变量与认证配置](./docs/configuration.md) | 全部环境变量、OAuth、Cap、Cookie      |
| [AI 反垃圾评论检测](./docs/moderation.md)     | 工作原理、阈值、缓存与失败处理        |
| [部署](./docs/deployment.md)                  | Docker、VPS、Vercel、cron 与升级      |
| [安全模型与上线检查](./docs/security.md)      | 默认安全策略、数据保护、上线清单      |
| [技术结构与模块地图](./docs/architecture.md)  | 技术栈、请求链路与模块职责            |

## 检查

```bash
bun run typecheck
bun run lint
bun run check
bun run build
```

仓库不包含自动化测试；以上检查只覆盖类型、格式、路由生成和构建，业务流程与 UI 需要人工验收。

## 部署

Docker / VPS / Vercel 的步骤见 [部署](./docs/deployment.md)。生产环境必须使用 HTTPS，并对照 [上线检查清单](./docs/security.md#上线检查清单)确认密钥、反向代理、邮件和数据库迁移。

已知边界见 [安全模型与上线检查](./docs/security.md#当前边界)。
