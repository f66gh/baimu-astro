# Floating Random Walk Field Solver Prompt for Gemini

## 用途

请实现一个可嵌入 Astro Markdown 笔记的前端交互页，用来解释 IC 寄生电容抽取中的 **Floating Random Walk，FRW，浮动随机游走** 方法本身。

这不是“漂浮粒子艺术效果”。这里的 floating 指的是：每一步随机游走都会在当前位置构造一个会移动、会变大小的 **transition cube，转移立方体**，然后从 cube 中心跳到 cube 表面。页面只需要讲清楚 FRW 自己如何用随机路径估计电容，不需要讲 FDM/FEM/BEM，也不需要做多模块切换。

请一次性完成可运行的静态前端代码，不要先反问问题。

## 输出路径

在仓库中创建以下文件：

```text
public/interactives/floating-random-walk/index.html
public/interactives/floating-random-walk/styles.css
public/interactives/floating-random-walk/main.js
```

页面入口必须是：

```text
/interactives/floating-random-walk/index.html
```

## 技术约束

- 使用原生 HTML、CSS、JavaScript。
- 使用 Canvas 2D。
- 不使用 npm、构建工具、React、Vue、Svelte。
- 不使用外部 CDN。
- 不依赖图片资源。
- 页面必须可以直接打开 `index.html` 运行。
- 页面必须适合 iframe：宽度 100%，高度在 `560px` 到 `760px` 中都能正常显示。
- 支持手机窄屏，不能出现文字溢出或控件重叠。
- 支持 `prefers-color-scheme: dark` 暗色模式。

## 学习目标

页面只讲 FRW 自身。用户看完要能理解：

```text
1. 电容抽取仍然是 Q = C U
2. 选择一个 master conductor 设为 1V
3. 其他 conductor / substrate 设为 0V
4. 从 master conductor 附近生成大量随机路径
5. 每一步围绕当前点构造 transition cube
6. 从 cube 中心随机跳到 cube 表面，形成一个 hop
7. 路径最终撞到哪个 0V 边界，就统计到对应 coupling/substrate 目标
8. 很多路径的统计平均 -> 电荷估计 -> 电容估计
```

必须强调：

- 单条路径不是一个电容。
- 很多路径的统计平均才对应电荷/电容估计。
- 这是教学版可视化，不是工业级精确 FRW 求解器。

## 必须解释的术语

页面中第一次出现术语时，请用中文加英文解释：

- Floating Random Walk，FRW，浮动随机游走：一种用于 3D 电容抽取的随机采样场求解方法。
- master conductor，主导体：当前设为 `1V`、正在求电容的目标导体。
- grounded conductor / substrate，接地导体/衬底：设为 `0V` 的其他导体或参考地。
- transition cube，转移立方体：以当前随机点为中心、尽量大但不碰到导体边界的立方体。
- hop，跳转：从 transition cube 中心随机跳到 cube 表面某个点。
- surface Green's function，表面格林函数：真实 FRW 中决定 cube 表面采样概率分布的函数。
- Monte Carlo sampling，蒙特卡洛采样：用大量随机样本的平均值估计目标量。

## 页面整体布局

做一个单页单模块交互，不要做多模块按钮。

推荐布局：

```text
顶部：标题 + 一句话主旨
中间左侧：Canvas 主画布
中间右侧：控制面板 + 实时统计 + 短解释
底部或侧边：3 到 5 步流程条
```

视觉风格：

- 技术笔记风格，安静、清晰、可学习。
- 背景不要做成营销页 hero。
- 画布中用二维截面表达 3D 思想即可，不要求真正 3D。
- 导体用金属块表示，substrate 用底部横条表示。
- FRW 路径用细线和点表示。
- transition cube 在 2D 截面里可以画成正方形，并标注“2D 截面；真实算法里是 cube”。
- 卡片圆角不超过 `8px`。
- 不使用大面积紫蓝渐变或装饰光斑。

## 画布内容

请画一个简化 RCX 截面：

- `A`：master conductor，默认 `1V`
- `B`：grounded conductor，`0V`
- `C`：grounded conductor，`0V`
- `substrate`：底部参考地，`0V`
- 介质区域：浅色背景

随机路径：

- 从 `A` 附近的采样点出发。
- 当前路径用更亮的颜色显示。
- 历史路径用淡色显示。
- 当前点旁边画 transition cube 的 2D 截面。
- 路径最终命中 `B`、`C` 或 `substrate` 后，用不同颜色标记终点。

