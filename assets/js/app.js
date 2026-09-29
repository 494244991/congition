/* =========================================================
 * 知元 · 通识学社 —— 前端逻辑
 * 单页应用 + hash 路由
 * - 每个主题（分类）是一个超链接，点进去显示该主题【最新】内容
 * - 在阅读页可【前后翻页】浏览该主题下其它内容
 * - 可【切换成表格（目录）】列出该主题下所有标题，点击即读
 * - 内容来自 content/posts.js（内置文章）+ 浏览器 localStorage（网页端录入）
 * 网页端「✎ 录入内容」：选主题、填标题与正文，提交后立即显示（存本机）；
 * 每日新增正式文章：写一篇 .md 并登记进 manifest.json（或用 tools/add_post.py）
 * ========================================================= */

const CONFIG = {
  siteName: "知元 · 通识学社",
  categories: [
    { id: "management",   label: "管理与经济", color: "#2e7d6b" },
    { id: "philosophy",   label: "哲学与逻辑", color: "#5b6b9e" },
    { id: "psychology",   label: "心理学",     color: "#c2774f" },
    { id: "sociology",    label: "社会学",     color: "#3f7ba6" },
    { id: "communication", label: "口才与交际", color: "#b5893f" },
    { id: "ai-tech",      label: "AI与科技",   color: "#2b6f8f" },
    { id: "misc",         label: "杂谈",       color: "#8a6d9e",
      sub: ["时事政治","媒体","文化","文学","艺术","地理","旅游"] },
  ],
};

const CAT_MAP = Object.fromEntries(CONFIG.categories.map(c => [c.id, c]));
const ALL_CAT = { id: "all", label: "全部", color: "var(--accent)" };

// 默认仓库（公开，仅用于读者端自动同步最新内容；写回仍需用户在「⚙ 设置」填 Token）
const DEFAULT_REPO = "494244991/congition";
const DEFAULT_BRANCH = "main";

const LS_KEY = "zhiyuan_user_posts";   // 网页端录入的内容存这里
const state = { posts: [], ready: false, cur: null };

