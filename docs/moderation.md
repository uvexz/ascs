# AI 反垃圾评论检测

ASCS 内置可选的 AI 反垃圾评论检测。它在本地规则（屏蔽词、链接数量、蜜罐、challenge、限流、重复提交）之后运行，对评论做语义判断，并用可配置阈值决定自动通过、人工审核还是隔离。

## 为什么选用 decision.vllm-sr.ai 与 `vllm-sr/d3`

- [decision.vllm-sr.ai](https://decision.vllm-sr.ai) 提供**免费**的 System One 决策 API：一次请求对同一段输入回答多个**带校准概率**的固定选择题，正好适合“这条评论是不是垃圾、是不是推广、风险多高”这类结构化判断，比生成式模型延迟更低、输出更可控。
- `vllm-sr/d3` 是该服务文本榜上最强的 27B 模型（文本 66.26 / 视觉 71.26），对多语言垃圾、伪装推广与正常外链的区分更稳。需要更轻量时可换成同系列 `vllm-sr/d3-flash`、`d3-mini`、`d3-nano` 等，仅需改 `DECISION_MODEL`。
- **免费获取 key**：打开 <https://decision.vllm-sr.ai> 一键创建（key 只显示一次）。限额与每日配额见 <https://decision.vllm-sr.ai/docs#rate-limits>，按 key 与来源地址分别限流，日内配额 UTC 0 点重置（`429` 会带 `Retry-After`）。
- 该服务会记录请求与响应并可能用于模型改进，**请勿发送敏感个人信息**。ASCS 只发送：评论正文、文章 URL/标题/摘要、作者公开昵称与账号类型、作者在本站的评论计数、父评论正文/作者、评论中的链接。**不发送**邮箱、IP 或它们的 HMAC 摘要。

## 工作方式

- 一次请求用 System One 的 `choice` / `noul` / `score` 三类问题评估：`classification`（`normal` / `promotion` / `seo` / `flood` / `keyword_stuffing` / `other_spam`）、`spam`、`promotion`、`relevance`、`risk`，以及是否试图操纵审核系统的 `manipulation`。
- 评论正文被显式围栏标记为“仅数据”；标题、摘要、昵称、网站和 `pageKey` 等上下文由客户端提供，同样被视为不可信数据并限制长度，但不在正文围栏内。模型输出结构固定，提示词注入无法改变解析 schema（只能试图影响概率），`manipulation` 问题和高风险回退到人工审核进一步兜底。
- 决策综合分类概率、垃圾概率、推广概率、风险评分与结果完整性：

| 状态          | 何时产生                                                                                            | 数据库 `status`                                                     |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `approved`    | 垃圾概率与推广/风险都低、正常分类概率高且分类为 `normal`                                            | `approved`（直接发布）                                              |
| `review`      | 疑似推广、风险偏高、疑似注入、置信度不足、结果冲突或字段缺失                                        | `pending`                                                           |
| `quarantined` | 垃圾概率 ≥ `SPAM_AUTO_QUARANTINE_THRESHOLD` 且垃圾分类概率 ≥ `SPAM_AUTO_QUARANTINE_CLASS_THRESHOLD` | `spam`（隔离，可在后台恢复）                                        |
| `unavailable` | 超时、限流、HTTP 错误、无效 JSON 等；配置错误也归入此状态                                           | 由 `SPAM_FAIL_MODE` 决定 `pending` / `spam`；配置错误固定 `pending` |

- 本地规则优先且不会被 AI 放宽。启用 AI 检测时以 AI 决策为准：`approved` 直接发布，不会被降级为待审核；站点自身的 `moderation` 审核策略只在 AI 关闭时生效，AI 返回 `unavailable` 时按 `SPAM_FAIL_MODE` 处理（配置错误固定为待审核）。**任何单一分数都不会直接永久删除评论。**

## 环境变量

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

日志只记录状态、原因码、概率、模型、延迟与尝试次数；不会记录 API key、正文全文、策略/提示词版本或私密标识。密钥不使用 `VITE_` 等公开前缀，因此不会进入客户端代码或打包产物。

## 缓存、重试与失败

- 缓存键是“内容 + 上下文”的指纹哈希（正文、文章 URL/标题/摘要、作者公开资料与站内历史、父评论、链接、模型与问题集版本）。因此修改评论或换文章会得到新键，不会跨文章或跨上下文错误复用。仅缓存可用的决策（`approved`/`review`/`quarantined`），不缓存 `unavailable`。
- 仅对可重试错误（网络/超时、`429`、`5xx`、无效 JSON）做有限次指数退避重试，并遵守 `Retry-After`（上限 2 秒）；`4xx`（除 `429`）不重试。
- 网络/超时、限流、HTTP 错误、无效 JSON 或缺少 `answers` 等传输级失败 → `unavailable`，按 `SPAM_FAIL_MODE` 处理（配置错误固定为待审核）；单个 answer 字段缺失等不完整响应 → `review`（`ai-review-incomplete`）。任何情况下都不会静默自动通过。

## 启用方式

- **本地**：`cp .env.example .env.local`，填入 `DECISION_API_KEY=sk-vsr-...`，重启 `bun run dev` 即启用。未填 key 时检测保持关闭，评论按原有本地规则与站点审核策略处理。
- **Docker / VPS**：写入 `.env`（`compose.yaml` 会注入容器）或服务器环境变量。
- **Vercel / PaaS**：在项目环境变量设置中注入；不要在客户端使用这些变量，也不要把真实 `.env` 提交到版本控制。

生产部署步骤见 [部署](./deployment.md)。
