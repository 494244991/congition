#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
merge_local.py —— 把网页端「✎ 录入内容」导出的 JSON 合并进 content/

为什么需要它：
  网页录入的内容只存在浏览器 localStorage 里，不会写进 content/、也不会同步到 GitHub。
  本脚本把导出的 JSON 变成正式文章：生成 .md、登记 manifest.json、重建 posts.js，
  之后 git push，所有人访问网站即可看到。

用法：
  1) 网站上「✎ 录入内容」→「⬇ 导出录入内容」，下载 JSON
  2) 把 JSON 放到 site/content/_drafts/local_entries.json
     或运行时直接传路径：python tools/merge_local.py 路径/录入内容导出.json
  3) 运行本脚本（自动生成 .md + 更新 manifest + 重建 posts.js）
  4) git add . && git commit -m "add: 合并网页录入内容" && git push
  5) 回浏览器用「🗑 删除本文」清掉对应本机草稿，避免重复显示
"""
import argparse
import json
import os
import sys

import add_post as core   # 复用 slugify / rebuild_bundle / 路径常量

ROOT = core.ROOT
CONTENT_DIR = core.CONTENT_DIR
MANIFEST = core.MANIFEST
DEFAULT_JSON = os.path.join(CONTENT_DIR, "_drafts", "local_entries.json")


def load_entries(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("posts", data.get("entries", []))
    if not isinstance(data, list):
        raise ValueError("JSON 顶层应为数组，或含 posts / entries 字段")
    return data


def main():
    ap = argparse.ArgumentParser(description="合并网页录入内容到 content/")
    ap.add_argument("json_path", nargs="?", default=DEFAULT_JSON,
                    help="导出的 JSON 路径（默认 content/_drafts/local_entries.json）")
    args = ap.parse_args()

    if not os.path.exists(args.json_path):
        print(f"❌ 找不到导出文件：{args.json_path}")
        print("   请先到网站「✎ 录入内容」页点「⬇ 导出录入内容」下载 JSON，")
        print("   保存到 content/_drafts/local_entries.json，或运行时传入路径。")
        sys.exit(1)

    try:
        entries = load_entries(args.json_path)
    except (json.JSONDecodeError, ValueError) as e:
        print(f"❌ 解析 JSON 失败：{e}")
        sys.exit(1)

    if not entries:
        print("⚠️ 导出文件为空，没有可合并的内容。")
        sys.exit(0)

    posts = []
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            try:
                posts = json.load(f)
                if not isinstance(posts, list):
                    posts = posts.get("posts", [])
            except json.JSONDecodeError:
                posts = []
    existing_ids = {p.get("id") for p in posts}
    existing_titles = {p.get("title", "").strip().lower() for p in posts}

    merged, skipped = [], []
    for e in entries:
        title = (e.get("title") or "").strip()
        if not title:
            skipped.append(("(无标题)", "跳过：标题为空"))
            continue
        if title.lower() in existing_titles:
            skipped.append((title, "跳过：manifest 中已存在同名文章"))
            continue

        category = e.get("category") or "misc"
        sub = e.get("subcategory") or ""
        summary = (e.get("summary") or "").strip() or title
        author = e.get("author") or "知元编辑部"
        tags = e.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        date = (e.get("date") or "").strip() or core.datetime.date.today().isoformat()
        body = (e.get("body") or "").strip()

        slug = core.slugify(title)
        fid = f"{date}-{slug}"
        k = 2
        while fid in existing_ids:
            fid = f"{date}-{slug}-{k}"
            k += 1
        existing_ids.add(fid)

        fname = f"{fid}.md"
        fpath = os.path.join(CONTENT_DIR, fname)
        md = f"# {title}\n\n{body}\n" if body else f"# {title}\n\n> 待补充正文。\n"
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(md)

        posts.append({
            "id": fid,
            "title": title,
            "date": date,
            "category": category,
            "subcategory": sub,
            "summary": summary,
            "tags": tags,
            "file": f"content/{fname}",
            "author": author,
        })
        merged.append((title, fname))

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    core.rebuild_bundle()

    print(f"✅ 合并完成：新增 {len(merged)} 篇，跳过 {len(skipped)} 篇。")
    for t, fn in merged:
        print(f"   + content/{fn}   《{t}》")
    for t, r in skipped:
        print(f"   - {t}  {r}")
    print("\n下一步（提交并推送，让所有人可见）：")
    print("   git add . && git commit -m \"add: 合并网页录入内容\" && git push")


if __name__ == "__main__":
    main()