/* ---------- 本机录入内容（localStorage） ---------- */
function loadUserPosts() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch (e) { return []; }
}
function saveUserPosts(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
function refreshPosts() {
  const base = window.__POSTS__ || [];
  // 若某篇已存在于正式数据（posts.js，说明已提交到仓库），则丢弃本机草稿副本，避免重复显示
  const baseIds = new Set(base.map((p) => p.id));
  const user = loadUserPosts().filter((p) => !baseIds.has(p.id));
  state.posts = base.concat(user);
}

/* ---------- 浏览器直连 GitHub（多人共享，无需后端） ---------- */
const GH_CFG_KEY = "zhiyuan_gh_config";
function loadGhConfig() {
  try { return JSON.parse(localStorage.getItem(GH_CFG_KEY) || "{}"); } catch { return {}; }
}
function saveGhConfig(c) {
  if (c && c.token && c.repo) localStorage.setItem(GH_CFG_KEY, JSON.stringify(c));
  else localStorage.removeItem(GH_CFG_KEY);
}
// UTF-8 安全的 base64（GitHub Contents API 要求）
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
function fromB64(s) { return decodeURIComponent(escape(atob((s || "").replace(/\s+/g, "")))); }

/* ---------- 读者端：自动同步最新内容（无需配置，走 jsDelivr 公开镜像） ---------- */
// 读者只需知道仓库即可拉取最新 posts.js；Token 仅用于写回，不强制
function readConfig() {
  const c = loadGhConfig();
  return { token: c.token || "", repo: c.repo || DEFAULT_REPO, branch: c.branch || DEFAULT_BRANCH };
}
function parsePostsJs(txt) {
  const m = (txt || "").match(/window\.__POSTS__\s*=\s*(\[[\s\S]*\])\s*;/);
  if (!m) return null;
  try { const a = JSON.parse(m[1]); return Array.isArray(a) ? a : null; } catch { return null; }
}
// 从 jsDelivr（CORS 友好、无限流）拉取最新 posts.js；带分钟级缓存击穿参数，保证回源到最新
async function fetchLivePosts() {
  const cfg = readConfig();
  if (!cfg.repo) return null;
  const bust = Math.floor(Date.now() / 60000); // 每分钟变一次，强制回源
  const url = `https://cdn.jsdelivr.net/gh/${cfg.repo}@${cfg.branch || "main"}/content/posts.js?_=${bust}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const txt = await res.text();
    return parsePostsJs(txt);
  } catch (e) { console.warn("live fetch failed:", e && e.message); return null; }
}
let __baseSig = "";
function baseSignature(arr) { return (arr || []).map(p => p.id).sort().join("|"); }
// 拉取并合并最新内容；force=true 时即便与本地一致也重绘（用于首次/手动刷新）
async function refreshFromGitHub(force) {
  const arr = await fetchLivePosts();
  if (!arr || !Array.isArray(arr)) return false;
  const sig = baseSignature(arr);
  if (!force && sig === __baseSig) return false; // 无变化，不重绘、不跳滚动
  __baseSig = sig;
  window.__POSTS__ = arr;
  refreshPosts();
  const y = window.scrollY;
  if (state.ready) router();
  requestAnimationFrame(() => window.scrollTo(0, y));
  updateLastUpdated();
  return true;
}
function updateLastUpdated() {
  const el = $("#syncInfo");
  if (!el) return;
  const t = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  el.textContent = "已同步 " + t;
}

async function ghGet(path, cfg) {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${cfg.branch || "main"}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zhiyuan",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("GitHub GET " + path + ": " + res.status);
  return res.json();
}
async function ghPut(path, content, message, cfg, sha) {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const body = { message, content: b64(content), branch: cfg.branch || "main" };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zhiyuan",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("GitHub PUT " + path + ": " + res.status + " " + t.slice(0, 200));
  }
  return res.json();
}
// 把投稿直接写入仓库：.md + manifest.json + 重建 posts.js；标题重复抛 {status:409}
async function submitToGitHub(payload, cfg) {
  const mf = await ghGet("content/manifest.json", cfg);
  let posts = mf ? JSON.parse(fromB64(mf.content)) : [];
  if (!Array.isArray(posts)) posts = [];
  if (posts.some((p) => (p.title || "").trim().toLowerCase() === payload.title.trim().toLowerCase()))
    throw { status: 409, message: "该标题已存在，请勿重复提交" };

  const ids = new Set(posts.map((p) => p.id));
  let fid = payload.id, n = 2;
  while (ids.has(fid)) fid = `${payload.date}-${slugFromTitle(payload.title)}-${n++}`;
  const fname = `content/${fid}.md`;
  const md = `# ${payload.title}\n\n${payload.body}\n`;
  await ghPut(fname, md, `add: ${payload.title}`, cfg, null);

  posts.push({
    id: fid, title: payload.title, date: payload.date, category: payload.category,
    subcategory: payload.subcategory || "", summary: payload.summary,
    tags: payload.tags || [], file: fname, author: payload.author,
  });
  await ghPut("content/manifest.json", JSON.stringify(posts, null, 2),
    `manifest: +${payload.title}`, cfg, mf ? mf.sha : null);

  // 重建 posts.js（内联所有正文），让站点立即生效
  try {
    const arr = [];
    for (const p of posts) {
      const f = await ghGet(p.file, cfg);
      arr.push({ ...p, body: f ? fromB64(f.content) : "" });
    }
    const postsJs = "window.__POSTS__ = " + JSON.stringify(arr, null, 1) + ";\n";
    const pjs = await ghGet("content/posts.js", cfg);
    await ghPut("content/posts.js", postsJs, `rebuild posts.js: +${payload.title}`, cfg, pjs ? pjs.sha : null);
  } catch (e) {
    console.warn("rebuild posts.js failed:", e && e.message);
  }
  return fid;
}

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s = "") => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtDate = (d) => (d || "").toString();
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function readingMinutes(t = "") {
  const cn = (t.match(/[一-龥]/g) || []).length;
  const en = (t.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.round(cn / 400 + en / 200));
}
// 取某分类下的文章（按日期倒序）；"all" 返回全部。同日期时本机录入的排前面
function postsOf(catId) {
  const list = catId === "all" ? state.posts : state.posts.filter(p => p.category === catId);
  return list.slice().sort((a, b) => {
    const d = (b.date || "").localeCompare(a.date || "");
    if (d !== 0) return d;
    return (b.local ? 1 : 0) - (a.local ? 1 : 0);
  });
}

