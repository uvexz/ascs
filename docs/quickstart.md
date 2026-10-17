# 快速开始

ASCS 是 Node.js 应用，本地使用 SQLite 文件即可跑起来。本文覆盖安装、初始化、本地运行和管理员初始化；其余内容见 [文档索引](../README.md#文档)。

## 环境要求

- Node.js 22.12+（推荐 24，与 `.nvmrc` 和 Docker 镜像一致）或 Bun 1.x。
- 默认使用本地 SQLite；也可以连接 Turso 等远程 libSQL。

## 安装与初始化

```bash
bun install

cp .env.example .env.local
# 至少填写：
# BETTER_AUTH_URL=http://localhost:3000
# BETTER_AUTH_SECRET=<openssl rand -hex 32>
# CRON_SECRET=<openssl rand -hex 32>

bun run db:migrate
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='<10–128 位密码>' \
ADMIN_NAME=Administrator \
bun run admin:init
bun run dev
```

打开 <http://localhost:3000>。仓库已提交 Drizzle 迁移，`db:migrate` 会直接建表；只有修改 `src/db/schema.ts` 后才需要先运行 `bun run db:generate` 生成新迁移。

`bun run setup` 也可以生成一份带随机密钥的 `.env.local`，但不会覆盖已有文件。

管理员密码需为 10–128 个字符。`admin:init` 可以重复执行，对已有账号会验证密码，不会仅凭邮箱提权；初始化完成后应从环境变量中移除 `ADMIN_PASSWORD`。

## 本地站点与登录

- 开发环境可设置 `ALLOW_LOCALHOST_SITE=true`，创建 `http://localhost:3000` 或 `http://127.0.0.1` 站点并跳过 DNS 验证。生产环境必须使用 HTTPS 并完成 DNS TXT 验证。
- 注册需要邮箱验证。未配置发信时，可以先用 `admin:init` 创建已验证的管理员账号；正式部署至少要配置一种发信方式（后台 SMTP 或 `SMTP_URL` / `MAIL_FROM`）。
- 可选 OAuth（GitHub / Google / Microsoft）与 Cap 人机验证的配置见 [环境变量与认证配置](./configuration.md)。

## 开发命令

```bash
bun run dev             # 开发服务器，端口 3000
bun run typecheck
bun run lint
bun run check           # prettier --check .
bun run build           # 产物在 .output/
bun run start           # 运行生产构建
```

不要提交 `.env.local`、`.env`、数据库文件或真实管理员密码。

下一步：在 [管理员后台](./admin.md) 中创建站点并复制嵌入代码，具体写法见 [嵌入博客](./embed.md)。
