/* =========================================================
 * 知元 · 通识学社 —— 前端逻辑
 * 单页应用 + hash 路由；内容来自 content/manifest.json + Markdown 文件
 * 每日新增内容只需：写一篇 .md，并把它登记进 manifest.json
 * （也可用 tools/add_post.py 一键完成）
 * ========================================================= */

const CONFIG = {
  siteName: "知元 · 通识学社",
  // 主题分类：顺序即导航顺序；misc 含子分类
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

// 分类查找工具
const CAT_MAP = Object.fromEntries(CONFIG.categories.map(c => [c.id, c]));
const ALL_CAT = { id: "all", label: "全部", color: "var(--accent)" };

const state = {
  posts: [],
  ready: false,
  cache: {}, // id -> md 文本
};

/* ---------- 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s = "") => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtDate = (d) => (d || "").toString();

function readingMinutes(text = "") {
  const cn = (text.match(/[一-龥]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.max(1, Math.round(cn / 400 + en / 200));
}

/* ---------- 数据加载 ---------- */
async function loadManifest() {
  const res = await fetch("content/manifest.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("manifest " + res.status);
  let data = await res.json();
  // 兼容对象或数组两种写法
  if (!Array.isArray(data)) data = data.posts || [];
  data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  state.posts = data;
  state.ready = true;
}

async function loadMarkdown(file) {
  if (state.cache[file]) return state.cache[file];
  const res = await fetch(file, { cache: "no-cache" });
  if (!res.ok) throw new Error("file " + file + " " + res.status);
  const text = await res.text();
  state.cache[file] = text;
  return text;
}

/* ---------- 渲染：分类导航 ---------- */
function renderNav(activeId) {
  const nav = $("#catNavInner");
  const items = [ALL_CAT, ...CONFIG.categories];
  nav.innerHTML = items.map(c => {
    const active = c.id === (activeId || "all") ? " active" : "";
    return `<div class="cat-chip${active}" data-cat="${c.id}">${esc(c.label)}</div>`;
  }).join("");
  nav.querySelectorAll(".cat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.cat;
      if (id === "all") location.hash = "#/";
      else location.hash = "#/cat/" + id;
    });
  });
}

/* ---------- 渲染：单张卡片 ---------- */
function cardHTML(p, featured = false) {
  const cat = CAT_MAP[p.category] || ALL_CAT;
  const sub = p.subcategory ? ` · ${esc(p.subcategory)}` : "";
  const tag = `<span class="card-tag" style="background:${cat.color}">${esc(cat.label)}${sub}</span>`;
  const meta = `<div class="card-meta"><span>${fmtDate(p.date)}</span>${p.author ? `<span class="dot"></span><span>${esc(p.author)}</span>` : ""}</div>`;
  if (featured) {
    return `<article class="card featured" data-id="${esc(p.id)}">
      <div class="card-body">
        ${tag}
        <h3 class="card-title">${esc(p.title)}</h3>
        <p class="card-summary">${esc(p.summary || "")}</p>
        ${meta}
      </div>
    </article>`;
  }
  return `<article class="card" data-id="${esc(p.id)}">
    ${tag}
    <h3 class="card-title">${esc(p.title)}</h3>
    <p class="card-summary">${esc(p.summary || "")}</p>
    ${meta}
  </article>`;
}

