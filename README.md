# 王铄然个人网站

这是一个无需安装前端框架的静态个人网站，使用原生 HTML、CSS 和 JavaScript 构建。第一版包含首页、文章列表、文章详情、作品和关于页面，并适配电脑、平板与手机。

## 本地启动

需要先安装 [Node.js](https://nodejs.org/)（建议安装 LTS 版本）。

在项目文件夹中打开 PowerShell，运行：

```powershell
cd "C:\Users\14999\Documents\Codex\2026-10-28\files-mentioned-by-the-user-docx"
node server.mjs
```

浏览器打开：

```text
http://localhost:4173
```

停止网站：回到 PowerShell，按 `Ctrl + C`。

也可以在安装了 npm 的电脑上运行 `npm start`，效果相同。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `index.html` | 首页 |
| `articles.html` | 文章列表与主题筛选 |
| `article.html` | 文章详情页，通过 `?post=budget` 这类参数显示不同文章 |
| `projects.html` | 作品列表与项目详情弹窗 |
| `about.html` | 个人介绍、经历、技能与联系方式 |
| `styles.css` | 全站字体、颜色、间距和响应式布局 |
| `script.js` | 手机导航、滚动出现动画、动态文章列表、项目弹窗和复制联系方式 |
| `articles-data.js` | 文章内容与文章列表数据 |
| `editor.html` | 文章写作、封面和文稿导入页面 |
| `editor.js` | 本地草稿保存、文章预览和数据导出 |
| `assets/images/` | 封面、插画与图标 |
| `server.mjs` | 无第三方依赖的本地预览服务器 |

## 添加自己的文章

打开：

```text
http://localhost:4173/editor.html
```

写作台支持填写标题、分类、日期、摘要和正文，也支持导入 Markdown 或纯文本文件以及上传封面。

1. 点击“保存草稿”后，草稿保存在当前浏览器的本地存储中，可以立即在文章列表里预览。
2. 点击“保存到网站文件”，选择项目根目录中的 `articles-data.js`。浏览器不支持直接写入时，会改为下载该文件。
3. 刷新文章页确认内容。发布网站时，需要把更新后的 `articles-data.js` 上传；从写作台上传的封面会包含在这份数据文件中。

本地草稿只存在于当前浏览器，不会自动同步到其他设备，也不会自动发布到互联网。

## 发布到互联网

这是一个静态网站，可以选择下面任一方式：

### GitHub Pages（免费）

1. 注册或登录 GitHub，新建一个公开仓库。
2. 把本目录中的网站文件上传到仓库根目录，不需要上传 `work/` 和 `outputs/`。
3. 打开仓库的 `Settings → Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/ (root)`，保存。
5. 等待 GitHub 完成部署，网站地址通常为 `https://你的用户名.github.io/仓库名/`。

### Netlify（可拖拽发布）

1. 登录 Netlify，进入 Sites。
2. 把整个项目文件夹拖到发布区域；也可以连接 GitHub 仓库以便以后自动更新。
3. 不需要填写构建命令，发布目录使用项目根目录。
4. Netlify 会生成一个公开网址，后续可绑定自己的域名。

发布后请用手机网络重新打开一次，并测试首页、导航、四篇文章、作品弹窗和邮件链接。网站尚未由本地环境自动发布到互联网；需要你完成账号注册与平台授权。
