---
title: "静态站不是静止的站"
summary: "静态生成决定部署方式，不决定交互上限；组件和内容模型才是长期扩展的关键。"
date: 2026-04-18
category: "建站"
tags: ["Astro", "内容模型", "静态生成"]
cover: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80"
---

今天先把站点路线定为 Astro + GitHub Actions + Decap CMS。

几个判断：

- Markdown 适合承载正文。
- 内容集合适合承载结构化字段，比如年份、标签、状态、链接。
- 交互组件可以后加，不需要一开始就做完整前后端。

下一步可以补分页、标签页和搜索。