/* ---------- 分类导航 ---------- */
function renderNav(activeId) {
  const nav = $("#catNavInner");
  const items = [ALL_CAT, ...CONFIG.categories];
  nav.innerHTML = items.map(c =>
    `<div class="cat-chip${c.id === (activeId || "all") ? " active" : ""}" data-cat="${c.id}">${esc(c.label)}</div>`
  ).join("");
  nav.querySelectorAll(".cat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.cat;
      location.hash = id === "all" ? "#/" : "#/cat/" + id;
    });
  });
}

/* ---------- 卡片 ---------- */
function cardHTML(p, featured = false) {
  const cat = CAT_MAP[p.category] || ALL_CAT;
  const sub = p.subcategory ? ` · ${esc(p.subcategory)}` : "";
  const tag = `<span class="card-tag" style="background:${cat.color}">${esc(cat.label)}${sub}</span>`;
  const meta = `<div class="card-meta"><span>${fmtDate(p.date)}</span>${p.author ? `<span class="dot"></span><span>供稿 ${esc(p.author)}</span>` : ""}</div>`;
  if (featured) {
    return `<article class="card featured" data-id="${esc(p.id)}">
      <div class="card-body">${tag}<h3 class="card-title">${esc(p.title)}</h3>
      <p class="card-summary">${esc(p.summary || "")}</p>${meta}</div></article>`;
  }
  return `<article class="card" data-id="${esc(p.id)}">${tag}
    <h3 class="card-title">${esc(p.title)}</h3>
    <p class="card-summary">${esc(p.summary || "")}</p>${meta}</article>`;
}

/* ---------- 首页 ---------- */
function renderHome() {
  const all = postsOf("all");
  const featured = all[0];
  $("#featured").innerHTML = featured ? cardHTML(featured, true) : "";
  $("#listHint").textContent = `共 ${all.length} 篇`;
  $("#postList").innerHTML = all.slice(1, 10).map(p => cardHTML(p)).join("");
  bindCards();
}

/* ---------- 搜索 ---------- */
function renderSearch(q) {
  const kw = q.trim().toLowerCase();
  const hits = state.posts.filter(p => {
    const hay = [p.title, p.summary, p.subcategory, (p.tags || []).join(" "),
      (CAT_MAP[p.category] || {}).label].join(" ").toLowerCase();
    return hay.includes(kw);
  });
  $("#searchTitle").textContent = `搜索 “${esc(q)}” · ${hits.length} 条结果`;
  $("#searchList").innerHTML = hits.length
    ? hits.map(p => cardHTML(p)).join("")
    : `<p class="empty-state">没有找到匹配的内容，换个关键词试试？</p>`;
  bindCards();
}

/* ---------- 主题阅读页（最新 + 翻页 + 目录表格） ---------- */
async function renderReader(postId) {
  const post = state.posts.find(x => x.id === postId);
  if (!post) { $("#postArticle").innerHTML = `<p>未找到该文章。</p>`; return; }
  const catId = post.category;
  const cat = CAT_MAP[catId] || ALL_CAT;
  const list = postsOf(catId);
  const index = Math.max(0, list.findIndex(p => p.id === postId));
  state.cur = { catId, index, list, id: postId };

  // 文章内容（已内联在 posts.js 的 body 字段，无需 fetch）
  // 正文开头可能含 “# 标题”（manifest 中已单独渲染标题），去掉首行 H1 避免重复
  let md = post.body || "";
  md = md.replace(/^\s*#\s+.*\r?\n+/, "");
  const html = (window.marked && marked.parse) ? marked.parse(md) : `<pre>${esc(md)}</pre>`;
  const sub = post.subcategory ? ` · ${esc(post.subcategory)}` : "";
  const metaBits = [fmtDate(post.date), `约 ${readingMinutes(md)} 分钟阅读`];
  if (post.author) metaBits.push("供稿人：" + esc(post.author));
  $("#postArticle").innerHTML = `
    <span class="post-cat" style="background:${cat.color}">${esc(cat.label)}${sub}</span>
    <h1 class="post-title">${esc(post.title)}</h1>
    <div class="post-meta">${metaBits.map(esc).join(" &nbsp;·&nbsp; ")}</div>
    <div class="post-body">${html}</div>`;

  // 翻页控件
  const n = list.length;
  $("#readerPos").textContent = `第 ${index + 1} / ${n} 篇`;
  $("#prevBtn").disabled = index <= 0;
  $("#nextBtn").disabled = index >= n - 1;
  $("#prevBtn").onclick = () => { if (index > 0) goPost(list[index - 1].id); };
  $("#nextBtn").onclick = () => { if (index < n - 1) goPost(list[index + 1].id); };

  // 目录表格
  $("#tableTitle").textContent = cat.label + " · 目录";
  $("#tableBody").innerHTML = list.map((p, i) => `
    <tr data-id="${esc(p.id)}" class="${p.id === postId ? "cur" : ""}">
      <td class="t-title">${esc(p.title)}</td>
      <td>${esc(p.author || "—")}</td>
      <td>${fmtDate(p.date)}</td>
    </tr>`).join("");
  $("#tableBody").querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => goPost(tr.dataset.id));
  });

  // 重置为阅读视图（隐藏表格）
  showTable(false);

  // 本机录入的文章显示删除按钮
  const delBtn = $("#deleteBtn");
  delBtn.hidden = !post.local;
  delBtn.onclick = () => {
    if (!confirm("确定删除本机录入的《" + post.title + "》吗？")) return;
    const remain = loadUserPosts().filter(p => p.id !== post.id);
    saveUserPosts(remain);
    refreshPosts();
    location.hash = "#/cat/" + post.category;   // 回到该主题最新一篇
  };

  document.title = post.title + " · " + CONFIG.siteName;
  $("#postArticle").scrollIntoView({ behavior: "smooth", block: "start" });
}
function goPost(id) { location.hash = "#/post/" + id; }

