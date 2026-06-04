# Personal Knowledge Blog

这是一个个人博客第一版：公开前台使用 Astro 静态生成，本地后台只在自己的电脑上运行。它适合长期写作、按专栏组织文章、保存外部资料，以及维护一份简洁书单。

## 架构

```text
公开前台：Astro 静态网站，部署到 GitHub Pages
本地后台：React + Express，只监听 127.0.0.1
内容格式：Markdown 正文 + JSON 元信息
发布方式：手动 git commit + push
浏览量：Cloudflare Worker + D1，可选启用，不记录 IP
```

后台不会部署到公网，也不会自动执行 `git commit` 或 `git push`。

## 项目结构

```text
admin/                 本地后台
site/                  Astro 前台
content/
  posts/               已发布文章，会进入 GitHub
  drafts/              本地草稿，不进入 GitHub
  columns.json         专栏
  archive.json         资料存档
  library.json         图书馆
  orders/
    home-featured.json 首页推荐排序
    columns/           专栏内“我的推荐排序”
public/
  uploads/             图片上传目录
scripts/               内容校验和搜索索引脚本
views-worker/          浏览量统计 Worker，可选部署
```

文章正文放在 `index.md`，文章元信息放在同目录的 `meta.json`。Markdown 文件顶部不使用 Front Matter。

## 本地运行

安装依赖：

```bash
npm install
```

运行公开前台预览：

```bash
npm run dev:site
```

运行本地后台：

```bash
npm run dev:admin
```

后台地址：

```text
http://127.0.0.1:4321
```

## 发布流程

后台保存文章后，先本地预览，然后手动提交：

```bash
git status
git add content public/uploads site admin scripts .github README.md package.json package-lock.json
git commit -m "Publish blog update"
git push
```

推送到 GitHub 后，GitHub Actions 会构建 `dist/` 并发布到 GitHub Pages。

## 草稿规则

草稿保存在：

```text
content/drafts/
```

该目录已写入 `.gitignore`，不会进入公开 GitHub 仓库。发布文章时，后台会把文章写入 `content/posts/`。

## 图片规则

第一版只支持简单的图片上传、粘贴和保存。图片会保存到：

```text
public/uploads/
```

Markdown 中引用形式：

```md
![图片说明](/uploads/example.png)
```

第一版不做复杂图片清理、压缩、去重和附件管理。

## Markdown 支持

支持普通 Markdown，以及：

```text
Obsidian callout
[[内部链接]]
[[内部链接|显示文字]]
```

内部链接目标存在时会渲染为文章链接；不存在时显示为普通文本。

## 搜索

搜索只针对：

```text
文章标题
文章正文
```

不搜索专栏、标签、URL 或分类。构建时会生成：

```text
public/search-index.json
```

## 浏览量统计

浏览量统计是可选功能。公开博客仍然部署在 GitHub Pages；浏览量由 Cloudflare Worker + D1 记录，不需要租 VPS 或维护云服务器。

当前策略：

```text
不记录 IP
不做用户识别
文章页变成可见状态后 +1
前台不显示浏览量
后台文章管理页显示总浏览量和今日浏览量
```

部署 Worker 见：

```text
views-worker/README.md
```

启用前台上报时，修改：

```text
public/view-counter.json
```

把 endpoint 改成 Worker 的公开上报接口：

```json
{
  "endpoint": "https://your-worker.your-subdomain.workers.dev/api/view"
}
```

启用本地后台读取时，在仓库根目录创建本地 `.env`：

```bash
VIEW_COUNTER_ADMIN_URL=https://your-worker.your-subdomain.workers.dev/api/admin/views
VIEW_COUNTER_ADMIN_TOKEN=your-private-token
```

`.env` 已被 Git 忽略，不要提交。`VIEW_COUNTER_ADMIN_TOKEN` 只用于本地后台读取浏览量，不能放进前台代码。

## 第一版不做

```text
评论系统
用户注册
在线后台
文章标签体系
图书封面
阅读时间
复杂附件管理
自动 git push
多作者
一篇文章属于多个专栏
```
