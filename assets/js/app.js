/* =========================================================
 * 知元 · 通识学社 —— 前端逻辑
 * 单页应用 + hash 路由
 * - 每个主题（分类）是一个超链接，点进去显示该主题【最新】内容
 * - 在阅读页可【前后翻页】浏览该主题下其它内容
 * - 可【切换成表格（目录）】列出该主题下所有标题，点击即读
 * - 内容来自 content/manifest.json + 各 Markdown 文件
 * 每日新增：写一篇 .md，并登记进 manifest.json（或用 tools/add_post.py）
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

const state = { posts: [], ready: false, cache: {}, cur: null };

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s = "") => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtDate = (d) => (d || "").toString();
function readingMinutes(t = "") {
  const cn = (t.match(/[一-龥]/g) || []).length;
  const en = (t.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.round(cn / 400 + en / 200));
}
// 取某分类下的文章（按日期倒序）；"all" 返回全部
function postsOf(catId) {
  const list = catId === "all" ? state.posts : state.posts.filter(p => p.category === catId);
  return list.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/* ---------- 数据加载 ---------- */
async function loadManifest() {
  const res = await fetch("content/manifest.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("manifest " + res.status);
  let data = await res.json();
  if (!Array.isArray(data)) data = data.posts || [];
  state.posts = data;
  state.ready = true;
}
async function loadMarkdown(file) {
  if (state.cache[file]) return state.cache[file];
  const res = await fetch(file, { cache: "no-cache" });
  if (!res.ok) throw new Error("file " + file + " " + res.status);
  const t = await res.text();
  state.cache[file] = t;
  return t;
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
  $("#heroStats").innerHTML = [
    ["主题", CONFIG.categories.length + " 类"],
    ["已发布", state.posts.length + " 篇"],
    ["最新", state.posts.length ? fmtDate(postsOf("all")[0].date) : "—"],
  ].map(([k, v]) => `<div class="hero-stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");

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

  // 文章内容
  let md;
  try { md = await loadMarkdown(post.file); }
  catch (e) {
    $("#postArticle").innerHTML = `<p class="post-meta">无法加载文章内容（${esc(e.message)}）。若是本地双击打开，请用本地服务器，见 README。</p>`;
    return;
  }
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
  ["home", "post", "search"].forEach(v => { const el = $("#view-" + v); if (el) el.hidden = (v !== name); });
}

/* ---------- 路由 ---------- */
function router() {
  if (!state.ready) return;
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/");
  const [seg, param] = parts;

  if (seg === "cat" && param) {
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

/* ---------- 启动 ---------- */
async function init() {
  $("#year").textContent = new Date().getFullYear();
  try { await loadManifest(); }
  catch (e) {
    showView("home");
    $("#featured").innerHTML = "";
    $("#postList").innerHTML = `<p class="empty-state">无法加载内容清单（${esc(e.message)}）。<br>
      若你是直接双击打开本文件，浏览器会拦截本地读取。请在本文件夹运行 <code>python -m http.server 8000</code><br>
      然后访问 <code>http://localhost:8000</code> 。详见 README.md。</p>`;
    return;
  }
  window.addEventListener("hashchange", router);
  router();
}
document.addEventListener("DOMContentLoaded", init);
