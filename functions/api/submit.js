// Cloudflare Pages Function —— 接收网页投稿并写入 GitHub 仓库的 content/ 目录
//
// 部署后在 Cloudflare Pages 控制台设置环境变量（绝不写进前端/仓库）：
//   GITHUB_TOKEN   —— 对该仓库有 Contents 读写权限的 Fine-grained Personal Access Token
//   GITHUB_REPO    —— 格式 owner/repo
//   GITHUB_BRANCH  —— 默认 main
//
// 路由：POST /api/submit
// 请求体 JSON：{ title, body, category, subcategory, summary, tags[], author, date?, id? }
// 成功后返回 { ok:true, id, file }；标题重复返回 409；参数缺失返回 400。

const API = "https://api.github.com";

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s) {
  const bin = atob((s || "").replace(/\s+/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function slugify(title) {
  let s = title.replace(/[^\w一-龥]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (!s) s = "post-" + Math.random().toString(36).slice(2, 8);
  return s.slice(0, 60);
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function ghFetch(path, method, body, env) {
  const url = `${API}/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH || "main"}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "zhiyuan-submit",
  };
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  return fetch(url, init);
}

// 读取仓库文件，返回 { content, sha }；不存在返回 null
async function readFile(path, env) {
  const res = await ghFetch(path, "GET", null, env);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  const data = await res.json();
  return { content: fromB64(data.content), sha: data.sha };
}

async function writeFile(path, content, message, env, sha) {
  const body = { message, content: b64(content), branch: env.GITHUB_BRANCH || "main" };
  if (sha) body.sha = sha;
  const res = await ghFetch(path, "PUT", body, env);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT ${path}: ${res.status} ${t}`);
  }
  return res.json();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO)
      return json({ error: "服务端未配置 GITHUB_TOKEN / GITHUB_REPO" }, 500);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "请求体不是合法 JSON" }, 400);
    }

    const { title, body, category, subcategory = "", summary, tags = [], author = "知元编辑部", date, id } = data;
    if (!title || !body || !summary)
      return json({ error: "标题、摘要、正文都不能为空" }, 400);
    if (body.length > 30000) return json({ error: "正文过长（上限 30000 字）" }, 400);

    const allowed = ["management", "philosophy", "psychology", "sociology", "communication", "ai-tech", "misc"];
    const cat = allowed.includes(category) ? category : "misc";
    const theDate = (date || new Date().toISOString().slice(0, 10));
    const baseSlug = id ? id.split("-").slice(1).join("-") : slugify(title);
    let fid = `${theDate}-${baseSlug}`;

    // 读取 manifest
    const manifestFile = await readFile("content/manifest.json", env);
    let posts = manifestFile ? JSON.parse(manifestFile.content) : [];
    if (!Array.isArray(posts)) posts = [];
    const lowers = new Set(posts.map((p) => (p.title || "").trim().toLowerCase()));
    if (lowers.has(title.trim().toLowerCase()))
      return json({ error: "该标题已存在，请勿重复提交" }, 409);

    // id 去重
    const ids = new Set(posts.map((p) => p.id));
    let k = fid, n = 2;
    while (ids.has(k)) k = `${theDate}-${baseSlug}-${n++}`;
    fid = k;
    const fname = `content/${fid}.md`;

    // 1) 写 .md
    const md = `# ${title}\n\n${body}\n`;
    await writeFile(fname, md, `add: ${title}`, env);

    // 2) 更新 manifest
    posts.push({
      id: fid, title, date: theDate, category: cat, subcategory,
      summary, tags: Array.isArray(tags) ? tags : [], file: fname, author,
    });
    await writeFile(
      "content/manifest.json",
      JSON.stringify(posts, null, 2),
      `manifest: +${title}`,
      env,
      manifestFile ? manifestFile.sha : null
    );

    // 3) 重建 posts.js（内联所有正文），让站点立即生效
    try {
      const arr = [];
      for (const p of posts) {
        const f = await readFile(p.file, env);
        arr.push({ ...p, body: f ? f.content : "" });
      }
      const postsJs = "window.__POSTS__ = " + JSON.stringify(arr, null, 1) + ";\n";
      const pjs = await readFile("content/posts.js", env);
      await writeFile("content/posts.js", postsJs, `rebuild posts.js: +${title}`, env, pjs ? pjs.sha : null);
    } catch (e) {
      // posts.js 重建失败不致命：.md 与 manifest 已更新，下次提交会重试
      console.warn("rebuild posts.js failed:", e.message);
    }

    return json({ ok: true, id: fid, file: fname });
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
}

export async function onRequestGet() {
  return json({ ok: true, service: "zhiyuan submit api", note: "使用 POST 向此端点投稿" });
}
