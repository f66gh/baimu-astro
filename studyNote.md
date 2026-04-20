# Aiu Web 项目阶段总结

更新时间：2026-04-20

这份笔记是给以后换电脑、继续开发、接音乐专区时看的。它把最初的规划、当前已经完成的实现、目录结构和下一步建议放在一起。

## 1. 最初目标

目标是做一个高度定制的个人主页/个人内容站，而不是只放一张简历式学术主页。

主要内容包括：

- 学术进展：论文阅读、组内任务、阶段性总结。
- 个人笔记：和组内研究不强绑定的学习记录，比如 WSL、EDA、组合优化等。
- 追番列表：按观看时间、是否重看、评分、题材和观后感整理看完的番。
- 音乐专区：后续要重点做，目标类似音乐收藏库或歌单墙。
- 图片预览、详情页、分类、列表/卡片视图、分页、移动端适配。
- 以后可以继续加图表、动态模块、互动组件和更多花活。

## 2. 技术路线

最后选的是：

```text
Astro + GitHub Actions + Decap CMS
```

当前阶段主要完成的是 Astro 站点本体。

Astro 负责：

- 页面路由。
- 内容集合。
- 组件复用。
- 静态站生成。
- 局部交互脚本。

GitHub Actions 预期负责：

- push 后自动构建。
- 自动部署到 GitHub Pages 或其他静态托管。

Decap CMS 预期负责：

- 以后用后台界面新增 Markdown 内容。
- 管理学术进展、个人笔记、追番、音乐条目。
- 减少手写 frontmatter 的负担。

暂时还没有接 GitHub Actions 和 Decap CMS。

## 3. 已完成的大方向

已经从普通主页雏形，推进成了一个后台管理风格的个人站框架：

- 左侧固定导航栏。
- 顶部页面层级和社交入口。
- 支持桌面端和移动端。
- 支持白天/黑夜主题切换。
- 中英文按钮已经预留。
- 学术进展和个人笔记支持卡片视图、列表视图、详情页和分页。
- 追番列表已经改成类似 Steam 游戏墙的番剧墙。
- 视频收藏已经改为音乐专区。
- 图片统一放到 `public/images/` 下，按模块分目录。

## 4. 当前页面模块

左侧导航顺序目前是：

```text
首页
学术进展
个人笔记
追番列表
音乐专区
```

### 首页

入口文件：

```text
src/pages/index.astro
```

目前负责展示站点首页、模块概览和“个人论文目前还没有”的提示。

### 学术进展

入口文件：

```text
src/pages/academic/index.astro
src/pages/academic/[slug].astro
src/pages/academic/list/index.astro
src/pages/academic/page/[page].astro
```

内容目录：

```text
src/content/academic/
```

当前 frontmatter 保持精简：

```yaml
title:
summary:
date:
tags:
cover:
```

学术内容不再强行区分 type，统一用 tags。以后内容多了再考虑固定词表。

### 个人笔记

入口文件：

```text
src/pages/notes/index.astro
src/pages/notes/[slug].astro
src/pages/notes/list/index.astro
src/pages/notes/page/[page].astro
```

内容目录：

```text
src/content/notes/
```

个人笔记的 tags 不写死，上传时自己手写。颜色通过 hash 自动生成，等以后某些标签重复多了，再考虑固定颜色和翻译。

### 追番列表

入口文件：

```text
src/pages/anime/index.astro
src/pages/anime/[slug].astro
src/pages/anime/list/index.astro
```

内容目录：

```text
src/content/anime/
```

当前已有内容：

```text
dungeon-meshi.md
frieren.md
higehiro.md
```

其中 `higehiro.md` 是《剃须。然后捡到女高中生》，原来文件名是贴吧帖子 id，已经改成正常简称。贴吧原帖链接还保留在 frontmatter 的 `tieba` 字段里。

追番 frontmatter 当前示例：

```yaml
title: "剃须。然后捡到女高中生"
summary: "很庆幸自己没在节奏最大的那会看这部番"
date: 2026-04-19
rating: 5
rewatchCount: 1
format: "TV"
originalType: "轻小说改"
episodes: 13
tags: ["治愈", "青春", "恋爱", "救赎"]
moods: ["静下心", "有点遗憾", "想补治愈番"]
cover: "/images/anime/higehiro/cover.webp"
bangumi: "https://bgm.tv/subject/297254"
tieba: "https://tieba.baidu.com/p/10632491210?fr=personpage"
```

追番页已经完成：

- 观看时间筛选。
- 是否重看筛选。
- 按时间升序/降序排序。
- 按星级升序/降序排序。
- 卡片墙布局。
- hover 浮层。
- 题材 tags 在 hover 中显示前三个，文字和边框按 tag hash 上色。
- 心情 moods 在 hover 中显示前三个，样式更淡，用来和题材区分。
- 默认卡片只显示海报、观看时间/首看、标题、星级。
- 番剧封面按 2:3 竖版海报展示。

### 音乐专区

入口文件：

```text
src/pages/music/index.astro
src/pages/music/[slug].astro
```

内容目录：

```text
src/content/music/
```

