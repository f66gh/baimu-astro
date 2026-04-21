# Aiu Web

基于 Astro 搭建的个人内容站，目前已经有这几个主要模块：

- 首页
- 学术进展
- 个人笔记
- 追番列表
- 音乐专区

整体风格是偏后台管理面板式的布局：左侧固定导航，右侧是内容区，上方带页面层级、社交入口、主题切换和语言切换入口。

## 环境要求

- Node.js `>= 22.12.0`
- npm

这里的：

- `Node.js`：JavaScript 运行环境，可以理解成“让前端工程在电脑上跑起来的底座”
- `npm`：Node 自带的包管理器，用来安装依赖、启动项目、构建项目

当前项目在 [package.json](/home/aiu/web/package.json) 里写死了版本要求：

```json
"engines": {
  "node": ">=22.12.0"
}
```

## 安装依赖

第一次拉下项目后，在项目根目录运行：

```bash
npm install
```

这条命令的意思是：

- `npm`：调用 npm 包管理器
- `install`：根据 `package.json` 和 `package-lock.json` 安装项目依赖

安装完成后，会出现 `node_modules/` 目录。

## 开发模式

本地开发时运行：

```bash
npm run dev
```

这条命令的意思是：

- `npm`：调用 npm
- `run`：运行 `package.json` 里的脚本
- `dev`：脚本名字，对应当前项目里的 `astro dev`

它会启动 Astro 开发服务器。开发模式的特点是：

- 改代码后页面会热更新
- 适合边写边看效果
- 不会生成最终上线文件

如果你在 WSL 或局域网环境里，希望通过 IP 访问，可以运行：

```bash
npm run dev -- --host 0.0.0.0 --port 4321
```

每一段的意思是：

- `npm run dev`：启动开发服务器
- `--`：把后面的参数传给 Astro，而不是传给 npm 自己
- `--host 0.0.0.0`：监听所有网卡地址，不只监听 `localhost`
- `--port 4321`：指定端口号为 `4321`

如果 `4321` 被占用，Astro 会自动尝试下一个空闲端口，比如 `4322`。

## 生产构建

上线前或者想检查项目是否能正常打包时，运行：

```bash
npm run build
```

这条命令的意思是：

- `npm`：调用 npm
- `run`：运行脚本
- `build`：执行构建脚本，对应当前项目里的 `astro build`

它会把站点正式编译到 `dist/` 目录。

构建模式的特点是：

- 会检查内容集合（content collections）是否合法
- 会检查路由页面能不能生成
- 会输出最终部署用的静态文件

这里的“静态文件”可以简单理解成：

- 已经生成好的 HTML
- 对应的 CSS 和 JS
- 可以直接部署到静态托管平台上的网页资源

## 本地预览构建结果

如果你已经执行过 `npm run build`，还可以运行：

```bash
npm run preview
```

这条命令的意思是：

- `preview`：本地预览 `dist/` 中已经构建好的站点

它更接近上线后的真实效果。

## 常用命令一览

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器 |
| `npm run dev -- --host 0.0.0.0 --port 4321` | 在指定端口、允许外部访问的方式启动开发服务器 |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览构建结果 |
| `npm run astro -- --help` | 查看 Astro CLI 帮助 |

## 项目结构

下面是当前项目中最重要的目录结构和作用：

```text
.
├── public/
│   └── images/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── anime/
│   │   ├── content/
│   │   └── music/
│   ├── content/
│   │   ├── academic/
│   │   ├── anime/
│   │   ├── music/
│   │   └── notes/
│   ├── layouts/
│   ├── lib/
│   └── pages/
├── package.json
└── README.md
```

### `public/`

放不需要 Astro 编译、可以直接按路径访问的静态资源。

当前最重要的是：

```text
public/images/
```

这里主要放：

- 番剧封面
- 音乐封面
- 正文图片

通俗说，`public/` 里的文件会原样出现在网站里，比如：

```text
public/images/anime/higehiro/cover.webp
```

在页面里就可以写成：

```text
/images/anime/higehiro/cover.webp
```

### `src/assets/`

放需要参与 Astro/Vite 构建的资源，目前主要是一些项目内素材，比如：

- [astro.svg](/home/aiu/web/src/assets/astro.svg)
- [background.svg](/home/aiu/web/src/assets/background.svg)

### `src/layouts/`

放布局组件。

当前最核心的是：

- [Layout.astro](/home/aiu/web/src/layouts/Layout.astro)

它负责全站的通用外壳，比如：

- 左侧导航栏
- 顶部栏
- 明暗主题
- 页面主区域
- 一些全局样式

### `src/components/`

放可复用组件。

#### 通用组件

- [PageHeader.astro](/home/aiu/web/src/components/PageHeader.astro)  
  页面头部卡片，很多页面顶部的大标题面板都复用它。

- [ContentCard.astro](/home/aiu/web/src/components/ContentCard.astro)  
  首页等地方使用的通用信息卡片。

#### `src/components/content/`

这是学术进展和个人笔记主要复用的一组“内容型页面组件”：

- [ArticlePage.astro](/home/aiu/web/src/components/content/ArticlePage.astro)  
  通用详情页正文布局。

