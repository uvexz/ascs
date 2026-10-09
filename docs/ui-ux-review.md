# ASCS 前端 UI/UX 审查

本次已按报告完成源码修复，状态如下：

- **P1 F01–F06：已修复。** 深色控件、弹窗布局、切站权限回退、评论草稿保护、弹窗内删除错误和所有者授权确认均已处理。
- **P2 F07–F20：已修复源码可确定部分。** 已统一内容字号和语义颜色，筛选改为工具栏语义，后台状态进入 URL，设置支持 dirty 拦截，API 保留字段错误，封禁/点赞/回复/分页/缓存状态已同步。
- **P3 F21–F26：已修复源码可确定部分。** 已调整文本分组、图标首行对齐、行内 code、统计零值、认证恢复、复制反馈、使用说明和嵌入失败回退。
- **R01–R04：仍需人工浏览器验证。** 这些项目依赖真实视口、键盘、cookie 策略、网络时序和 iframe 环境，未被静态检查替代。

已修改的主要文件包括 `src/components/admin-app.tsx`、`src/components/comment-widget.tsx`、`src/components/auth-form.tsx`、`src/components/ui.tsx`、`src/styles.css`、`src/server/api.server.ts`、`src/lib/api.ts`、`src/lib/validation.ts`、`public/embed.js` 及认证/路由文件。

## 范围和验证边界

已检查：

- 管理后台的站点选择、评论审核、统计、集成、设置、成员和封禁。
- 登录、注册、找回密码、重置密码、404 和全局错误页。
- 公开评论的匿名表单、预览、回复、点赞、排序、分页和登录入口。
- 全局 CSS、深色主题、两个响应式断点、Markdown 和 iframe 嵌入脚本。
- 影响 UI 行为的接口返回、权限、审核状态、主题优先级和身份识别逻辑。
- 安装的 `@cloudflare/kumo` **2.14.0** 的 Button、Input、Field、Dialog、LayerCard 和主题实现。组件默认行为按实际安装版本核对。

验证结果：

| 检查                        | 结果   | 含义                                                    |
| --------------------------- | ------ | ------------------------------------------------------- |
| 前端源码与 Kumo 规则核对    | 已完成 | 支持本报告的代码层面结论                                |
| `bun run typecheck`         | 通过   | 类型检查通过，不代表视觉和交互验收通过                  |
| 声明颜色的 WCAG 对比度计算  | 已完成 | 使用 sRGB 相对亮度公式；不是屏幕截图采样                |
| 桌面/移动端截图及浏览器交互 | 未执行 | 布局裁切、实际焦点和跨站登录仍需人工验证                |
| UI 单元测试、自动 E2E       | 未执行 | 遵守项目 `AGENT.md` 的约定                              |
| `bun run build`             | 通过   | 生产构建通过；Kumo 依赖仍产生既有 `use client` 指令告警 |

优先级：**P1** 影响核心操作、内容可读性或不可逆权限操作；**P2** 影响效率、可访问性或界面状态一致性；**P3** 改善视觉组织、说明和反馈。

## Kumo 规则逐项核对

| 规则                                         | 结果                                   | 证据与解释                                                                                    |
| -------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `content-text-size` 正文与控件 14px          | 源码已修复，待人工 computed style 复核 | 自有页面的正文、状态、链接、导航和数据显示已调整为 14px；等宽代码块按独立代码内容处理。见 F07 |
| `heading-case` 标题 sentence case            | 当前自有文案符合                       | 中文标题没有英文 title case 问题；ASCS 是产品名。用户 Markdown 标题不作为产品文案审查         |
| `font-tracking` 不改变字距                   | 当前符合                               | 自有页面未发现 `tracking-*` 或 `letter-spacing`                                               |
| `font-weight` 不使用 `font-bold`             | 源码已符合                             | 未发现自有页面使用 `font-bold`；空状态标题已统一为 semibold。见 F21                           |
| `related-text-spacing` 相关文本更靠近        | 源码已调整，待人工复核                 | 空状态和弹窗标题/说明已分组，操作区保留更大的组间距。见 F02、F21                              |
| `text-spacing` 文本周围光学间距              | 源码已调整，待人工复核                 | 弹窗、通知、复制块和预览区已分别使用垂直略小于水平的内距。见 F21                              |
| `hover-color-transitions` hover 色立即变化   | 当前页面已符合                         | 已检查的页面没有颜色过渡；遗留的 `header-user.tsx` 也已移除 `transition-colors`。             |
| `shadow-borders` 阴影配 ring                 | 当前符合                               | 自有有 border 的面板没有同时添加投影；Kumo Dialog/Button 使用 ring                            |
| `concentric-border-radius` 同心圆角          | 需视觉复核                             | 没有发现明确的自定义近距离嵌套圆角错误；先修复 Dialog 内边距，再验证外框与控件距离            |
| `icon-alignment` 图标对齐第一行              | 源码已调整，待人工复核                 | 通知条、回复目标和相关多行文本已使用首行 line-height 容器。见 F21                             |
| `inline-monospace-size` 行内等宽字缩小       | 源码已符合，待人工复核                 | DNS 主机名和嵌入代码说明中的行内 code 已使用约 0.9em；独立代码块仍使用独立字号。见 F21        |
| `sticky-borders` sticky 元素有分隔线         | 当前符合                               | 桌面 sidebar 有右边框，移动端转静态并有下边框                                                 |
| `collapse-content-size` 折叠动画维持内容尺寸 | 当前无适用动画                         | 回复采用即时挂载/卸载，没有 width/height 折叠动画；不能据此宣称动画已验证                     |
| `layer-card-nesting` 不嵌套 LayerCard        | 当前符合                               | 自有页面没有叠加嵌套 LayerCard；Dialog 内部使用 LayerCard 属于组件实现                        |
| `dialog-rendering` Dialog 保持挂载           | 当前符合                               | 添加站点、删除、封禁、登录都通过 `Dialog.Root open` 控制，没有 `open && <Dialog>` 模式        |