目前只是占位。下一步准备在另一台电脑上重点做。

## 5. 组件目录和作用

```text
src/components/
```

通用组件：

```text
PageHeader.astro
ContentCard.astro
```

`PageHeader.astro` 是统一的页面头部卡片，支持 slot。追番页的筛选栏就是塞进这个 slot 里的。

内容列表组件：

```text
src/components/content/
```

作用：

- `ArticlePage.astro`：通用正文详情页。
- `CollectionPage.astro`：通用集合页，学术/笔记主要复用它。
- `EntryCard.astro`：普通卡片视图。
- `EntryListItem.astro`：普通列表视图。
- `Pagination.astro`：分页组件。
- `TagBadge.astro`：普通内容标签。
- `ViewModeLinks.astro`：卡片视图/列表视图切换入口。

追番组件：

```text
src/components/anime/
```

作用：

- `AnimeArchivePage.astro`：追番页整体布局，负责番剧墙和页面头部。
- `AnimeCard.astro`：Steam 式番剧卡片。
- `AnimeDetail.astro`：番剧详情页。
- `AnimeFilterBar.astro`：观看时间、是否重看、排序按钮和显示计数。
- `AnimeListItem.astro`：追番列表视图条目。
- `AnimeRating.astro`：星级显示。

## 6. 工具函数目录和作用

```text
src/lib/
```

作用：

- `anime.ts`：追番相关工具，例如季度判断、首看/重看判断、重看标签。
- `content.ts`：内容集合排序、分页、语言过滤等通用逻辑。
- `i18n.ts`：固定界面文案和中英文路径判断。
- `taxonomy.ts`：标签颜色 hash 等分类辅助逻辑。

## 7. 内容模型

所有内容集合都在：

```text
src/content.config.ts
```

目前集合包括：

```text
academic
notes
anime
music
```

学术、笔记、音乐共享基础字段：

```yaml
title:
summary:
date:
tags:
cover:
```

追番额外字段：

```yaml
rating:
rewatchCount:
format:
originalType:
moods:
episodes:
bangumi:
tieba:
```

## 8. 图片目录规则

图片统一放在：

```text
public/images/
```

当前结构：

```text
public/images/academic/
public/images/anime/
public/images/anime/higehiro/
public/images/music/
public/images/notes/
public/images/uploads/
```

建议：

- 番剧卡片封面必须用竖版海报，最好接近 2:3。
- 横图、截图、吐槽配图适合放详情页正文，不适合作为番剧墙封面。
- `webp` 适合网页展示，体积小；`jpg/png` 可以保留原图或作为转换前素材。
- 目前不会自动把上传图片转成 webp，以后可以考虑接脚本或构建流程。

## 9. i18n 当前策略

当前策略是轻量 i18n：

- 固定界面文案先走 `src/lib/i18n.ts` 字典。
- 英文路径使用 `/en/`。
- 暂时不强制所有内容都有英文版。
- 如果未来某篇内容有英文版，再单独补英文内容结构。
- 个人笔记 tags 不做翻译表，英文内容自己手写英文 tags。

## 10. 当前开发环境

Node 和 npm 已经升级并满足 Astro 要求。

本地开发命令：

```bash
npm run dev -- --host 0.0.0.0 --port 4321
```

字段说明：

- `npm run dev`：运行 `package.json` 里的开发服务器脚本。
- `--`：把后面的参数传给 Astro，而不是 npm 自己吃掉。
- `--host 0.0.0.0`：允许局域网或 WSL 外部访问。
- `--port 4321`：指定端口为 4321。

当前常用访问地址：

```text
http://172.21.139.244:4321/
```

如果页面样式没更新，优先尝试：

```text
Ctrl + F5
```

如果 content slug 改名后还显示旧 URL，重启 Astro dev server。

## 11. 下一步：音乐专区建议

下一台电脑上可以从音乐专区开始。

建议先定内容模型，不急着做复杂 UI：

```yaml
title:
summary:
date:
tags:
cover:
url:
artist:
album:
source:
moods:
rating:
```

页面方向可以参考追番墙：

- 专辑封面墙或歌曲收藏墙。
- 支持按年份、来源、心情、歌手筛选。
- 卡片默认显示封面、歌名、歌手、评分或心情。
- hover 显示简介、tags、外链。
- 详情页写听后感、歌词片段感想、B 站/网易云/YouTube 链接。

注意：音乐封面多为 1:1 方图，不要复用追番 2:3 海报比例。音乐专区应该单独做 `MusicCard`，类似追番但比例和字段不同。

## 12. 当前状态

已完成：

- 站点主框架。
- 后台管理风格布局。
- 主题切换。
- 社交图标。
- 移动端适配。
- 学术/笔记的卡片、列表、分页和详情页。
- 追番墙、筛选、排序、hover、2:3 海报展示。
- 图片目录初步规范。
- 音乐专区路由和占位内容。

未完成：

- GitHub Actions 自动部署。
- Decap CMS 后台。
- 音乐专区真实 UI。
- 学术/笔记更丰富的真实内容。
- 真正的英文内容版本。
- 图片自动转 webp 流程。
