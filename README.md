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
│  ├─ posts.js             # 由脚本/接口自动生成：内联所有正文，站点实际加载它
│  └─ *.md                 # 每篇文章一个 Markdown 文件（正文）
├─ functions/
│  └─ api/
│     └─ submit.js         # Cloudflare Pages 函数：接收投稿并写入仓库 content/（多用户同步）
└─ tools/
   ├─ add_post.py          # 一键新增文章 + 自动重新打包 posts.js
   └─ merge_local.py       # 把网页「录入内容」导出的 JSON 合并进 content/（本地/无后端时）
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

### 方法 C：网页内直接录入

打开网站，点右上角 **「✎ 录入内容」**：选择主题 → 填标题、供稿人、摘要、正文 → **提交发布**。

- **部署在 Cloudflare Pages（已配置提交接口）**：点「提交发布」会**直接把文章写入仓库的 `content/` 目录**（生成 `.md`、更新 `manifest.json` 与 `posts.js`），**所有访问者刷新即可看到**，实现多用户同步。提交者本人即时可见，其他人约 1 分钟后（GitHub Pages 部署完成）可见。
- **未配置接口（如 GitHub Pages 直传、或本机双击打开）**：内容暂存本浏览器 `localStorage`，仅自己可见。可用「⬇ 导出录入内容」下载 JSON，再走下面的「合并发布」流程正式入库。

#### 合并发布（本地/无后端时，网页录入 → 进 content/ → 所有人可见）

1. 在网站上点 **「⬇ 导出录入内容」**，下载一个 JSON 文件。
2. 把该文件放到 `site/content/_drafts/local_entries.json`（或记住它的路径）。
3. 在本机运行合并脚本：

```bash
python tools/merge_local.py            # 默认读取 content/_drafts/local_entries.json
python tools/merge_local.py 路径/录入内容导出.json   # 或指定路径
```

脚本会：① 为每篇生成 `content/<日期>-<slug>.md`；② 登记进 `manifest.json`；③ 自动重建 `posts.js`。同名文章自动跳过。

4. 提交并推送：

```bash
git add . && git commit -m "add: 合并网页录入内容" && git push
```

5. 合并完成后，回到浏览器用 **「🗑 删除本文」** 清掉对应的本机草稿，避免页面上重复显示。

---

## 四、发布到网站（GitHub Pages 或 Cloudflare Pages）

本仓库为纯静态站点，本地完成构建后推送到 GitHub。要支持**多用户录入并同步进 `content/`**，推荐使用 Cloudflare Pages（见下方方案 B）。

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

### 4. 两种托管方式

#### 方案 A：GitHub Pages（仅静态托管，无多用户投稿）

进入仓库 **Settings → Pages**，Source 选择 **main 分支 / root 目录**，保存。
稍等一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。
此方式下网页「提交发布」会**降级为本机草稿**（localStorage），多用户同步需走「合并发布」流程（见方法 C）。

#### 方案 B：Cloudflare Pages（支持多用户录入、自动同步到 content/）✅ 推荐

保留 GitHub 仓库，但改用 **Cloudflare Pages** 托管（仍是纯静态站点，附带一个极小的服务端函数 `functions/api/submit.js`）。
任何人点「✎ 录入内容 → 提交发布」，内容会**直接写入仓库 `content/`**，GitHub 重新构建后**所有访问者刷新即见**，真正实现多用户共享。

> 本仓库的 git 根目录就是站点根目录（`index.html` 在根），所以下方的 Build output directory 填 `.`。

**第 1 步：推送仓库到 GitHub**（见上文第 3 步）。

**第 2 步：生成一个有仓库写权限的 GitHub Token（Fine-grained）**
1. 打开 https://github.com/settings/tokens?type=beta （Settings → Developer settings → Personal access tokens → Fine-grained tokens）
2. 点 **Generate new token**，填写：
   - Token name：随意，如 `cloudflare-submit`
   - Expiration：按需（建议 1 年或更长，到期需重新生成）
   - Resource owner：你的账号
   - Repository access：**Only select repositories** → 选中本仓库
   - Permissions → **Repository permissions → Contents** → 设为 **Read and write**
3. 拉到底点 **Generate token**，**立即复制**那串 `github_pat_...`（只显示一次）。

**第 3 步：在 Cloudflare 创建 Pages 项目并连接仓库**
1. 打开 Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权并选中你的 GitHub 仓库
3. 设置构建：
   - Framework preset：**None**
   - Build command：**（留空）**
   - **Build output directory：`.`**（点开 “Override” 后填入点号，表示站点根目录）
4. 点 **Save and Deploy**，等待首次部署完成（先不要管功能，能打开首页即可）。

**第 4 步：配置三个环境变量（密钥只存在 Cloudflare 服务器端，不进代码）**
在刚建好的 Pages 项目里：**Settings → Environment variables** → 添加以下变量（Production 环境）：
- `GITHUB_TOKEN` = 第 2 步复制的 `github_pat_...`
- `GITHUB_REPO` = `你的用户名/仓库名`（例如 `zhangsan/tongshi-site`）
- `GITHUB_BRANCH` = `main`

> 保存后 Cloudflare 会自动重新部署，使环境变量生效。

**第 5 步：验证**
1. 打开你的 Pages 地址 `https://<项目名>.pages.dev`
2. 点右上角「✎ 录入内容」→ 选主题、填标题/正文 → **提交发布**
3. 到 GitHub 仓库 `content/` 目录，应能看到新生成的 `.md` 文件，`manifest.json` 与 `posts.js` 也已更新
4. 用手机/另一浏览器打开同一地址，**刷新即可看到刚才录入的内容**（Cloudflare 重新构建约需 1 分钟；必要时 `Ctrl+Shift+R` 硬刷新）

> 函数代码见 `functions/api/submit.js`。Token 始终留在 Cloudflare 环境变量中，前端代码与公开仓库都拿不到，因此多用户可安全投稿。
> 若未配置好 Token/环境变量，提交会**自动降级为本机草稿**（仅自己可见），不会报错——所以若发现还是只有本地可见，请先检查第 4 步三个变量是否填对。

### 5. 日后每日更新

**脚本 / 手动新增：**
```bash
python tools/add_post.py --title "..." --category ... --summary "..."
python tools/add_post.py --build      # 写完正文后重新打包
git add . && git commit -m "add: ..." && git push
```

**网页录入的新内容（方案 B / Cloudflare Pages）：**
直接点「✎ 录入内容 → 提交发布」即可，自动进 `content/` 并同步给所有人；无需手动合并。
（仍可在浏览器用「🗑 删除本文」清掉自己本机的临时显示副本。）

**网页录入的新内容（方案 A / GitHub Pages 或无后端）：**
```bash
# 1) 网站上「✎ 录入内容」→「⬇ 导出录入内容」下载 JSON，放到 content/_drafts/local_entries.json
# 2) 合并进 content/ 并重建 posts.js：
python tools/merge_local.py
# 3) 提交推送：git add . && git commit -m "add: 合并网页录入内容" && git push
# 4) 回浏览器用「🗑 删除本文」清掉对应本机草稿
```

---

## 五、自定义

- **站点名称 / 标语**：改 `index.html` 中的 `知元 · 通识学社` 文本，以及 `assets/js/app.js` 顶部 `CONFIG.siteName`。
- **主题分类与配色**：改 `assets/js/app.js` 中的 `CONFIG.categories`（含每个分类的 `color`）。
- **视觉风格**：改 `assets/css/style.css` 顶部 `:root` 里的 CSS 变量。

---

© 知元 · 通识学社 · 内容由本站编辑每日整理发布
