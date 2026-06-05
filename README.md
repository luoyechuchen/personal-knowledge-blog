# 无边落夜

这是“无边落夜”的个人知识博客。公开前台部署在 GitHub Pages，本地后台只在自己的电脑上运行，用来写文章、整理专栏、保存资料、维护图书馆，并查看文章浏览量。

公开地址：

```text
https://luoyechuchen.github.io/personal-knowledge-blog/
```

## 当前版本

当前正在使用的是第三版草稿：它继承第二版封装点，并继续加入更可靠的图片资产管理、发布提示修复和后台编辑体验修复。

第二版已经封装在 GitHub Release / tag 中；第三版还没有封装，所以它不会出现在 Releases 列表里，而是记录在 `v3-draft` 分支中。

版本记录见：

```text
VERSIONS.md
```

GitHub 版本：

```text
v1-prototype  第一次提交的个人博客原型，正式 tag / Release
v2-current    第二版封装点，正式 tag / Release
v3-draft      当前使用中的第三版草稿，branch，尚未封装
```

## 架构

```text
公开前台：Astro 静态网站，部署到 GitHub Pages
本地后台：React + Express，只监听 127.0.0.1
内容格式：Markdown 正文 + JSON 元信息
发布方式：手动 git commit + push
浏览量：Cloudflare Worker + D1，可选启用，不记录 IP
```

后台不会部署到公网，也不会自动执行 `git commit` 或 `git push`。公开网站只包含静态页面和公开内容。

## 功能

```text
文章：按发布时间查看，也可以维护首页推荐排序
专栏：一篇文章属于一个专栏，专栏页支持推荐/最新两种阅读顺序
资料存档：支持外部链接，也支持粘贴 Markdown 原文生成阅读页
图书馆：后台按最近编辑优先，前台按最早添加优先，适合循序阅读
搜索：搜索文章标题和正文
主题：日间模式与夜间星空模式
浏览量：文章可见时计数，后台显示总浏览量和今日浏览量
```

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

后台保存内容后，先本地预览，然后手动提交：

```bash
cd /Users/luoyechuchen/Documents/coding
git status
git add content public/uploads
git commit -m "Publish blog update"
git push
```

如果修改了网站代码或文档，再按需把对应文件加入 `git add`。推送到 GitHub 后，GitHub Actions 会构建 `dist/` 并发布到 GitHub Pages。

## 草稿规则

草稿保存在：

```text
content/drafts/
```

该目录已写入 `.gitignore`，不会进入公开 GitHub 仓库。发布文章时，后台会把文章写入 `content/posts/`。

## 图片规则

图片采用“编辑时预览，保存时入库”的机制。

编辑文章时：

```text
粘贴图片文件：先作为临时图片预览，不立刻写入项目
粘贴图片 URL：先用原 URL 预览，不立刻写入项目
```

点击保存草稿或发布文章时，后台会扫描 Markdown 中的图片，把临时图片和远程图片导入：

```text
public/uploads/
```

然后把 Markdown 中的图片地址统一替换为：

```md
![图片说明](/uploads/example.png)
```

这样公开网站不会依赖原图片地址，也不会依赖项目文件夹之外的本地文件。未保存的临时图片不会进入项目。

当前版本不做复杂图片清理、压缩、去重和附件管理。单张导入图片最大 8MB。

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

## 当前不做

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
