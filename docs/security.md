# 安全模型与上线检查

## 默认安全策略

- AI 检测关闭时匿名评论默认需要审核；启用 AI 检测后以 AI 决策为准（`approved` 直接发布，详见 [AI 反垃圾评论检测](./moderation.md)）。
- 所有浏览器 mutation 要求 same-origin JSON 请求，公开接口仅返回已发布内容；邮件 cron 是例外，使用独立 Bearer secret。
- Markdown 使用 `react-markdown` 且不渲染 raw HTML；链接带 `nofollow noopener noreferrer ugc`。
- 评论内容限制 5,000 字符，回复最多五层；challenge 防止简单机器人，honeypot、屏蔽词、链接数量、重复提交和 libSQL 原子计数限流共同降低垃圾评论。
- 启用 AI 检测后，语义判断由服务端在本地规则之后执行，只向第三方发送评论正文与公开上下文（不含邮箱、IP），API key 仅存于服务端环境变量。
- 删除评论会清除正文和身份摘要；仅当层级下仍有可见回复时保留树节点（前台显示为“评论已删除”占位以挂住回复），没有任何可见回复的删除评论直接不展示。
- 评论者身份只保存带服务端密钥的 HMAC 摘要（评论表的 `email_hash` / `ip_hash`）；账号邮箱、邀请邮箱和邮件 outbox 收件地址属于账户与投递数据，按明文保存但仅在服务端使用。公开响应不返回 HMAC 摘要、原始邮箱、IP 或 OAuth token。

## 请求来源与限流

`TRUSTED_IP_HEADER` 只有在可信入口覆盖该 header 且禁止绕过入口时才可配置。未配置时所有访客共用一个 `unknown` IP 桶，按 IP 的登录、注册、评论和 API 限流都会退化为全实例共享限流，单个人即可让全站不可用。

限流状态存储在数据库并使用原子计数，不能替换为仅进程内 Map，也不能采用非原子的“先读取再增加”。

## 认证、Cookie 与跨站嵌入

- 认证 cookie 使用 HttpOnly、SameSite=Lax；生产环境从 HTTPS URL 自动使用安全 cookie。不要关闭 Better Auth 的 CSRF、来源检查或 cookie 安全保护。
- 用户身份只来自 Better Auth 验证后的 session，服务端不信任请求中的 `userId`、昵称、角色或审核状态；管理接口独立校验 session 与站点权限。
- 跨站评论凭据只能由服务端在验证 cookie 会话后签发，短有效期（12 小时）、随会话撤销，且仅适用于公开评论接口；后台和个人资料接口必须拒绝该凭据。
- iframe 保持 sandbox；`postMessage` 校验 `origin`、`source`、消息类型、站点 ID 和高度范围。跨站登录在服务域名的顶层窗口完成，具体流程见 [嵌入博客](./embed.md#跨站登录)。
- 管理页面禁止 iframe 嵌入；widget 的 CSP `frame-ancestors` 仅允许对应已验证站点和自身。

## 数据与密钥

- `BETTER_AUTH_SECRET` 用于会话、HMAC 和系统设置加密。备份和迁移时必须保留原密钥；更换密钥前需先解密并重新加密配置。
- 系统设置中的敏感字段使用由 `BETTER_AUTH_SECRET` 派生的密钥进行 AES-256-GCM 加密，后台不回传 SMTP 密码。
- 不记录密码、密钥、session token、数据库 token 或 SMTP 凭据到日志、文档或版本控制。
- `.env.example` 只放变量说明和空凭据；不要覆盖已存在的 `.env.local` 或 `.env`。

## 上线检查清单

- [ ] `BETTER_AUTH_URL` 指向公开 HTTPS 域名，生产密钥已重新生成（`BETTER_AUTH_SECRET`、`CRON_SECRET` 均 ≥ 32 字符）。
- [ ] `TRUSTED_IP_HEADER` 仅在反代覆盖该 header 且外部无法直连应用时设置。
- [ ] 至少配置一种发信方式，并让 cron 持续调用邮件 outbox 接口。
- [ ] 发布前备份数据库并执行迁移；生产不使用 `db:push`。
- [ ] `admin:init` 在目标数据库上执行，随后移除 `ADMIN_PASSWORD`。
- [ ] 每个站点完成 DNS TXT 验证；OAuth callback 地址与公开域名一致。
- [ ] 已确认部署平台的持久化存储（Vercel 需使用 Turso 等远程数据库）。

## 当前边界

邮件使用可靠 outbox 和 SMTP worker，尚未集成模板化邮件供应商；统计包含实例与站点维度的基础聚合，不包含访问量分析；OAuth 需自行配置 provider credentials。操作日志覆盖实例管理操作，不包含所有评论审核与站点成员操作。AI 反垃圾检测依赖第三方服务（decision.vllm-sr.ai），其可用性、限额与数据保留策略由该服务决定；阈值默认值尚未基于真实审核数据校准。