Kumo 2.14.0 的主题明确设置 `--text-base: 14px`、`--text-sm: 13px`、`--text-xs: 12px`。因此“用了 Kumo”或“根字号为 14px”都不能保证所有正文符合 14px。全局未分层的 `font: inherit` 还会影响控件工具类的最终结果，后续调整需要检查 computed style。

## P1：优先修复

### F01 深色评论输入框使用了错误的颜色 token

**位置：** [styles.css:17](/mnt/d/dev/ascs/src/styles.css:17)、[styles.css:100](/mnt/d/dev/ascs/src/styles.css:100)。

`select, textarea` 的背景是 `var(--kumo-base, #fff)`，但安装的 Kumo 定义的是 `--color-kumo-base` 和 `--color-kumo-control`。项目未定义 `--kumo-base`，因此回退到白色；深色 widget 又把继承文字设为 `#e4e7ea`。

按这组声明颜色，评论 textarea 为浅色文字配白底，对比度 **1.24:1**。排序 select 也使用同一背景规则，实际原生控件呈现还需在目标浏览器核对。

**建议：** 输入区域使用 `--color-kumo-control`，文本使用对应 Kumo 文本 token；同时检查 placeholder、focus、disabled 和原生 select 的选项。

**人工复现：** 强制 `theme=dark`，在评论输入框输入文字，并打开排序选择框。

### F02 四类弹窗都缺少内边距和明确标题层级

**位置：** [admin-app.tsx:56](/mnt/d/dev/ascs/src/components/admin-app.tsx:56)、[admin-app.tsx:78](/mnt/d/dev/ascs/src/components/admin-app.tsx:78)、[admin-app.tsx:79](/mnt/d/dev/ascs/src/components/admin-app.tsx:79)、[comment-widget.tsx:80](/mnt/d/dev/ascs/src/components/comment-widget.tsx:80)。

所有 `<Dialog>` 都未提供 `className` 或内容容器 padding。Kumo 2.14.0 的 Dialog/普通 LayerCard 默认没有 padding；`Dialog.Title` 和 `Dialog.Description` 也不会自动添加产品所需的标题字号和间距。结果是内容直接贴着弹窗框边，表单、标题和底部操作缺少统一组织。

**建议：** 为这些弹窗统一设置略小的垂直内边距和水平内边距，例如 `px-6 py-5`；标题使用适度标题字号和 `font-semibold`，标题与说明紧密组合，内容和操作区保留更大的组间距。继续保持受控挂载方式。

**人工复现：** 分别打开添加站点、删除评论、封禁评论者、widget 账号弹窗，检查边缘、标题、说明和操作布局。

### F03 跨角色切换站点后，主区域可能变空

**位置：** [admin-app.tsx:20](/mnt/d/dev/ascs/src/components/admin-app.tsx:20)、[admin-app.tsx:34](/mnt/d/dev/ascs/src/components/admin-app.tsx:34)、[admin-app.tsx:50](/mnt/d/dev/ascs/src/components/admin-app.tsx:50)。

站点选择只更新 `selected`，不调整 `view`。当用户在 A 站作为 owner 查看“站点设置”或“成员与封禁”，再切到只有 moderator 权限的 B 站时，导航项被隐藏，但 `view` 仍是原来的值；对应内容又要求 `owner`，因此主区域没有实际视图。