- [CollectionPage.astro](/home/aiu/web/src/components/content/CollectionPage.astro)  
  通用集合页布局，用于列表页、卡片页和分页区域组织。

- [EntryCard.astro](/home/aiu/web/src/components/content/EntryCard.astro)  
  通用卡片视图条目。

- [EntryListItem.astro](/home/aiu/web/src/components/content/EntryListItem.astro)  
  通用列表视图条目。

- [Pagination.astro](/home/aiu/web/src/components/content/Pagination.astro)  
  分页组件。

- [TagBadge.astro](/home/aiu/web/src/components/content/TagBadge.astro)  
  标签组件。

- [ViewModeLinks.astro](/home/aiu/web/src/components/content/ViewModeLinks.astro)  
  卡片视图 / 列表视图切换链接。

#### `src/components/anime/`

这是追番列表专用组件：

- [AnimeArchivePage.astro](/home/aiu/web/src/components/anime/AnimeArchivePage.astro)  
  追番列表页面外壳。

- [AnimeCard.astro](/home/aiu/web/src/components/anime/AnimeCard.astro)  
  番剧墙卡片。

- [AnimeDetail.astro](/home/aiu/web/src/components/anime/AnimeDetail.astro)  
  番剧详情页主体。

- [AnimeFilterBar.astro](/home/aiu/web/src/components/anime/AnimeFilterBar.astro)  
  追番筛选栏和排序按钮。

- [AnimeListItem.astro](/home/aiu/web/src/components/anime/AnimeListItem.astro)  
  追番列表视图条目。

- [AnimeRating.astro](/home/aiu/web/src/components/anime/AnimeRating.astro)  
  星级评分显示。

#### `src/components/music/`

这是音乐专区专用组件：

- [MusicSection.astro](/home/aiu/web/src/components/music/MusicSection.astro)  
  音乐专区大模块外壳。

- [MusicShelf.astro](/home/aiu/web/src/components/music/MusicShelf.astro)  
  横向卡片行，也就是“每一行 shelf”。

- [MusicAlbumCard.astro](/home/aiu/web/src/components/music/MusicAlbumCard.astro)  
  音乐鉴赏用的专辑卡片。

- [MusicVideoCard.astro](/home/aiu/web/src/components/music/MusicVideoCard.astro)  
  练习视频用的视频卡片。

- [MusicCategoryPage.astro](/home/aiu/web/src/components/music/MusicCategoryPage.astro)  
  音乐二级分类页布局，带分页区。

### `src/content/`

放 Markdown 内容，也就是站点真正的数据源。

#### `src/content/academic/`

学术进展内容，例如：

- 论文阅读
- 组内任务
- 阶段性想法和总结

#### `src/content/notes/`

个人笔记内容，例如：

- WSL
- 静态网站
- 工具和环境记录

#### `src/content/anime/`

追番内容，目前已有：

- [dungeon-meshi.md](/home/aiu/web/src/content/anime/dungeon-meshi.md)
- [frieren.md](/home/aiu/web/src/content/anime/frieren.md)
- [higehiro.md](/home/aiu/web/src/content/anime/higehiro.md)

#### `src/content/music/`

音乐内容，当前已经按模块细分目录：

```text
src/content/music/
├── appreciation/
│   ├── classical/
│   └── pop/
└── practice/
    ├── piano/
    └── violin/
```

也就是：

- `appreciation`：音乐鉴赏
- `classical`：古典
- `pop`：流行
- `practice`：练习视频
- `piano`：钢琴练习
- `violin`：小提琴练习

### `src/lib/`

放工具函数和站点数据处理逻辑。

- [anime.ts](/home/aiu/web/src/lib/anime.ts)  
  追番列表的筛选、排序、辅助函数。

- [content.ts](/home/aiu/web/src/lib/content.ts)  
  学术和笔记内容的通用整理逻辑。

- [i18n.ts](/home/aiu/web/src/lib/i18n.ts)  
  中英文文案字典和语言切换用的工具。

- [music.ts](/home/aiu/web/src/lib/music.ts)  
  音乐内容的排序、分组、分页、标签颜色辅助函数。

- [taxonomy.ts](/home/aiu/web/src/lib/taxonomy.ts)  
  标签相关的颜色和分类辅助逻辑。

### `src/pages/`

放页面路由。

这里的“路由”可以理解成：

- 浏览器地址和页面文件之间的对应关系

比如：

```text
src/pages/notes/index.astro
```

对应访问地址大致就是：

```text
/notes/
```

主要页面结构如下：

```text
src/pages/
├── index.astro
├── academic/
├── notes/
├── anime/
├── music/
└── en/
```

对应关系如下。

## 页面模块对应关系

### 首页

- [src/pages/index.astro](/home/aiu/web/src/pages/index.astro)

作用：

- 站点首页
- 各模块入口概览

### 学术进展

入口页面：

- [src/pages/academic/index.astro](/home/aiu/web/src/pages/academic/index.astro)
- [src/pages/academic/list/index.astro](/home/aiu/web/src/pages/academic/list/index.astro)
- [src/pages/academic/[slug].astro](/home/aiu/web/src/pages/academic/[slug].astro)

