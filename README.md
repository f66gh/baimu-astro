# Aiu Web

基于 Astro 搭建的个人内容站，当前包含这些主要模块：

- 首页
- 学术进展
- 个人笔记
- 追番列表
- 音乐专区

项目目前采用静态站方案，部署在 Vercel，并通过 GitHub Actions 做构建检查。

## 技术栈

- `Astro`：静态站框架，适合 Markdown 驱动的内容站
- `Astro Content Collections`：内容集合校验系统，用来约束 Markdown frontmatter 字段
- `Vercel`：静态站部署平台
- `GitHub Actions`：CI（Continuous Integration，持续集成），这里主要用于自动构建检查

## 快速开始

环境要求：

- `Node.js >= 22.12.0`
- `npm`

安装依赖：

```bash
npm install
```

这里：

- `npm`：Node.js 自带的包管理器
- `install`：根据 `package.json` 和 `package-lock.json` 安装依赖

本地开发：

```bash
npm run dev
```

这里：

- `run`：运行 `package.json` 里的脚本
- `dev`：对应 `astro dev`，启动开发服务器

生产构建：

```bash
npm run build
```

这里：

- `build`：对应 `astro build`，生成最终静态文件到 `dist/`

本地预览构建结果：

```bash
npm run preview
```

如果你在局域网或 WSL 环境里需要手机访问，可以用：

```bash
npm run dev -- --host 0.0.0.0 --port 4321
```

这里：

- 第一个 `--`：把后面的参数转交给 Astro
- `--host 0.0.0.0`：监听所有网卡地址，而不只是 `localhost`
- `--port 4321`：把开发服务器端口固定为 `4321`

## 目录概览

```text
.
├── public/
│   └── images/
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   ├── lib/
│   └── pages/
├── package.json
├── README.md
└── CHANGELOG.md
```

其中最常用的几个位置是：

- `src/content/`：Markdown 内容源
- `src/content.config.ts`：内容 schema（字段校验规则）
- `src/pages/`：页面路由
- `src/components/`：可复用组件
- `src/lib/`：排序、i18n、分类等辅助逻辑
- `public/images/`：正文图片、封面图等静态资源

## 内容约定

- 学术、笔记、追番、音乐内容都通过 Markdown 维护
- frontmatter 字段由 [src/content.config.ts](./src/content.config.ts) 统一校验
- 图片资源建议放在 `public/images/<模块>/<slug>/` 下，再用 `/images/...` 路径引用

## 部署

- 生产环境：Vercel
- 构建检查：GitHub Actions
- 当前版本号：见 [package.json](./package.json)

## 更新记录

版本历史与变更说明见 [CHANGELOG.md](./CHANGELOG.md)。