**建议：** 切站或权限变化时校验当前 view，把无权限的 view 调整为“评论”。不要只隐藏导航项。

**人工复现：** 用同一个账号获得 A 站 owner、B 站 moderator 权限，从 A 的设置页切到 B。

### F04 提交评论期间继续输入，新文字会被成功回调清除

**位置：** [comment-widget.tsx:55](/mnt/d/dev/ascs/src/components/comment-widget.tsx:55)、[comment-widget.tsx:71](/mnt/d/dev/ascs/src/components/comment-widget.tsx:71)。

发送按钮的 `loading` 会禁用按钮，但 textarea、匿名字段、预览和回复切换仍可操作。请求发送后继续编辑，成功回调会无条件 `setText('')`、清除回复和预览状态，连同请求发出后新增的草稿一起清掉。

**建议：** 提交期间锁定这一份表单，或只清理与提交快照一致的草稿，保留后来输入的内容。回复对象也需要使用同一策略。

**人工复现：** 在浏览器中人为减慢网络，发送第一段评论后立即继续输入第二段，检查请求成功后的草稿。

### F05 删除失败的错误显示在模态层背后

**位置：** [admin-app.tsx:75](/mnt/d/dev/ascs/src/components/admin-app.tsx:75)、[admin-app.tsx:78](/mnt/d/dev/ascs/src/components/admin-app.tsx:78)。

删除请求失败时，删除弹窗保持打开，但 `moderate.error` 只渲染在评论列表顶部。模态遮罩和焦点范围让用户无法在当前弹窗中直接读取错误；可见操作只恢复为“取消/删除”，不说明为什么失败。

**建议：** 删除弹窗内渲染此次删除的错误和重试方式，并将焦点或可访问提示放在用户当前操作范围内。封禁弹窗已有内部错误，可作为一致性参考。

**人工复现：** 打开删除确认后让请求失败，或由另一会话先删除该评论，检查弹窗中的错误反馈。

### F06 添加站点所有者没有说明当前产品内无法撤销

**位置：** [admin-app.tsx:114](/mnt/d/dev/ascs/src/components/admin-app.tsx:114)、[api.server.ts:181](/mnt/d/dev/ascs/src/server/api.server.ts:181)。

“添加成员”的角色下拉框允许选择“所有者”，点击就立即添加。成员列表只提供移除 moderator 的操作；服务端明确禁止移除 owner，所有者退出需要实例维护操作。UI 在提交前没有说明权限范围和无法直接撤销的限制。

**建议：** 对添加 owner 提供明确说明和确认，显示目标邮箱、站点和授权范围；在尚未提供安全的撤销流程前，说明当前后台无法移除所有者。

**人工复现：** 选择“所有者”添加已注册账号，核对是否有权限说明和撤销入口。使用专门验收站点，避免给真实账号误授永久权限。

## P2：可访问性、效率和状态一致性

### F07 正文、控件及数据字号不符合 Kumo 审查规则

**位置：** [styles.css:32](/mnt/d/dev/ascs/src/styles.css:32)、[styles.css:56](/mnt/d/dev/ascs/src/styles.css:56)、[styles.css:64](/mnt/d/dev/ascs/src/styles.css:64)、[styles.css:65](/mnt/d/dev/ascs/src/styles.css:65)、[styles.css:99](/mnt/d/dev/ascs/src/styles.css:99)、[styles.css:106](/mnt/d/dev/ascs/src/styles.css:106)。

品牌说明、待审数量、状态 badge、时间、文章链接、邮箱、排序控件、页脚及移动端导航大量使用 11–13px 或 `text-xs/text-sm`。统计数字为桌面 28px、移动端 24px；按 skill 的严格规则，数据也属于 content，16px 以上仅用于标题/副标题。

**建议：** 自有正文、标签、数据和可交互文本统一为 14px，通过字重、色彩、位置和空白建立层级。行内等宽字按专门规则处理；独立代码块另行明确标准。不要通过全局修改根字号来替代逐项处理，因为它还会影响 rem 间距和控件尺寸。

### F08 部分文本颜色低于普通文字对比度要求

**位置：** [styles.css:67](/mnt/d/dev/ascs/src/styles.css:67)、[styles.css:71](/mnt/d/dev/ascs/src/styles.css:71)、[styles.css:82](/mnt/d/dev/ascs/src/styles.css:82)。