function showTable(on) {
  $("#postTable").hidden = !on;
  $("#postArticle").hidden = on;
  $("#toggleTableBtn").textContent = on ? "✕ 关闭目录" : "☰ 目录";
}

/* ---------- 卡片点击 ---------- */
function bindCards() {
  document.querySelectorAll(".card[data-id]").forEach(card => {
    card.addEventListener("click", () => goPost(card.dataset.id));
  });
}

/* ---------- 视图切换 ---------- */
function showView(name) {
  ["home", "post", "search", "new"].forEach(v => { const el = $("#view-" + v); if (el) el.hidden = (v !== name); });
}

/* ---------- 录入表单 ---------- */
function initForm() {
  const fCat = $("#fCat"), fSub = $("#fSub"), fSubWrap = $("#fSubWrap");
  fCat.innerHTML = CONFIG.categories.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  const miscCat = CONFIG.categories.find(c => c.id === "misc");
  fSub.innerHTML = miscCat.sub.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  const syncSub = () => { fSubWrap.hidden = fCat.value !== "misc"; };
  fCat.addEventListener("change", syncSub);
  syncSub();
}

function slugFromTitle(title) {
  return title.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "post";
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = $("#fTitle").value.trim();
  const body = $("#fBody").value.trim();
  const summary = $("#fSummary").value.trim();
  if (!title || !body || !summary) { alert("标题、摘要、正文都不能为空。"); return; }

  const category = $("#fCat").value;
  const subcategory = category === "misc" ? $("#fSub").value : "";
  const author = $("#fAuthor").value.trim() || "知元编辑部";
  const tags = $("#fTags").value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
  const date = todayStr();
  const slug = slugFromTitle(title);
  const proposedId = `${date}-${slug}`;

  const payload = { id: proposedId, title, date, category, subcategory, summary, tags, author, body };

  // 提交通道：① Cloudflare 服务端 /api/submit → ② 浏览器直连 GitHub → ③ 本机草稿
  let mode = null;     // "cloudflare" | "github" | "local"
  let savedId = proposedId;

  // ① Cloudflare（部署了 functions/api/submit 才有效）
  try {
    const r = await fetch("/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.status === 409) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "该标题已存在，请勿重复提交。");
      return;
    }
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      savedId = (j && j.id) || proposedId;
      mode = "cloudflare";
    }
  } catch (_) { /* 未部署 Cloudflare：继续尝试下一通道 */ }

  // ② 浏览器直连 GitHub（在「⚙ 设置」里填过 Token）
  if (!mode) {
    const cfg = loadGhConfig();
    if (cfg && cfg.token && cfg.repo) {
      try {
        savedId = await submitToGitHub(payload, cfg);
        mode = "github";
      } catch (err) {
        if (err && err.status === 409) { alert(err.message || "该标题已存在，请勿重复提交。"); return; }
        console.warn("GitHub 直连提交失败：", err && err.message);
        // 失败则退到本机草稿
      }
    }
  }

  // ③ 本机草稿（仅自己可见）
  if (!mode) {
    const exist = new Set(state.posts.map(p => p.id));
    let id = proposedId, n = 2;
    while (exist.has(id)) id = `${date}-${slug}-${n++}`;
    savedId = id;
    mode = "local";
  }

  // 本地留一份镜像，保证提交者本人即时看到；服务端文章标记 local:false 避免与 posts.js 重复
  const saved = { ...payload, id: savedId, local: mode !== "local" ? false : true };
  const userPosts = loadUserPosts();
  const idx = userPosts.findIndex(p => p.id === savedId);
  if (idx >= 0) userPosts[idx] = saved; else userPosts.push(saved);
  saveUserPosts(userPosts);
  refreshPosts();

  $("#newForm").reset();
  $("#fAuthor").value = "知元编辑部";
  initForm();
  location.hash = "#/post/" + savedId;

  if (mode === "cloudflare" || mode === "github") {
    showBanner("✅ 已提交到网站 content/ 目录，约 1 分钟内所有访客会自动刷新看到（无需手动刷新）。", "ok");
  } else {
    showBanner("💾 已保存到本机浏览器（仅自己可见）。点右上角「⚙ 设置」填入 GitHub Token，即可让所有人共享。", "warn");
  }
  updateModeBadge();
}

