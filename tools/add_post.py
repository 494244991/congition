#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
add_post.py —— 每日新增一篇主题内容（一键建文件 + 自动登记到 manifest.json）

用法示例：
  python tools/add_post.py --title "为什么我们容易焦虑" --category psychology --summary "从进化角度理解现代焦虑"
  python tools/add_post.py --title "重读《活着》" --category misc --subcategory 文学 --summary "苦难叙事下的生命韧性"

参数：
  --title        文章标题（必填）
  --category     分类 id：management / philosophy / psychology / sociology /
                 communication / ai-tech / misc
  --subcategory  仅 misc 需要：时事政治/媒体/文化/文学/艺术/地理/旅游
  --summary      一句话摘要（必填，显示在卡片上）
  --date         发布日期 YYYY-MM-DD（默认今天）
  --author       作者（默认：知元编辑部）
  --tags         标签，用逗号分隔，如 焦虑,心理,进化
  --slug         自定义文件名片段（可选，默认按标题自动生成）

创建后，请打开生成的 .md 文件，把模板里的占位内容替换成正文即可。
正文使用 Markdown 语法，# 为标题、> 为引用、- 为列表。
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(ROOT, "content")
MANIFEST = os.path.join(CONTENT_DIR, "manifest.json")

CATEGORIES = ["management", "philosophy", "psychology",
              "sociology", "communication", "ai-tech", "misc"]
MISC_SUBS = ["时事政治", "媒体", "文化", "文学", "艺术", "地理", "旅游"]


def slugify(title):
    s = re.sub(r"[^\w一-龥]+", "-", title).strip("-").lower()
    s = re.sub(r"-+", "-", s)
    if not s:                                    # 完全无法提取时退化为短哈希
        s = "post-" + hashlib.md5(title.encode("utf-8")).hexdigest()[:6]
    return s[:60]


def main():
    ap = argparse.ArgumentParser(description="新增一篇主题内容")
    ap.add_argument("--title", required=True)
    ap.add_argument("--category", required=True, choices=CATEGORIES)
    ap.add_argument("--subcategory", default="")
    ap.add_argument("--summary", required=True)
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--author", default="知元编辑部")
    ap.add_argument("--tags", default="")
    ap.add_argument("--slug", default="")
    args = ap.parse_args()

    if args.category == "misc" and args.subcategory and args.subcategory not in MISC_SUBS:
        print(f"提示：misc 子分类建议取自 {MISC_SUBS}，已按你输入保留。")

    os.makedirs(CONTENT_DIR, exist_ok=True)
    slug = args.slug or slugify(args.title)
    fname = f"{args.date}-{slug}.md"
    fpath = os.path.join(CONTENT_DIR, fname)

    if os.path.exists(fpath):
        print(f"⚠️ 文件已存在：{fpath}\n请换一个标题或加 --slug 区分。")
        sys.exit(1)

    template = f"""# {args.title}

> 在这里写一句引言或核心观点（可选，用 > 引用）。

## 正文小标题（可删改）

在这里撰写正文。支持 Markdown：
- 列表项一
- 列表项二

**加粗**、*斜体*、[链接](https://example.com) 都可以用。

> 金句或总结可以用引用块突出。
"""
    with open(fpath, "w", encoding="utf-8") as f:
        f.write(template)
    print(f"✅ 已创建文章文件：{os.path.relpath(fpath, ROOT)}")

    # 更新 manifest
    posts = []
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            try:
                posts = json.load(f)
                if not isinstance(posts, list):
                    posts = posts.get("posts", [])
            except json.JSONDecodeError:
                posts = []
    entry = {
        "id": f"{args.date}-{slug}",
        "title": args.title,
        "date": args.date,
        "category": args.category,
        "subcategory": args.subcategory,
        "summary": args.summary,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "file": f"content/{fname}",
        "author": args.author,
    }
    posts.append(entry)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    print(f"✅ 已登记到 content/manifest.json（当前共 {len(posts)} 篇）")
    print(f"\n下一步：编辑 {os.path.relpath(fpath, ROOT)} 写入正文，然后提交并推送到 GitHub。")


if __name__ == "__main__":
    main()
