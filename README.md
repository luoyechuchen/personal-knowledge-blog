# Personal Knowledge Blog

这是一个个人博客第一版：公开前台使用 Astro 静态生成，本地后台只在自己的电脑上运行。它适合长期写作、按专栏组织文章、保存外部资料，以及维护一份简洁书单。

## 架构

```text
公开前台：Astro 静态网站，部署到 GitHub Pages
本地后台：React + Express，只监听 127.0.0.1
内容格式：Markdown 正文 + JSON 元信息
发布方式：手动 git commit + push
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

## 第一版不做

```text
评论系统
用户注册
在线后台
在线数据库
文章标签体系
图书封面
阅读时间
复杂附件管理
自动 git push
多作者
一篇文章属于多个专栏
```