| 文本                   | 声明前景/背景         | 对比度 | 判断                                         |
| ---------------------- | --------------------- | ------ | -------------------------------------------- |
| 普通 muted 文字        | `#72767e` / `#fff`    | 4.56:1 | 这一组合达到 4.5:1，不能把所有灰字都判为失败 |
| 文章链接               | `#797f86` / `#fff`    | 4.04:1 | 未达到普通文本 4.5:1                         |
| 后台页脚               | `#8b9096` / `#fff`    | 3.22:1 | 未达到普通文本 4.5:1                         |
| 默认深色 Markdown 链接 | `#267265` / `#191b1e` | 3.02:1 | 未达到普通文本 4.5:1                         |

**建议：** 优先使用有明暗主题语义的 `text-kumo-link`、`text-kumo-subtle` 等 token；为 `data-accent` 自定义色设计单独的链接与焦点策略，不能假定任意六位十六进制色都可读。文字以外的焦点边框应按对应非文本标准单独检查。

### F09 手写 tablist 没有完整键盘和面板关联

**位置：** [admin-app.tsx:74](/mnt/d/dev/ascs/src/components/admin-app.tsx:74)。

评论状态按钮设置了 `role=tab` 和 `aria-selected`，但没有 roving tabIndex、方向键/Home/End 操作，也没有 tab 与 tabpanel 的 ID 关联。全部按钮留在普通 Tab 顺序中，语义与标准 tab 交互不一致。

**建议：** 复用 Kumo Tabs；如果这些按钮只是列表筛选，应改用清晰的筛选按钮语义，而不是只加部分 tab ARIA。

### F10 后台位置只存于组件状态，刷新和浏览器返回丢失上下文

**位置：** [admin-app.tsx:19](/mnt/d/dev/ascs/src/components/admin-app.tsx:19)、[admin-app.tsx:35](/mnt/d/dev/ascs/src/components/admin-app.tsx:35)。

站点、视图、审核状态和页码只在 `useState` 中。所有后台区域共用 `/`，不能复制当前管理位置，也不能用浏览器返回恢复之前的站点和视图；刷新回到默认站点及评论待审页。

**建议：** 将站点、视图及需要保留的筛选/分页放进路由或经过校验的 search params，并处理权限和不存在站点的回退。

### F11 设置表单缺少 dirty 管理，切换会丢草稿，刷新也可能保留旧值

**位置：** [admin-app.tsx:50](/mnt/d/dev/ascs/src/components/admin-app.tsx:50)、[admin-app.tsx:100](/mnt/d/dev/ascs/src/components/admin-app.tsx:100)。

设置表单使用 `defaultValue/defaultChecked`，没有 dirty 状态。切站或切视图会卸载表单，静默丢失未保存编辑。同一站点被其他会话更新后，刷新 detail 不会让已挂载的非受控表单自动跟随新默认值。保存成功后再编辑，`save.isSuccess` 也继续显示“设置已保存”。

**建议：** 显式区分服务器值、草稿和已保存状态；dirty 时提示保存或放弃；后台刷新只更新干净表单，避免覆盖编辑。开始新编辑后清理过期成功提示。

### F12 字段错误被丢弃，部分失败状态没有原地恢复入口

**位置：** [api.ts:10](/mnt/d/dev/ascs/src/lib/api.ts:10)、[api.server.ts:229](/mnt/d/dev/ascs/src/server/api.server.ts:229)、[admin-app.tsx:45](/mnt/d/dev/ascs/src/components/admin-app.tsx:45)、[comment-widget.tsx:77](/mnt/d/dev/ascs/src/components/comment-widget.tsx:77)。

服务端已返回 Zod `issues`，浏览器只保留字符串“输入不合法”，无法标明哪个字段出错。网络错误或非 JSON 响应会直接进入通用 Error 文案。站点 detail、评论列表和回复查询失败主要只显示错误，缺少该区域的重试入口；会话失效时也缺少明确重新登录操作。

**建议：** 保留字段错误，使用 Kumo Input/Field 的 `error` 与描述关联；为网络、认证和限流提供可操作中文文案；每个列表提供就地重试，保留已输入内容。

### F13 封禁记录无法区分目标，IP 封禁缺少实际影响说明

**位置：** [admin-app.tsx:79](/mnt/d/dev/ascs/src/components/admin-app.tsx:79)、[admin-app.tsx:114](/mnt/d/dev/ascs/src/components/admin-app.tsx:114)、[api.server.ts:127](/mnt/d/dev/ascs/src/server/api.server.ts:127)、[security.server.ts:27](/mnt/d/dev/ascs/src/server/security.server.ts:27)。

封禁弹窗不显示正在操作的评论者；记录列表只有类型与日期，同一天多个“IP 封禁”无法区分，管理员难以正确解除。

另一个条件性高风险是：**未配置可信 IP header 时**，服务端以共享 `unknown` 生成 IP 身份。此时“封禁 IP”实际可能阻止该站点所有使用这一共享身份的评论者，UI 却未说明，也未禁用此操作。本次未读取运行环境的敏感配置，因此没有判断当前部署是否满足这一条件；若满足，应按 **P1** 修复。

