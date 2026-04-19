---
title: "个人站内容模型草案"
summary: "把研究进展拆成 idea、reading、experiment、writing、published 五个阶段。"
date: 2026-04-18
stage: "idea"
tags: ["个人知识库", "研究记录", "Astro"]
cover: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80"
---

先用轻量字段覆盖最常用的学术记录：

- `stage` 表示当前阶段。
- `tags` 用来串联主题。
- 正文保留自由度，可以写实验日志、论文笔记或短想法。

后面如果需要，可以单独加 `paperUrl`、`codeUrl`、`venue`、`collaborators` 等字段。
