---
title: "Magic与tech专项"
summary: "还在看"
date: 2026-04-30
tags: ["group-task"]
cover: "/images/academic/ORFS/cover.png"
---

## Magic 如何计算寄生电容

<iframe
	class="note-interactive"
	src="/interactives/magic-and-tech/parasitic-capacitance.html"
	title="Magic 寄生电容计算交互演示"
	loading="lazy"
></iframe>

这个交互页演示的是 Magic 做寄生电容抽取时的一种教学近似模型。它不是精确电场求解器，而是把版图几何关系拆成三类主要贡献：面积电容、边缘绕射电容、同层侧壁耦合电容。

### 操作方法

左侧是 3D 版图视图，右侧是控制面板和实时计算结果。可以用鼠标拖拽旋转视角，滚轮缩放，右键或触控板平移。上方的 `Top View`、`Cross-section`、`3D View`、`Reset Camera` 用来快速切换观察方向。

建议按这个顺序观察：

1. 先调 `Target L_A / W_A`，观察目标金属块 `M2_A` 变大后面积电容如何增加。
2. 再调 `d_sub_m1` 和 `d_m1_m2`。层间距越小，单位面积电容越大；同时 fringe 的 `alpha` 也变大，边缘电场会更快被附近导体接收。
3. 移动 `M1 X offset / Y offset`。当 `M1 tile` 与 `M2_A` 投影重叠时，会出现明显的 overlap area capacitance；当它不重叠但还在 halo 内时，仍然会接收边缘绕射电容。
4. 调 `B1 / B2` 的 `sep` 和 `Y Center`，观察右侧边如何被切成不同 segment。每段只选择最近的同层 opposing edge 来计算 sidewall coupling。
5. 调 `halo`。halo 可以理解为 Magic 扫描边缘附近导体的有效范围，超过这个范围的邻居在这个简化模型里会被忽略。

### 1. 面积电容：Area / Overlap Capacitance

面积电容近似来自平行板电容。平行板电容就是两块正对的导体隔着绝缘介质时形成的电容，距离越近、正对面积越大，电容越大。

```text
C_area_density(d) = eps0 * K / d
```

其中：

- `eps0`：真空介电常数，可以理解为“真空中形成电容的基础能力”。
- `K`：介质常数，也叫相对介电常数，表示介质比真空更容易形成电容多少倍。
- `d`：两层导体之间的垂直距离。

如果 `M2_A` 和 `M1 tile` 在俯视图中有重叠，那么重叠区域形成 metal2 到 metal1 的面积电容：

```text
A_overlap_M1 = overlap(M2_A, M1)
C_area_m1 = C_area_density(d_m1_m2) * A_overlap_M1
```

`M1 tile` 也会屏蔽一部分 metal2 到 substrate 的垂直电场，所以没有被 M1 挡住的面积才继续算到 substrate：

```text
A_A = L_A * W_A
A_unshielded = max(A_A - A_overlap_M1, 0)
d_sub_m2 = d_sub_m1 + d_m1_m2
C_area_sub = C_area_density(d_sub_m2) * A_unshielded
```

通俗说：上下两块金属正对得越多，面积电容越大；两层隔得越近，电场越容易从上层“直直地”连到下层，电容也越大。

### 2. 边缘绕射电容：Fringe Capacitance

真实电场不会只从金属底面垂直向下走。金属边缘附近的电场会向外弯出去，这部分就是 fringe capacitance，也可以叫边缘绕射电容。

Magic 的近似模型用下面这个函数描述边缘电场随横向距离 `x` 被接收的比例：

```text
frac(x) = (2 / pi) * atan(alpha * x)
```

这里的 `alpha` 与两层之间的单位面积电容近似成正比：

```text
alpha = alpha0 * C_area_density(d)
```

所以层间距会间接影响 fringe 分布：

```text
d 变小 -> C_area_density 变大 -> alpha 变大 -> frac(x) 上升更快
d 变大 -> C_area_density 变小 -> alpha 变小 -> fringe 电场扩散得更远
```

目标金属边缘到 substrate 的绕射电容可以写成：

```text
C_fringe_sub_edge = C_perim_sub * L_edge * frac(x_limit)
```

其中：

- `C_perim_sub`：单位边长的 substrate fringe 电容常数。
- `L_edge`：参与计算的边长。
- `x_limit`：这一方向上电场能向外扩展到的有效距离，通常受 halo 或附近导体遮挡限制。

如果 `M1 tile` 位于 `M2_A` 的边缘外侧，并且仍在 halo 内，即使它没有和 `M2_A` 投影重叠，也会接收一部分边缘绕射电场：

```text
C_fringe_m1_edge =
  C_perim_m1 * L_edge * [frac(x_far) - frac(x_near)]
```

`x_near` 和 `x_far` 表示 M1 在该边缘外侧覆盖区间的近端和远端。通俗说，M1 不一定非要“正对着” M2 才能产生电容；只要它站在边缘电场能绕到的位置，也会被电场“够到”。

### 3. 同层侧壁耦合电容：Sidewall Coupling Capacitance

同一层 metal2 上，`M2_A` 右侧边和 `B1 / B2` 的相对侧壁之间也会形成电容。这种电容主要看三个量：相对边之间的横向距离、沿边方向的重叠长度、以及是否在 halo 内。

简化公式是：

```text
C_sidewall_i = C_coup(sep_i) * L_overlap_i
```

其中：

```text
C_coup(sep_i) = C_coup0 / (sep_i + offset)
```

各符号含义：

- `sep_i`：目标边到最近邻居边的横向间距。
- `L_overlap_i`：这一段边在 Y 方向上与邻居重叠的长度。
- `C_coup0`：教学用的耦合强度常数。
- `offset`：防止距离很小时公式发散的修正项。

Magic 的关键思想是按边扫描。`M2_A` 的右侧边会根据 `B1 / B2` 的 Y 方向覆盖范围被切成多个 segment；每个 segment 只选择最近的 opposing edge 作为主要耦合对象：

```text
C_sidewall_total = sum(C_sidewall_i)
```

通俗说：同层金属像两堵并排的墙，墙越近、并排重叠越长，互相“感应”越强；如果某段边旁边有多个邻居，最近的那个通常最重要。

### 总电容

这个演示里的总电容是几类贡献相加：

```text
C_total =
  C_area_sub
  + C_area_m1
  + C_fringe_sub
  + C_fringe_m1
  + C_sidewall_total
```

实际 PDK 和真实抽取工具会有更复杂的表格、分层规则和校准参数。这里的重点是理解 Magic 为什么要看 overlap、edge、halo、shielding 和 nearest opposing edge。