流程条：

```text
设 A=1V
从 A 附近采样
构造 transition cube
随机 hop 到 cube 表面
命中边界并统计
```

## 交互控件

至少实现这些控件：

- `master conductor` 选择：`A`、`B`、`C`
- `单步 hop` 按钮
- `自动游走 / 暂停`按钮
- `重置当前路径`按钮
- `批量采样`按钮：一次生成多条路径并更新统计
- `清空统计`按钮
- `样本数`滑块：`20` 到 `2000`
- `每帧 hop 数`滑块：控制自动动画速度
- `stopping threshold`滑块：控制离导体多近时判定命中边界
- `显示 transition cube`开关
- `只显示最近路径`开关，避免画面过乱

控件变化必须有可见效果。

## 简化算法

你可以用 2D 几何近似 FRW，重点是可视化思想。

数据结构示例：

```js
const conductors = [
  { id: "A", x, y, w, h, voltage: 1 },
  { id: "B", x, y, w, h, voltage: 0 },
  { id: "C", x, y, w, h, voltage: 0 },
  { id: "SUB", x, y, w, h, voltage: 0 }
];

const walk = {
  points: [{ x, y }],
  current: { x, y },
  hit: null
};
```

每一步 hop：

```text
1. 找当前点到所有导体/substrate 边界的最近距离 d
2. 如果 d < stoppingThreshold，判定 hit 最近边界，路径结束
3. 否则以当前点为中心画一个边长约 2d 的 transition cube 截面
4. 从正方形四条边上采样一个点，作为下一跳
5. 把下一跳加入路径
```

采样说明：

- 教学版可以先均匀随机选择正方形边界点。
- 但 UI 中必须标注：真实 FRW 需要使用 surface Green's function 来决定 cube 表面采样概率，尤其多层/复杂 dielectric 时更难。

碰撞判定：

- 如果随机点接近某个 conductor，就标记命中该 conductor。
- 如果接近 substrate，就标记命中 substrate。
- 如果路径超过最大 hop 数仍未命中，标记 `unfinished`。

master conductor 变化：

- 被选中的 master conductor 标为 `1V`。
- 其他 conductor 和 substrate 标为 `0V`。
- 路径从 master conductor 附近出发。
- 统计结果改成对应的 coupling/substrate 估计。

## 实时统计

显示这些实时指标：

```text
samples: 已完成路径数
live/current path hops: 当前路径 hop 数
mean hops: 平均 hop 数
hit A / B / C / substrate / unfinished: 数量和比例
estimated coupling/substrate capacitance: 教学估计
```

电容估计使用简单比例即可：

```text
C_master_to_X ~ hit_X / total_finished * scale
```

必须标注：

```text
教学估计，不是工业级 FRW 求解结果
```

## 解释文案

请在控制面板中放 3 到 5 句短解释：

```text
FRW 用大量随机路径代替全局线性方程组。
每一步 transition cube 都围绕当前点重新构造，所以它是 floating 的。
路径命中哪个 0V 边界，就把这次样本统计到对应耦合对象。
真实 FRW 的 cube 表面采样由 surface Green's function 决定；这里用均匀采样做教学近似。
```

不要写成长篇百科。

## 准确性边界

必须避免这些错误说法：

- 不要说“每条路径就是一个电容”。
- 不要把 FRW 画成固定网格上的上下左右走一步。
- 不要把 floating 解释成视觉上飘来飘去。
- 不要声称教学版均匀采样等同于真实 surface Green's function。
- 不要声称页面计算的是工业级准确电容。
- 不要讲 FDM/FEM/BEM 的细节，本页只讲 FRW。

## 验收标准

实现完成后请检查：

- 直接打开 `public/interactives/floating-random-walk/index.html` 可以运行。
- 页面只有一个 FRW 交互模块，没有多模块切换。
- `单步 hop` 能让当前点跳到 transition cube 表面。
- `自动游走` 能连续生成 hop。
- `批量采样` 能生成多条路径，并更新 hit 统计。
- master conductor 选择会改变 `1V/0V` 标签和路径起点。
- 所有滑块、开关、按钮都有可见效果。
- 手机宽度下布局不挤压、不溢出。
- 暗色模式下导体、路径、文字清晰可见。
- 浏览器控制台没有 JavaScript 报错。
