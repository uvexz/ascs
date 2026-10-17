# 嵌入博客

评论区运行在 sandbox iframe 中，博客自己的 CSS 不会污染评论区。嵌入脚本约 2 KB（gzip），无第三方依赖。

## 最小代码

把下面的片段放进文章模板：

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

`data-site` 是后台「集成」页展示的站点 ID。首次嵌入前，需要把该页给出的验证 TXT 记录添加到 `_ascs.<域名>`，再点击「检查验证」。

## 可选属性

| 属性                      | 说明                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `data-target`             | 挂载点元素 ID，默认 `ascs-comments`                                                       |
| `data-url`                | 覆盖文章 URL，默认使用当前页面地址                                                        |
| `data-page`               | 稳定的文章 ID，适合 URL 会带业务查询参数或改名的文章                                      |
| `data-title`              | 文章标题，仅用于 AI 反垃圾检测判断相关性                                                  |
| `data-description`        | 文章摘要，仅用于 AI 反垃圾检测判断相关性                                                  |
| `data-theme`              | `auto` / `light` / `dark`                                                                 |
| `data-accent`             | 6 位十六进制品牌色，如 `#2f6feb`                                                          |
| `data-border`             | 出现即添加边框和圆角，设为 `false` 关闭                                                   |
| `data-background`         | 背景色（`#rgb` / `#rrggbb` / 带透明通道的 `#rgba` / `#rrggbbaa`），或 http/https 背景图片 |
| `data-background-opacity` | `0`–`1`，为背景色或背景图统一叠加透明度                                                   |

`embed.js` 会校验并转发 `data-theme`、`data-accent`、`data-border`；`data-background` 和 `data-background-opacity` 原样转发，由 widget 路由丢弃无法解析的值。无效样式参数不会影响评论功能。

## 文章 URL 与 pageKey

文章 URL 的 origin 必须和站点保存的 origin 完全匹配。服务端会重新规范化 URL（去掉 hash 和 `utm_*`、`fbclid`、`gclid` 等常见跟踪参数），校验站点归属和文章标识，不信任脚本传入的权限或用户 ID。

`pageKey` 默认使用规范化后的完整 URL，客户端可以任意指定；对带业务查询参数或会改名的文章，建议用 `data-page` 指定稳定的文章 ID。

## 跨站登录

评论区嵌入在其他域名的页面时，浏览器不会在第三方 iframe 中发送 ASCS 的会话 cookie，Safari 等还会直接拦截第三方 cookie。为此：

1. 点击登录会在服务域名的顶层弹窗中打开 `/widget-login`；
2. 服务端验证 cookie 会话后签发一个 12 小时、可撤销的短期会话凭据；
3. 凭据通过 `postMessage` 回传给 iframe，iframe 仅凭该凭据调用公开评论接口。

Cookie 属性保持不变，未放宽 SameSite 或 CSRF 保护；后台和个人资料接口拒绝该凭据。回传前会校验 `window.opener` 同源；凭据接收端校验 `origin`、`source`、消息类型、一次性 `state` 和 token。iframe 高度消息由 `embed.js` 校验 `origin`、`source`、消息类型、站点 ID，并限制高度范围。

## 域名验证与 CSP

- 公开评论服务只接受已通过域名验证的站点。
- `/widget` 的 CSP `frame-ancestors` 只允许对应已验证站点和 ASCS 自身；管理页面返回 `X-Frame-Options: DENY`，禁止被 iframe 嵌入。
- 修改站点域名或验证状态后，widget 的 CSP 会按站点记录重新生成。
