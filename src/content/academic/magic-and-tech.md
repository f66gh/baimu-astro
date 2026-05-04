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

这个交互页用 `sky130A.tech` nominal 角的数值，演示 Magic 普通 `extract` 中三类主要电容：面积/重叠电容、边缘绕射电容、同层侧壁耦合电容。它不是电场求解器，而是把版图几何乘上 tech 文件里的查表系数。

### 怎么看

移动 `M1 tile` 可以同时看到三件事：它和 `M2_A` 的投影重叠会产生面积电容；它也会屏蔽一部分 `M2_A` 到 substrate 的面积/边缘电容；当它靠近 `M2_A` 边缘时，即使不正对，也会接收绕射电容。

右侧的 `B1 / B2` 只用来演示同层 metal2 侧壁耦合。`sidehalo` 固定为 tech 文件里的 `8um`，层高只用于视觉显示。

### 1. 面积/重叠电容

Magic 先把 `M2_A` 的面积电容加到 substrate：

```text
C_area_sub_raw = C_area_m2_sub * A_M2
```

如果 `M1 tile` 和 `M2_A` 有投影重叠，Magic 会把这块区域从 substrate 面积电容里扣掉，并改成 M2 到 M1 的重叠电容：

```text
C_area_sub = C_area_m2_sub * (A_M2 - A_overlap_M1)
C_area_m1  = C_overlap_m2_m1 * A_overlap_M1
```

nominal 参数：

```text
C_area_m2_sub    = 17.5   aF/um^2
C_overlap_m2_m1  = 133.86 aF/um^2
```

### 2. 边缘绕射电容

Magic 的 halo 绕射模型用 atan 计算目标 tile 接收到的边缘场比例：

```text
frac = (2 / pi) * [atan(mult * d_far) - atan(mult * d_near)]
```

这里 `mult` 不是由层间距实时算出来的，而是由 tech 表里的 overlap 系数得到：

```text
mult_m2_m1  = C_overlap_m2_m1 * FRINGE_MULT
mult_m2_sub = C_area_m2_sub * FRINGE_MULT
FRINGE_MULT = 0.02
```

M2 边缘到 M1 的绕射电容使用 `defaultsideoverlap` 的幅值系数：

```text
C_fringe_m1 = sum(C_sideoverlap_m2_m1 * L * frac_m2_m1)
```

同时，M1 接收了这部分边缘场后，Magic 会从 M2 到 substrate 的 perimeter/fringe 电容中扣掉对应比例：

```text
C_fringe_sub = C_perim_m2_sub * P_M2 - removed_by_M1
```

nominal 参数：

```text
C_perim_m2_sub        = 37.76 aF/um
C_sideoverlap_m2_m1   = 67.05 aF/um
sidehalo              = 8 um
```

### 3. 同层侧壁耦合电容

同层 metal2 的相邻边按侧壁公式计算：

```text
C_sidewall_i = [C_sidewall_m2 / (sep_i + offset)] * L_overlap_i
```

nominal 参数：

```text
C_sidewall_m2 = 50
offset        = 0.3 um
```

演示里 `B1 / B2` 只参与这个同层侧壁耦合，不参与 M2 到 substrate 或 M1 的绕射屏蔽。