**建议：** 显示可区分的非敏感目标摘要、来源评论或操作备注；由服务端返回“能否识别独立 IP”的能力状态，无法区分时禁用该操作，支持时说明同一网络可能受影响。不要直接展示邮箱/IP 哈希或原始 IP。

### F14 生成的嵌入代码固定主题，后台修改主题不会影响已嵌入站点

**位置：** [admin-app.tsx:97](/mnt/d/dev/ascs/src/components/admin-app.tsx:97)、[embed.js:15](/mnt/d/dev/ascs/public/embed.js:15)、[comment-widget.tsx:37](/mnt/d/dev/ascs/src/components/comment-widget.tsx:37)。

后台生成脚本时写入 `data-theme=当前主题`。widget 又优先使用脚本传入的 `options.theme`，因此保存新的站点主题后，博客上之前复制的脚本仍然覆盖新配置。设置页没有说明需要更新嵌入代码。

**建议：** 默认生成的代码不固定主题，让站点配置生效；需要显式覆盖时提供选项和说明。该优先级本身可以保留，但 UI 必须解释结果。

### F15 点赞状态无法在刷新或重新展开后恢复

**位置：** [comment-widget.tsx:87](/mnt/d/dev/ascs/src/components/comment-widget.tsx:87)、[api.server.ts:48](/mnt/d/dev/ascs/src/server/api.server.ts:48)。

`liked` 初始化为 false，列表响应只返回点赞数量，不返回当前访问者的点赞状态。刷新、翻页重挂载或收起后再展开回复，心形和 `aria-pressed` 都恢复为未点赞；再点击时服务端可能实际执行取消点赞，出现“空心点赞按钮让数量减少”。

**建议：** 在具备可靠访问者身份时返回当前用户的 liked 状态并初始化 UI；匿名身份受 cookie 限制时，明确处理这种限制，避免承诺无法恢复的状态。

### F16 预览状态下点击回复，编辑器不会获得焦点

**位置：** [comment-widget.tsx:71](/mnt/d/dev/ascs/src/components/comment-widget.tsx:71)、[comment-widget.tsx:77](/mnt/d/dev/ascs/src/components/comment-widget.tsx:77)。

预览模式会卸载 `#comment-text`。回复回调只设置 reply 并查找 textarea 聚焦，没有退出 preview，因此点击回复后仍停留在预览，focus 查找没有目标。

**建议：** 点击回复时切换到编辑，等待 textarea 挂载再聚焦；使用 ref 管理焦点，并在非匿名站点未登录时引导登录。

### F17 分页和发送成功后不能稳定定位内容

**位置：** [pagination.tsx:3](/mnt/d/dev/ascs/src/components/pagination.tsx:3)、[admin-app.tsx:71](/mnt/d/dev/ascs/src/components/admin-app.tsx:71)、[comment-widget.tsx:56](/mnt/d/dev/ascs/src/components/comment-widget.tsx:56)。

审核分页中，最后一条被移出当前筛选后，page 不会回退，可能显示“暂无评论”但前面还有记录。分页只有裸页码，不说明当前范围；翻页后不管理列表位置。评论发布成功总是切到第 1 页，但“最早/最热”排序下新评论未必在那里；回复发布也没有自动展开对应线程。

**建议：** 数据变化后修正空末页；按接口能力显示页码说明或记录范围；翻页后把焦点/位置移到对应列表。已发布评论使用返回 ID 定位，待审核评论明确告知等待状态。

### F18 审核缺少回复上下文和明确操作反馈

**位置：** [admin-app.tsx:76](/mnt/d/dev/ascs/src/components/admin-app.tsx:76)、[api.server.ts:114](/mnt/d/dev/ascs/src/server/api.server.ts:114)。

后台审核响应及页面没有显示父评论，审核员看到一条“回复内容”时难以判断它在回应什么。文章链接只显示路径，稳定 pageKey、文章标题或其他识别信息也没有呈现。发布/标垃圾后，当前筛选中的评论可能直接消失，没有成功状态说明；mutation pending 只是全列表禁用相关按钮，不标明当前处理哪条。

**建议：** 展示回复对象及简短父评论摘要；按可用数据补充文章识别信息；为正在操作的行显示 pending，并在完成后提供简洁 `role=status` 反馈。批量操作和搜索可作为后续效率增强，不是当前审查的必需修复。

### F19 缓存命中时，切站可能携带上一个站点的成功提示

