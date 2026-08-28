---
title: "线性代数"
summary: "老师让我补一下线代"
date: 2026-08-04
tags: ["线代"]
cover: "cover.png"
imageRoot: "/images/notes/linear-algebra"
---

## 半正定矩阵

对于一个实对称矩阵，半正定定义为

$$
x^\top Mx \ge 0, \forall x
$$

### 充要条件

$$
\begin{aligned}
M \succeq 0 
& \iff \lambda_i \ge 0 \\
&\iff \det M[I,I] \ge 0,
    \quad \forall\, \varnothing\ne I\subseteq\{1,\dots,n\} \\
&\iff M = GG^\top \\
\end{aligned}
$$

### 必要条件

任意对角线元素大于零：

$$
M_{ii} \ge 0
$$

任意两下标$i,j$的二阶主子式也必须非负：

$$
M_{ii}M_{jj} - M^2_{ij} \ge 0 \\
|M_{ij}| \le \sqrt{M_{ii}M_{jj}}
$$

也有

$$
M_{ii} = 0 \iff M_{ij} = 0, \forall j
$$