function handleExport() {
  const userPosts = loadUserPosts();
  if (!userPosts.length) { alert("还没有录入任何内容。"); return; }
  const blob = new Blob([JSON.stringify(userPosts, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "录入内容导出.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- 提交状态提示 ---------- */
function showBanner(msg, kind) {
  const b = $("#submitBanner");
  if (!b) return;
  b.textContent = msg;
  b.className = "submit-banner " + (kind === "ok" ? "ok" : "warn");
  b.hidden = false;
  clearTimeout(window.__bn);
  window.__bn = setTimeout(() => { b.hidden = true; }, 9000);
}

/* ---------- 共享模式徽标 ---------- */
function updateModeBadge() {
  const b = $("#modeBadge");
  if (!b) return;
  const c = loadGhConfig();
  if (c && c.token && c.repo) {
    b.textContent = "● 共享已开启（GitHub）";
    b.className = "mode-badge on";
  } else {
    b.textContent = "○ 本机模式（⚙ 设置开启共享）";
    b.className = "mode-badge off";
  }
}

/* ---------- 设置面板（浏览器直连 GitHub） ---------- */
function openSettings() {
  const c = loadGhConfig();
  $("#setToken").value = c.token || "";
  $("#setRepo").value = c.repo || "494244991/congition";
  $("#setBranch").value = c.branch || "main";
  $("#setStatus").textContent = "";
  $("#settingsModal").hidden = false;
}
function closeSettings() { $("#settingsModal").hidden = true; }
async function testGhConnection() {
  const c = {
    token: $("#setToken").value.trim(),
    repo: $("#setRepo").value.trim(),
    branch: $("#setBranch").value.trim() || "main",
  };
  const st = $("#setStatus");
  if (!c.token || !c.repo) { st.textContent = "❌ 请先填写 Token 和仓库名"; st.className = "modal-status warn"; return; }
  st.textContent = "测试中…"; st.className = "modal-status";
  try {
    const r = await fetch(
      `https://api.github.com/repos/${c.repo}/contents/content/manifest.json?ref=${c.branch}`,
      { headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json" } }
    );
    if (r.ok) { st.textContent = "✅ 连接成功，可写入。"; st.className = "modal-status ok"; }
    else st.textContent = `❌ 失败：${r.status}（检查 Token 权限或仓库名/分支）`;
  } catch (err) {
    st.textContent = "❌ 网络错误：" + (err && err.message);
  }
}

/* ---------- 路由 ---------- */
function router() {
  if (!state.ready) return;
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/");
  let [seg, param] = parts;
  // 浏览器会把 hash 里的中文百分号编码，这里还原
  try { if (param) param = decodeURIComponent(param); } catch (e) { /* 保持原样 */ }

  if (seg === "new") {
    renderNav("all");
    showView("new");
    window.scrollTo(0, 0);
  } else if (seg === "cat" && param) {
    // 进入某主题：显示该主题最新一篇
    const list = postsOf(param);
    renderNav(param);
    showView("post");
    if (list.length) renderReader(list[0].id);
    else $("#postArticle").innerHTML = `<p class="empty-state">该主题暂无内容。</p>`;
    window.scrollTo(0, 0);
  } else if (seg === "post" && param) {
    const p = state.posts.find(x => x.id === param);
    renderNav(p ? p.category : "all");
    showView("post");
    renderReader(param);
  } else if (seg === "search") {
    const q = new URLSearchParams(hash.split("?")[1] || "").get("q") || "";
    renderNav("all");
    showView("search");
    renderSearch(q);
    window.scrollTo(0, 0);
  } else {
    renderNav("all");
    showView("home");
    renderHome();
    window.scrollTo(0, 0);
  }
}

/* ---------- 交互绑定 ---------- */
$("#searchInput").addEventListener("input", (e) => {
  clearTimeout(window.__st);
  const v = e.target.value.trim();
  window.__st = setTimeout(() => {
    if (v) location.hash = "#/search?q=" + encodeURIComponent(v);
    else if ((location.hash || "#/").startsWith("#/search")) location.hash = "#/";
  }, 280);
});
$("#backBtn").addEventListener("click", () => { location.hash = "#/"; });
$("#randomBtn").addEventListener("click", () => {
  if (!state.posts.length) return;
  const r = state.posts[Math.floor(Math.random() * state.posts.length)];
  goPost(r.id);
});
$("#toggleTableBtn").addEventListener("click", () => showTable($("#postTable").hidden));

/* ---------- 录入表单绑定 ---------- */
$("#newForm").addEventListener("submit", handleFormSubmit);
$("#fExport").addEventListener("click", handleExport);
$("#fReset").addEventListener("click", () => {
  $("#newForm").reset();
  $("#fAuthor").value = "知元编辑部";
  initForm();
});

/* ---------- 设置面板绑定 ---------- */
$("#settingsBtn").addEventListener("click", openSettings);
$("#settingsClose").addEventListener("click", closeSettings);
$("#settingsMask").addEventListener("click", closeSettings);
$("#setSave").addEventListener("click", () => {
  saveGhConfig({
    token: $("#setToken").value.trim(),
    repo: $("#setRepo").value.trim(),
    branch: $("#setBranch").value.trim() || "main",
  });
  closeSettings();
  updateModeBadge();
  showBanner("✅ 设置已保存。现在投稿会直接写入 GitHub 仓库，所有人可见。", "ok");
});
$("#setTest").addEventListener("click", testGhConnection);
$("#setClear").addEventListener("click", () => {
  saveGhConfig({});
  closeSettings();
  updateModeBadge();
  showBanner("已清除 GitHub 设置，投稿将仅存本机。", "warn");
});
$("#refreshBtn").addEventListener("click", async () => {
  const btn = $("#refreshBtn");
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "🔄 同步中…";
  const ok = await refreshFromGitHub(true);
  btn.textContent = old; btn.disabled = false;
  showBanner(ok ? "🔄 已同步最新内容。" : "⚠️ 同步失败，稍后自动重试。", ok ? "ok" : "warn");
});

/* ---------- 启动 ---------- */
function init() {
  $("#year").textContent = new Date().getFullYear();
  refreshPosts();   // 内置文章(posts.js) + 本机录入(localStorage)
  __baseSig = baseSignature(window.__POSTS__ || []);
  updateModeBadge();
  if (!state.posts.length) {
    showView("home");
    $("#featured").innerHTML = "";
    $("#postList").innerHTML = `<p class="empty-state">还没有任何内容。点右上角「✎ 录入内容」写下第一篇吧。</p>`;
  }
  state.ready = true;
  initForm();
  window.addEventListener("hashchange", router);
  router();
  // 读者端：打开即同步最新内容（jsDelivr 公开镜像，无需任何配置），并每 60 秒自动轮询
  refreshFromGitHub(true).then(ok => { if (ok) updateModeBadge(); });
  setInterval(() => {
    if (document.visibilityState === "visible") refreshFromGitHub(false);
  }, 60000);
}
document.addEventListener("DOMContentLoaded", init);