**位置：** [admin-app.tsx:49](/mnt/d/dev/ascs/src/components/admin-app.tsx:49)、[admin-app.tsx:51](/mnt/d/dev/ascs/src/components/admin-app.tsx:51)、[admin-app.tsx:93](/mnt/d/dev/ascs/src/components/admin-app.tsx:93)、[admin-app.tsx:110](/mnt/d/dev/ascs/src/components/admin-app.tsx:110)。

Integration 和 Members 没有像 Settings/CommentManagement 一样以站点 ID 设 key。若切换目标 detail 已缓存，组件无需经过加载卸载，会继续保留 verify mutation、Members notice 和 CopyBlock copied 等局部状态。例如 A 站的“验证通过”可能出现在尚未验证的 B 站内容中。首次访问未缓存站点时，加载分支会卸载组件，所以这个问题有缓存条件。

**建议：** 按站点隔离这些视图的局部状态，或在站点变化时显式 reset；异步回调也应对照提交时的站点。开始下一次操作时清理旧 notice，避免成功与错误并列。

### F20 合法的长昵称和站点名没有统一换行策略

**位置：** [styles.css:49](/mnt/d/dev/ascs/src/styles.css:49)、[styles.css:63](/mnt/d/dev/ascs/src/styles.css:63)、[styles.css:98](/mnt/d/dev/ascs/src/styles.css:98)、[admin-app.tsx:114](/mnt/d/dev/ascs/src/components/admin-app.tsx:114)。

正文 Markdown 和文章链接使用了 `overflow-wrap`，但评论作者、回复目标、成员昵称和页面副标题没有同样的保护。校验允许 60/80 字符的名称，连续英文字符在 flex 子项中可能按不可断词的最小宽度撑出容器。存在代码层面的防护缺口；具体溢出范围需要真实布局确认。

**建议：** 为这些用户输入内容设置 `min-width: 0` 和合适的断词/换行策略；只对无需全文读取的位置截断，并保留完整名称的可访问呈现。

## P3：视觉组织和说明

### F21 文本分组、图标对齐及行内代码尚未统一

**位置：** [styles.css:51](/mnt/d/dev/ascs/src/styles.css:51)、[styles.css:80](/mnt/d/dev/ascs/src/styles.css:80)、[styles.css:90](/mnt/d/dev/ascs/src/styles.css:90)、[admin-app.tsx:97](/mnt/d/dev/ascs/src/components/admin-app.tsx:97)。

空状态统一 `gap: 15px`，没有把标题和说明组成更近的一组；空状态标题为 500，与其他标题的 600 不一致。通知条图标在长文本时居中对齐，未按第一行组织；DNS 主机记录的行内 `<code>` 未缩小。复制区、登录面板及预览区使用等边距，光学密度可以改善。

**建议：** 标题/说明使用小间距，操作使用更大组间距；标题统一 semibold。多行图标采用首行 line-height 容器并防止图标收缩；行内 code 使用约 `0.9em`。间距逐处调整，不机械替换所有 `p-*`。

### F22 统计图的零值和比例会造成视觉误读

**位置：** [admin-app.tsx:83](/mnt/d/dev/ascs/src/components/admin-app.tsx:83)、[api.server.ts:129](/mnt/d/dev/ascs/src/server/api.server.ts:129)。

零评论也有最少 2% 高度的柱。服务端按过去 7×24 小时聚合，可能包含 8 个 UTC 日期；前端只展示今天及前 6 天，却用所有返回日期求 max，隐藏的第 8 天可能压低可见柱的比例。图表有数字但缺少每个数值与完整日期的清晰语义关联。

**建议：** 只从可见 7 天求 max，零值不绘制非零柱；每个日期与计数建立可访问名称或提供简洁数据表。保留 UTC 说明，避免与本地日期混淆。

### F23 认证表单缺少前置约束与失效链接恢复路径

**位置：** [auth-form.tsx:37](/mnt/d/dev/ascs/src/components/auth-form.tsx:37)、[auth-form.tsx:45](/mnt/d/dev/ascs/src/components/auth-form.tsx:45)、[reset-password.tsx:15](/mnt/d/dev/ascs/src/routes/reset-password.tsx:15)。

密码有 10–128 字符限制，但未在输入前提示。重置页缺失 token 时仍展示可提交表单，直到填写密码并发送才告知链接无效；失效后没有重新申请入口。认证请求 pending 时仍能切换登录/注册/找回模式，让操作结果与当前文案脱节。认证配置请求失败时，OAuth 入口会静默消失。

**建议：** 添加密码说明，进入重置页时识别缺失 token 并提供重新申请；pending 时保持模式稳定；为 provider 配置失败提供轻量恢复方式。错误按已知认证代码转成用户可理解的中文。