分页页面：

- [src/pages/academic/page/[page].astro](/home/aiu/web/src/pages/academic/page/[page].astro)
- [src/pages/academic/list/page/[page].astro](/home/aiu/web/src/pages/academic/list/page/[page].astro)

作用：

- 展示学术条目
- 支持卡片视图、列表视图、详情页、分页

### 个人笔记

入口页面：

- [src/pages/notes/index.astro](/home/aiu/web/src/pages/notes/index.astro)
- [src/pages/notes/list/index.astro](/home/aiu/web/src/pages/notes/list/index.astro)
- [src/pages/notes/[slug].astro](/home/aiu/web/src/pages/notes/[slug].astro)

分页页面：

- [src/pages/notes/page/[page].astro](/home/aiu/web/src/pages/notes/page/[page].astro)
- [src/pages/notes/list/page/[page].astro](/home/aiu/web/src/pages/notes/list/page/[page].astro)

作用：

- 展示个人笔记条目
- 支持卡片视图、列表视图、详情页、分页

### 追番列表

入口页面：

- [src/pages/anime/index.astro](/home/aiu/web/src/pages/anime/index.astro)
- [src/pages/anime/list/index.astro](/home/aiu/web/src/pages/anime/list/index.astro)
- [src/pages/anime/[slug].astro](/home/aiu/web/src/pages/anime/[slug].astro)

作用：

- 追番墙
- 番剧详情页
- 列表视图入口

### 音乐专区

首页：

- [src/pages/music/index.astro](/home/aiu/web/src/pages/music/index.astro)

古典鉴赏：

- [src/pages/music/library/classical/index.astro](/home/aiu/web/src/pages/music/library/classical/index.astro)
- [src/pages/music/library/classical/page/[page].astro](/home/aiu/web/src/pages/music/library/classical/page/[page].astro)

流行鉴赏：

- [src/pages/music/library/pop/index.astro](/home/aiu/web/src/pages/music/library/pop/index.astro)
- [src/pages/music/library/pop/page/[page].astro](/home/aiu/web/src/pages/music/library/pop/page/[page].astro)

钢琴练习：

- [src/pages/music/practice/piano/index.astro](/home/aiu/web/src/pages/music/practice/piano/index.astro)
- [src/pages/music/practice/piano/page/[page].astro](/home/aiu/web/src/pages/music/practice/piano/page/[page].astro)

小提琴练习：

- [src/pages/music/practice/violin/index.astro](/home/aiu/web/src/pages/music/practice/violin/index.astro)
- [src/pages/music/practice/violin/page/[page].astro](/home/aiu/web/src/pages/music/practice/violin/page/[page].astro)

作用：

- `music/index.astro`：音乐专区首页
- `library/classical`：古典鉴赏二级页
- `library/pop`：流行鉴赏二级页
- `practice/piano`：钢琴练习二级页
- `practice/violin`：小提琴练习二级页

### 英文页面

英文页面目前主要先覆盖：

- 首页
- 学术进展
- 个人笔记

对应目录：

- [src/pages/en/](/home/aiu/web/src/pages/en)

这是当前站点的轻量 i18n 方案：

- 默认中文路径
- 英文内容走 `/en/...`
- 固定文案由 [i18n.ts](/home/aiu/web/src/lib/i18n.ts) 管理

## 内容模型

内容集合配置在：

- [src/content.config.ts](/home/aiu/web/src/content.config.ts)

这里定义了每种 Markdown 允许写哪些 frontmatter 字段。

### 学术进展 / 个人笔记

通常包含：

```yaml
title:
summary:
date:
tags:
cover:
```

### 追番

通常包含：

```yaml
title:
summary:
date:
rating:
rewatchCount:
format:
originalType:
episodes:
tags:
moods:
cover:
bangumi:
tieba:
```

### 音乐

通常包含：

```yaml
title:
summary:
date:
cover:
url:
section:
group:
tags:
formats:
materials:
```

说明：

- `section`：音乐属于“鉴赏”还是“练习”
- `group`：音乐属于古典 / 流行 / 钢琴 / 小提琴哪一组
- `formats`：鉴赏内容的表演或演奏形式
- `materials`：练习内容使用的教材或材料

## 开发建议

日常开发推荐顺序：

1. `npm install`
2. `npm run dev -- --host 0.0.0.0 --port 4321`
3. 边改边看页面效果
4. 提交前运行 `npm run build`

如果你想确认端口是否真的启动成功，可以看终端里 Astro 输出的地址。

## 当前状态

目前这套站点已经具备：

- 后台式整体框架
- 明暗主题切换
- 中英文入口
- 学术 / 笔记的卡片与列表双视图
- 学术 / 笔记详情页和分页
- 番剧墙与番剧详情页
- 音乐专区首页与四个二级分类页
- 移动端适配基础能力

接下来如果继续扩展，最自然的方向通常是：

- 接 GitHub Actions 自动部署
- 接 Decap CMS 后台编辑
- 补充更多音乐、追番和笔记内容
- 继续精修移动端体验和视觉统一性
