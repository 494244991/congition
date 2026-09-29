# 知元 · 通识学社

> 一个面向大学生的通识阅读小站。主题涵盖 **管理与经济、哲学与逻辑、心理学、社会学、口才与交际、AI与科技、杂谈**，每日新增一篇，帮你拓宽视野、提升认知。

本仓库为纯静态网站，无需后端、无需构建，直接由 GitHub Pages 托管。

---

## 一、本地预览

本站所有内容已打包进 `content/posts.js`，通过 `<script>` 直接加载，**无需服务器、无需联网**：

- **最简单**：直接双击 `index.html` 即可打开浏览（适合日常预览）。
- 若习惯用服务器：`cd site && python -m http.server 8000`，访问 `http://localhost:8000`。

> 注意：改动文章后，需重新生成 `posts.js`（见第三节），刷新页面即可看到更新。

---

## 二、目录结构

```
site/
├─ index.html              # 页面骨架
├─ assets/
│  ├─ css/style.css        # 样式（清新学术卡片风）
│  └─ js/
│     ├─ app.js            # 前端逻辑：路由、分类、搜索、Markdown 渲染
│     └─ marked.min.js     # 本地内置的 Markdown 解析器（无需联网）
├─ content/
│  ├─ manifest.json        # 内容清单（所有文章的索引，作者编辑的"源"）
│  ├─ posts.js             # 由脚本自动生成：内联所有正文，站点实际加载它
│  └─ *.md                 # 每篇文章一个 Markdown 文件（正文）
└─ tools/
   └─ add_post.py          # 一键新增文章 + 自动重新打包 posts.js
```

---

## 三、每日新增一篇内容（两种方法）

### 方法 A：用脚本（推荐）

```bash
python tools/add_post.py \
  --title "为什么我们容易焦虑" \
  --category psychology \
  --summary "从进化心理学理解现代人的焦虑来源" \
  --tags "焦虑,心理,进化"

# 杂谈需要指定子分类：
python tools/add_post.py \
  --title "重读《活着》" \
  --category misc --subcategory 文学 \
  --summary "苦难叙事下的生命韧性"
```

脚本会：① 在 `content/` 生成 `<日期>-<标题>.md` 文件（含写作模板）；② 自动把文章登记进 `manifest.json`；③ **自动重新生成 `content/posts.js`**（这一步让站点立即生效）。
然后你只需打开生成的 `.md`，把模板占位内容换成正文即可（支持 Markdown）。改完正文后，再跑一次 `python tools/add_post.py --build` 即可把新正文打包进 `posts.js`。

### 方法 B：手动

1. 在 `content/` 新建一个 `.md` 文件，例如 `2026-09-30-my-topic.md`，写入正文（第一行用 `# 标题`）。
2. 在 `content/manifest.json` 的数组里追加一条（字段同方法 A）。
3. **务必运行** `python tools/add_post.py --build` 重新生成 `posts.js`，否则改动不会生效。

`category` 取值：`management` / `philosophy` / `psychology` / `sociology` / `communication` / `ai-tech` / `misc`。
`misc` 的子分类（`subcategory`）可取：时事政治、媒体、文化、文学、艺术、地理、旅游。

> `--build` 仅重新打包数据、不新增文章，适合手动改过 `.md` 或 `manifest.json` 后同步。

### 方法 C：网页内直接录入（最简单）

打开网站，点右上角 **「✎ 录入内容」**：选择主题 → 填标题、供稿人、摘要、正文 → **提交发布**。
新文章立即出现在该主题的"最新"位置，可随时删除（仅限本机录入的）。

- 录入内容保存在**当前浏览器**（localStorage），刷新/重启不丢失；换浏览器或换设备不会同步。
- 点 **「⬇ 导出录入内容」** 可下载 JSON 备份；把该文件发给维护者即可合并进正式文章库。

---

## 四、发布到 GitHub Pages（本地构建 + 推送）

本仓库按你的选择**在本地完成构建，再手动推送到 GitHub**。步骤：

### 1. 初始化并提交（只需一次）

```bash
cd site
git init
git add .
git commit -m "init: 知元通识学社静态站"
```

### 2. 在 GitHub 上新建仓库

到 https://github.com/new 新建一个仓库（例如 `tongshi-site`），
**不要**勾选自动生成 README（我们已有内容）。

### 3. 推送到 GitHub

```bash
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 若提示登录，使用有 `repo` 权限的 Personal Access Token 作为密码（GitHub 已不支持账户密码推送）。

### 4. 开启 GitHub Pages

进入仓库 **Settings → Pages**，Source 选择 **main 分支 / root 目录**，保存。
稍等一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

### 5. 日后每日更新

```bash
python tools/add_post.py --title "..." --category ... --summary "..."
# 写完正文后（改 .md 文件），重新打包：
python tools/add_post.py --build
git add .
git commit -m "add: 2026-09-30 xxx"
git push
```

---

## 五、自定义

- **站点名称 / 标语**：改 `index.html` 中的 `知元 · 通识学社` 文本，以及 `assets/js/app.js` 顶部 `CONFIG.siteName`。
- **主题分类与配色**：改 `assets/js/app.js` 中的 `CONFIG.categories`（含每个分类的 `color`）。
- **视觉风格**：改 `assets/css/style.css` 顶部 `:root` 里的 CSS 变量。

---

© 知元 · 通识学社 · 内容由本站编辑每日整理发布