### F24 复制成功与失败状态不完整

**位置：** [admin-app.tsx:88](/mnt/d/dev/ascs/src/components/admin-app.tsx:88)。

复制成功只切换图标/tooltip，没有独立的 live 状态；失败后成功复制也不清理原 error，可能同时显示成功图标和“浏览器不允许访问剪贴板”。重复点击还会产生多个清除 copied 的计时器。

**建议：** 每次尝试清理旧错误，成功后给出短暂可访问状态；文本变化时 reset；失败时说明可以手动选取复制，统一处理计时器。

### F25 评论与集成的使用说明不足，部分图标按钮缺 tooltip

**位置：** [comment-widget.tsx:73](/mnt/d/dev/ascs/src/components/comment-widget.tsx:73)、[comment-widget.tsx:80](/mnt/d/dev/ascs/src/components/comment-widget.tsx:80)、[admin-app.tsx:56](/mnt/d/dev/ascs/src/components/admin-app.tsx:56)、[admin-app.tsx:97](/mnt/d/dev/ascs/src/components/admin-app.tsx:97)。

评论支持 Markdown，但编辑区没有说明或简短格式帮助。DNS 区域只列值，没有说明记录类型、DNS 服务商可能自动补域名及等待生效的步骤。匿名邮箱虽注明“不公开”，用途没有说明。账号弹窗 description 仅为“ASCS”，添加站点 description 仅为“新站点”，信息量不足。

关闭弹窗、取消回复按钮有可访问名称，但缺少项目约定的 tooltip/title；其他多数图标按钮已提供。

**建议：** 添加贴近任务的简短说明，说明 DNS 操作和主题继承关系；邮箱说明只陈述真实已实现用途。补齐图标提示，用“登录后使用账号发表评论”等任务文案替代泛化 description。

### F26 嵌入加载失败时，宿主页没有恢复提示

**位置：** [embed.js:5](/mnt/d/dev/ascs/public/embed.js:5)、[embed.js:23](/mnt/d/dev/ascs/public/embed.js:23)、[__root.tsx:12](/mnt/d/dev/ascs/src/routes/__root.tsx:12)。

嵌入脚本在目标缺失时直接退出；iframe 初始高度为 520px，脚本/页面加载失败时宿主页没有文字状态或打开评论页的备用入口。404/全局错误页使用默认 h1、普通链接/按钮，与其余 Kumo 页面呈现不一致，返回和重试操作不够明显。

**建议：** 为嵌入容器提供简洁 loading/fallback，并在可识别的失败时给出重试或独立评论页入口；错误页使用统一标题和 Kumo 操作组件。不要依赖跨源 iframe 的 load 事件来认定应用加载成功。

## 必须人工验证的 4 组项目

这些项目有代码风险依据，但本次没有浏览器结果，不能标记为已发生或已通过。

### R01 小屏、横屏与软键盘下的 Dialog 可达性（P1 风险）

Kumo 当前 Dialog 固定在 `top-8/sm:top-16`，使用 `overflow-hidden`；项目没有设置最大高度和内容滚动。注册表单、OAuth 行、错误信息同时出现时，短视口或软键盘可能使底部操作超出可见区域。核对 320/375px 宽、手机横屏、打开键盘、200% 缩放以及 Tab 到最后一个操作的结果。

同时检查程序化打开的 Dialog 关闭后是否返回正确触发按钮。本项目多处未使用 `Dialog.Trigger`，需要实际验证 Base UI 的焦点恢复，不应仅凭组件名宣称通过。

### R02 跨站 iframe 登录和匿名点赞身份（P1 风险）

iframe 登录会打开独立 widget 页，但没有检测弹窗被拦截，也没有明确“登录完成后返回博客”的文案。第三方 cookie 被阻止时，顶层窗口登录成功不等于 iframe 获得 session；相同限制还会影响匿名点赞身份的稳定性。

在允许及阻止第三方 cookie 的模式下，分别检查邮箱登录、OAuth、返回原博客、匿名评论开关和重复点赞。按实际浏览器能力提供顶层评论入口/恢复说明，继续保持来源和 cookie 安全约束。

### R03 响应式、触控与深层回复（P2 风险）

检查 320、375、640、641、900、1280px 宽度，特别是断点两侧；测试长昵称、长站点名、长 URL、单行代码、宽 Markdown 表格和五层回复。桌面 sidebar 固定 `100dvh` 且没有内部滚动，短窗口高度下要检查站点选择、导航、添加站点和退出是否都可达。

根字号为 14px，Tailwind spacing 仍为 rem：默认 Kumo `h-9` 高度约 31.5px，`size=sm` 的 `h-6.5` 约 22.75px。实际触摸目标、邻近目标间距和缩放需要测量；不能简单把“低于 44px”全部判成 WCAG 失败，也不能据此认定已经满足 24px 目标与间距例外。