/* ---------- 渲染：首页 ---------- */
function renderHome(activeCat = "all") {
  const list = activeCat === "all" ? state.posts : state.posts.filter(p => p.category === activeCat);
  // hero 统计
  $("#heroStats").innerHTML = [
    ["主题", CONFIG.categories.length + " 类"],
    ["已发布", state.posts.length + " 篇"],
    ["最新", state.posts.length ? fmtDate(state.posts[0].date) : "—"],
  ].map(([k, v]) => `<div class="hero-stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");

  // 今日推荐（该分类下最新一篇）
  const featured = list[0];
  $("#featured").innerHTML = featured ? cardHTML(featured, true) : "";

  // 最近更新（最多 9 篇，跳过已作为推荐的那篇）
  const rest = list.slice(featured ? 1 : 0, (featured ? 1 : 0) + 9);
  $("#listHint").textContent = activeCat === "all" ? "共 " + list.length + " 篇" : CAT_MAP[activeCat].label + " · 共 " + list.length + " 篇";
  $("#postList").innerHTML = rest.map(p => cardHTML(p)).join("");
  bindCards();
}

/* ---------- 渲染：搜索 ---------- */
function renderSearch(q) {
  const kw = q.trim().toLowerCase();
  const hits = state.posts.filter(p => {
    const hay = [p.title, p.summary, p.subcategory, (p.tags || []).join(" "),
      (CAT_MAP[p.category] || {}).label].join(" ").toLowerCase();
    return hay.includes(kw);
  });
  $("#searchTitle").textContent = `搜索 “${esc(q)}” · ${hits.length} 条结果`;
  $("#searchList").innerHTML = hits.map(p => cardHTML(p)).join("") ||
    `<p class="empty-state">没有找到匹配的内容，换个关键词试试？</p>`;
  bindCards();
}

/* ---------- 渲染：文章详情 ---------- */
async function renderPost(id) {
  const p = state.posts.find(x => x.id === id);
  if (!p) { $("#postArticle").innerHTML = `<p>未找到该文章。</p>`; return; }
  const cat = CAT_MAP[p.category] || ALL_CAT;
  let md = "";
  try {
    md = await loadMarkdown(p.file);
  } catch (e) {
    $("#postArticle").innerHTML = `<p class="post-meta">无法加载文章内容（${esc(e.message)}）。若你是本地打开，请用本地服务器访问，见 README。</p>`;
    return;
  }
  const html = (window.marked && marked.parse) ? marked.parse(md) : `<pre>${esc(md)}</pre>`;
  const sub = p.subcategory ? ` · ${esc(p.subcategory)}` : "";
  const metaBits = [fmtDate(p.date), `约 ${readingMinutes(md)} 分钟阅读`];
  if (p.author) metaBits.push("文 / " + esc(p.author));
  $("#postArticle").innerHTML = `
    <span class="post-cat" style="background:${cat.color}">${esc(cat.label)}${sub}</span>
    <h1 class="post-title">${esc(p.title)}</h1>
    <div class="post-meta">${metaBits.map(esc).join(" &nbsp;·&nbsp; ")}</div>
    <div class="post-body">${html}</div>
  `;
  document.title = p.title + " · " + CONFIG.siteName;
  $("#postArticle").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- 卡片点击绑定 ---------- */
function bindCards() {
  document.querySelectorAll(".card[data-id]").forEach(card => {
    card.addEventListener("click", () => { location.hash = "#/post/" + card.dataset.id; });
  });
}

/* ---------- 视图切换 ---------- */
function showView(name) {
  ["home", "post", "search"].forEach(v => {
    const el = $("#view-" + v);
    if (el) el.hidden = (v !== name);
  });
}

/* ---------- 路由 ---------- */
function router() {
  if (!state.ready) return;
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/"); // ["", "cat", "misc", ...]
  const [seg, param] = parts;

  if (seg === "cat" && param) {
    renderNav(param);
    showView("home");
    renderHome(param);
    window.scrollTo(0, 0);
  } else if (seg === "post" && param) {
    renderNav(currentCatFromHash());
    showView("post");
    renderPost(param);
  } else if (seg === "search") {
    const q = new URLSearchParams(hash.split("?")[1] || "").get("q") || "";
    renderNav(currentCatFromHash());
    showView("search");
    renderSearch(q);
    window.scrollTo(0, 0);
  } else {
    renderNav("all");
    showView("home");
    renderHome("all");
    window.scrollTo(0, 0);
  }
}
function currentCatFromHash() {
  const m = (location.hash || "").match(/#\/cat\/([\w-]+)/);
  return m ? m[1] : "all";
}

/* ---------- 搜索输入 ---------- */
let searchTimer;
$("#searchInput").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value.trim();
  searchTimer = setTimeout(() => {
    if (v) location.hash = "#/search?q=" + encodeURIComponent(v);
    else if ((location.hash || "#/").startsWith("#/search")) location.hash = "#/";
  }, 280);
});

/* ---------- 返回 / 随机 ---------- */
$("#backBtn").addEventListener("click", () => {
  const cat = currentCatFromHash();
  location.hash = cat === "all" ? "#/" : "#/cat/" + cat;
});
$("#randomBtn").addEventListener("click", () => {
  if (!state.posts.length) return;
  const r = state.posts[Math.floor(Math.random() * state.posts.length)];
  location.hash = "#/post/" + r.id;
});

/* ---------- 启动 ---------- */
async function init() {
  $("#year").textContent = new Date().getFullYear();
  try {
    await loadManifest();
  } catch (e) {
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
