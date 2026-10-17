# 部署

ASCS 通过 Nitro 构建为 Node server，可运行在 Docker / VPS，也可部署到 Vercel 等 PaaS。生产环境必须使用 HTTPS。

## Docker / VPS

```bash
cp .env.example .env
# 设置 BETTER_AUTH_URL、BETTER_AUTH_SECRET、CRON_SECRET
# 以及一次性初始化用的 ADMIN_EMAIL、ADMIN_PASSWORD（可选 ADMIN_NAME）
docker compose up -d --build
# 迁移在容器启动时自动执行；管理员必须在容器内的数据库中初始化
docker compose exec ascs npm run admin:init
```

`compose.yaml` 默认使用 `file:/app/data/ascs.db` 并挂载到 `ascs-data` volume；设置 `.env` 中的 `DATABASE_URL` 可覆盖为 Turso 等远程 libSQL 地址。容器以非 root 用户运行，带健康检查，端口默认只绑定到 `127.0.0.1`。初始化完成后从 `.env` 移除 `ADMIN_PASSWORD` 并重启容器。

镜像内使用 `npm run ...`（基于 `package-lock.json`），本地开发使用 `bun run ...`；两种包管理器的 lockfile 都需要保持同步。

## 反向代理

生产 VPS 应在 Nginx/Caddy 后使用 HTTPS。如果配置 IP header（`TRUSTED_IP_HEADER`），必须让代理覆盖 header 并阻止外部直连容器端口，否则限流和审计会被伪造来源绕过。

## 邮件定时任务

邮件 outbox 可用 cron 每分钟调用：

```cron
* * * * * curl -fsS -H 'Authorization: Bearer <CRON_SECRET>' https://comments.example.com/api/v1/cron/mail >/dev/null
```

也可以手动执行 `bun run mail:flush`。worker 每批最多 20 封、最多尝试 5 次；cron 频率需按队列量调整。SMTP 是至少一次投递，不能保证严格 exactly-once。

## Vercel

导入仓库，设置 `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、Turso `DATABASE_URL` / `DATABASE_AUTH_TOKEN` 及所需 OAuth、SMTP、`CRON_SECRET`。`vercel.json` 已声明每天运行邮件 outbox；Vercel Cron 需要在项目设置中启用并确保 cron 请求带上配置的授权策略。部署后执行一次：

```bash
bun run db:migrate
ADMIN_EMAIL=... ADMIN_PASSWORD=... bun run admin:init
```

libSQL/Turso 推荐用于 Vercel；本地 SQLite 适合单机 VPS。数据库迁移必须在发布前运行，生产不要使用 `db:push`。

## 升级与迁移

1. 备份 Turso/SQLite 数据库。
2. 检查本次发布包含的 `drizzle/*.sql` 迁移，确认没有遗漏或破坏性变更。
3. 执行 `bun run db:migrate`，再滚动重启应用。只有修改了 `src/db/schema.ts` 才需要在开发分支运行 `bun run db:generate`。

不要直接删除迁移文件；schema 的破坏性变更需要单独的数据迁移。Docker 部署在容器启动时自动执行 `db:migrate`，管理员必须初始化在容器实际使用的数据库中，不能把宿主机的另一个数据库当作已初始化 volume。

上线前的安全检查清单见 [安全模型与上线检查](./security.md#上线检查清单)。