### R04 初始主题、session 加载、challenge 刷新和动态高度（P2 风险）

widget 的主题在 effect 中更新，初始 state 是 light；session 的 pending/error 没有独立 UI；config challenge 要求最少等待 1.5 秒。检查深色模式首次加载是否闪白、登录用户是否短暂看到匿名必填字段、刷新配置后立即提交的错误是否可恢复、打开很久后草稿是否保留。

评论成功后和评论失败后都会刷新 config；刷新失败时 widget 当前使用全页错误分支，需确认是否将已有列表与表单替换。检查回复展开、输入变化、错误出现和折叠后 iframe 高度是否能增减，是否出现空白、跳动或嵌套滚动。

## 建议修复顺序

1. **核心可用性：** F01–F06；同时确认 F13 的共享 IP 条件和 R01/R02 的真实表现。
2. **统一 Kumo 基础：** F07/F08/F09、弹窗布局、图标与文本组织；采用语义 token，避免继续增加平行的颜色系统。
3. **修复状态和流程：** 路由上下文、设置 dirty、字段错误、封禁识别、主题继承、点赞、回复焦点、分页和缓存切站。
4. **补充说明及回归验收：** 密码、DNS、Markdown、复制、统计和嵌入恢复；完成下方人工清单。

## 人工验收 Todo

- [ ] 浅色/深色评论表单、排序、预览、Markdown 链接、placeholder、focus、disabled 可读；检查声明色与实际渲染色的对比度。
- [ ] 添加站点、删除、封禁、登录/注册四类弹窗具备内边距和标题层级；小屏/横屏/软键盘下可滚动到全部操作。
- [ ] 所有弹窗支持 Tab/Shift+Tab、Escape 和正确焦点恢复；失败信息可在当前弹窗内读取。
- [ ] A 站 owner/B 站 moderator 切换不会出现空白视图；缓存命中的站点切换不携带旧成功/错误/复制状态。
- [ ] 慢网提交评论后继续编辑不会丢新草稿；发送失败保留正文和回复对象。
- [ ] 添加 owner 前清楚知道权限及撤销限制；封禁目标可区分，IP 操作能说明实际影响，解除封禁不靠猜测。
- [ ] 评论状态筛选支持所选语义对应的键盘操作；筛选切换、翻页和刷新后位置可理解。
- [ ] 设置有未保存提示；刷新不覆盖草稿，干净表单可更新；修改后旧“已保存”提示消失。
- [ ] URL 可恢复当前站点和管理区域；浏览器返回、刷新和分享位置符合预期。
- [ ] 字段错误定位到相关输入；网络、会话失效、限流和服务错误有可执行恢复操作。
- [ ] 修改站点主题后，已有博客嵌入按声明的继承/覆盖规则变化。
- [ ] 点赞后刷新、翻页、收起/展开仍显示正确状态；跨站 cookie 受限情况有明确行为。
- [ ] 预览时点击回复能进入编辑并聚焦；发布的顶层评论及嵌套回复在相应排序下能被找到。
- [ ] 审核当前页最后一条后，页码和空状态正确；待审回复可以读取父评论上下文。
- [ ] 320–1280px、200% 缩放、短高度和五层回复下，无页面横向溢出、遮挡或无法触达的操作。
- [ ] 60 字符连续英文昵称、80 字符站点名、长链接、代码和宽表格显示正常。
- [ ] 零评论日期不显示非零柱，七天图表比例只按可见日期计算，日期和数量可被读屏理解。
- [ ] 缺失/过期密码重置链接有重新申请入口；密码要求提前说明；认证 pending 时不会发生模式错位。
- [ ] 复制成功清理旧错误并播报状态；剪贴板不可用时可以手动复制。
- [ ] DNS、Markdown、匿名邮箱和主题覆盖说明准确，图标按钮有名称及 tooltip/title。
- [ ] iframe 在成功、失败、展开和收起后高度正确；加载失败有恢复入口；顶层登录后返回原博客的结果清楚。

本次已根据本报告完成源码修复，未运行 UI 单元测试或主动 E2E。`bun run typecheck`、`bun run build`、本次改动文件的 ESLint 检查和 Prettier 检查已通过；完整仓库 `bun run lint` 仍受既有脚本、服务端安全存在性检查和导入空行规则阻塞，详见最终验证说明。桌面/移动端截图、真实键盘操作、跨站 cookie、动态 iframe 高度和短视口 Dialog 仍需按上方人工 Todo 验收，不能仅凭构建成功宣称通过。
