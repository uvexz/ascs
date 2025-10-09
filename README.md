# ASCS - A Simple Comment System 🚀

基于 Next.js 和 Base UI 构建的现代化、轻量且易于部署的博客评论系统。

## 🛠️ 技术栈

- **框架**: Next.js 15 (App Router)
- **UI 组件**: Base UI
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **语言**: TypeScript

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ascs
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 到 `.env` 并配置数据库连接：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
DATABASE_URL="postgresql://username:password@localhost:5432/ascs_db?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. 初始化数据库

```bash
# 创建数据库迁移
npx prisma migrate dev --name init

# 生成 Prisma 客户端
npx prisma generate
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看评论系统。

## 📖 使用方法

### 嵌入到你的网站

#### 基础嵌入

在你的 HTML 页面中添加以下代码：

```html
<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统 -->
<script src="https://your-ascs-deployment.com/comments.js" defer></script>
```

#### 高级配置

你可以通过以下方式自定义评论系统的行为：

##### 1. 自定义页面ID

默认情况下，系统使用当前页面的路径作为页面ID。你可以通过 `data-page-id` 属性指定自定义的页面ID：

```html
<div id="comments" data-page-id="my-custom-page-id"></div>
<script src="https://your-ascs-deployment.com/comments.js" defer></script>
```

##### 2. 自定义基础URL

如果你的评论系统部署在不同的域名，可以通过 `data-ascs-host` 属性指定：

```html
<div id="comments" data-ascs-host="https://comments.example.com"></div>
<script src="https://your-ascs-deployment.com/comments.js" defer></script>
```

##### 3. 自定义容器ID

如果你需要使用不同的容器ID，可以通过 `data-container-id` 属性指定：

```html
<div id="my-comments"></div>
<script src="https://your-ascs-deployment.com/comments.js" data-container-id="my-comments" defer></script>
```

##### 4. Script标签配置

你也可以将所有配置直接写在script标签上，这样更加简洁：

```html
<!-- 评论容器 -->
<div id="comments"></div>

<!-- 在script标签上配置所有参数 -->
<script 
  src="https://comments.example.com/comments.js" 
  data-page-id="blog/my-awesome-post"
  data-ascs-host="https://comments.example.com"
  data-container-id="comments"
  defer>
</script>
```

##### 5. 混合配置

Script标签配置的优先级高于容器配置，你可以混合使用：

```html
<!-- 容器上的配置 -->
<div id="comments" data-page-id="default-page"></div>

<!-- script标签上的配置会覆盖容器配置 -->
<script 
  src="https://comments.example.com/comments.js" 
  data-page-id="blog/my-awesome-post"
  defer>
</script>
```

##### 6. 完整配置示例

```html
<!-- 方式一：容器配置 -->
<div 
  id="comments" 
  data-page-id="blog/my-awesome-post"
  data-ascs-host="https://comments.example.com"
></div>
<script src="https://comments.example.com/comments.js" defer></script>

<!-- 方式二：Script标签配置（推荐） -->
<div id="comments"></div>
<script 
  src="https://comments.example.com/comments.js" 
  data-page-id="blog/my-awesome-post"
  data-ascs-host="https://comments.example.com"
  data-container-id="comments"
  defer>
</script>
```

#### 配置选项说明

| 属性 | 说明 | 默认值 | 示例 | 配置位置 |
|------|------|--------|------|----------|
| `data-page-id` | 自定义页面标识符 | 当前页面路径 | `"blog/post-1"` | 容器或Script标签 |
| `data-ascs-host` | 评论系统服务器地址 | 脚本所在域名 | `"https://comments.example.com"` | 容器或Script标签 |
| `data-container-id` | 评论容器的ID | `"comments"` | `"my-comments"` | 容器或Script标签 |

#### 配置优先级

当同一个配置在多个地方都有定义时，优先级顺序为：

1. **Script标签配置** - 最高优先级
2. **容器配置** - 中等优先级  
3. **默认值** - 最低优先级

### 管理后台

访问 `/admin` 路径来管理站点和评论：

- **首次设置**: 第一次访问时可以创建管理员账户
- **站点管理**: 手动添加和管理评论系统站点，支持设置备用域名
- **评论管理**: 查看和删除评论
- **系统配置**: 配置 SMTP 邮件和 Telegram 通知
- **用户认证**: 安全的登录/登出功能

#### 站点管理
- 不再自动创建站点，需要管理员手动创建
- 支持为每个站点设置多个备用域名
- 如果访问的域名不在站点列表或备用域名列表中，将显示错误提示

### 通知功能

#### 邮件通知
- 用户留下邮箱后会自动订阅该页面的评论通知
- 有新评论时会发送邮件提醒给订阅者
- 支持一键退订功能

#### Telegram 通知
- 管理员可配置 Telegram Bot 接收新评论通知
- 实时推送评论内容和站点信息

### 用户体验
- **头像系统**: 自动使用 Gravatar 头像，未提供邮箱时基于姓名生成
- **信息记忆**: 用户的姓名、邮箱、网站会保存在 Cookie 中，下次评论时自动填充
- **响应式设计**: 完美适配各种设备尺寸
- **Markdown 支持**: 评论支持 Markdown 格式，提供编辑和预览模式

## 🔧 API 文档

### 获取评论

```http
GET /api/comments?siteId={siteId}&pageId={pageId}
```

### 创建评论

```http
POST /api/comments
Content-Type: application/json

{
  "siteId": "site_id",
  "pageId": "/posts/hello-world",
  "author": "用户名",
  "content": "评论内容（支持 Markdown）",
  "email": "user@example.com", // 可选
  "website": "https://example.com", // 可选
  "parentId": "parent_comment_id" // 可选，用于回复
}
```

### Markdown 支持

评论系统支持完整的 Markdown 语法，包括：

- **基本格式**: `**粗体**`、`*斜体*`、`~~删除线~~`
- **链接**: `[文本](URL)`
- **图片**: `![alt文本](图片URL)`
- **代码**: `行内代码` 或代码块
- **引用**: `> 引用文本`
- **列表**: 无序列表 `- 项目` 和有序列表 `1. 项目`
- **表格**: 使用 `|` 分隔的表格
- **任务列表**: `- [x] 已完成任务`、`- [ ] 未完成任务`

评论表单提供编辑和预览模式，用户可以在编写时实时预览 Markdown 渲染效果。

### 获取站点信息

```http
GET /api/sites?host={hostname}
```

## 🚀 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成！

### 其他平台

项目支持部署到任何支持 Next.js 的平台

## 📄 许可证

```
DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE 
Version 2, December 2004 

Copyright (C) 2023 YJK.

Everyone is permitted to copy and distribute verbatim or modified 
copies of this license document, and changing it is allowed as long 
as the name is changed. 

      DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE 
TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION 

0. You just DO WHAT THE FUCK YOU WANT TO.
```
