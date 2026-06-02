---
title: "ML for RCX"
summary: "读文献"
date: 2026-06-02
tags: ["机器学习", "RCX"]
cover: "cover.jpg"
imageRoot: "/images/notes/ML-4-RCX"
---
## 综述

参考文献：Deep Learning Inspired Capacitance Extraction Techniques（清华 ASPDAC 2025）

### 场求解器

电容是与导体结构相关的一种属性，导体携带电容可以用电荷和电势（电压）求解。我们把电容看成一个矩阵，对角线$C_{ii}$是导体的**总电容（自电容）**，非对角线是$C_{ij}$是导体间的**耦合电容**。将主导体设为1v电势，其余导体设为0v，那么各导体的电荷量就等于电荷矩阵C中与该导体对应的那一列。

这就将问题转化为了模拟3D电场以计算电荷。因此可以使用有限差分法（FDM）、有限元法（FEM）和边界元法（BEM）等数值方法。

场求解器主要流程是：

1. 求解电势与电场，这里$\phi$：电势；$\epsilon$：介电常数；$∇\phi$：电势变化率。

$$
∇ \cdot (\epsilon ∇ \phi) = 0,\quad where~ E = -∇\phi
$$

2. 求电荷，电荷来自电场在导体表面的法向通量，对导体表面积分：

$$
Q_i = \int_{\partial conductor_i} \epsilon E \cdot n dS
$$

3. 根据电势和电荷反推出电容

$$
Q = CU
$$

<iframe
	class="note-interactive"
	src="/interactives/field-solver-gemini/index.html"
	title="场求解器原理交互演示"
	loading="lazy"
></iframe>

#### FDM与FEM

以二维FDM为例，场求解器会先把连续空间切成一个个规则小方格，只在格点上保存未知电势。对于一个不在导体边界上的内部格点 $\phi_{i,j}$，二维 Laplace 方程可以等价地写成，含义是这块的电势是上下左右四个电势的平均值：

$$
-4\phi_{i,j}+\phi_{i+1,j}+\phi_{i-1,j}+\phi_{i,j+1}+\phi_{i,j-1}=0
$$

如果某个邻居是固定电压边界，比如左导线为 $1V$，右导线或 substrate 为 $0V$。如果总共有 $n$ 个未知格点，$\boldsymbol{\phi}$ 就是长度为 $n$ 的向量，$A$ 是 $n \times n$ 的稀疏矩阵。只是因为二维五点模板只看上下左右四个邻居，所以 $A$ 的每一行最多只有 5 个非零数：中心格点的 $-4$，以及邻居位置上的 $1$。

举一个最小的 $2 \times 2$ 未知格点例子。假设中间有 4 个未知格点

这里：

$$
\boldsymbol{\phi}=
\begin{bmatrix}
x_1\\
x_2\\
x_3\\
x_4
\end{bmatrix}
$$

对 $x_1$ 来说，左边邻居是 $1V$ 边界，上边邻居是 $0V$ 边界，右边是 $x_2$，下边是 $x_3$，所以：
$
-4x_1+x_2+x_3=-1
$

对 $x_2$ 来说，右边和上边都是 $0V$ 边界，左边是 $x_1$，下边是 $x_4$，所以：
$
x_1-4x_2+x_4=0
$

对 $x_3$ 来说，左边是 $1V$ 边界，下边是 $0V$ 边界，右边是 $x_4$，上边是 $x_1$，所以：
$
x_1-4x_3+x_4=-1
$

对 $x_4$ 来说，右边和下边都是 $0V$ 边界，左边是 $x_3$，上边是 $x_2$，所以：
$
x_2+x_3-4x_4=0
$

把四个方程合起来就是一个具体的矩阵方程：

$$
A\boldsymbol{\phi}=\boldsymbol{b}
$$

$$
\begin{bmatrix}
-4 & 1 & 1 & 0\\
1 & -4 & 0 & 1\\
1 & 0 & -4 & 1\\
0 & 1 & 1 & -4
\end{bmatrix}
\begin{bmatrix}
x_1\\
x_2\\
x_3\\
x_4
\end{bmatrix}
=
\begin{bmatrix}
-1\\
0\\
-1\\
0
\end{bmatrix}
$$

对于真实芯片局部窗口，未知格点可能有几十万甚至更多，所以 $A$ 会非常大；但它是稀疏矩阵，因为每个格点只直接连接少数邻居。

#### BEM

BEM代表是FasterCap。已知边界电势$v$，直接求表面电荷$q$

$$
Pq = v
$$

BEM并不需要求解空间中的电势矩阵。在均匀介质中，一个点电荷$q$在距离$r$的地方的电势为：

$$
\phi = \frac{1}{4 π \epsilon} \frac{q}{r}
$$

由格林函数可得，对其积分是某个观察点r的电势是把所有的微小电荷贡献加起来，即所有表面电荷决定对一个点的电势：

$$
\phi(r) = \frac{1}{4 π \epsilon} \int_{S} \frac{\sigma(r')}{|r - r'|}dS'
$$

BEM把连续空间表面切成很多panel。把panel $j$上的单位总电荷均匀铺开，计算它对panel $i$中心点产生的电势，这个比例系数就是 $P_{ij}$。其中$A_j$是第$j$个panel的面积，有：

$$
P_{ij} = \frac{1}{4 π \epsilon A_j} \int_{S_i} \frac{\sigma(r')}{|r_i - r'|}dS'
$$

然后解$Pq = v$矩阵，这里$P$是稠密矩阵。

### 浮动随机游走

浮动随机游走（floating random walk）方法是一种特殊的场求解器技术，它不涉及求解线性方程组这一极其消耗内存的任务，因此具备处理更大结构的能力。hop是跳数，threshold是距离导体/sub多近算终止。

求解电势：某个点的电势，可以看成从这个点出发并随机游走撞到各个边界电势的平均结果。

浮动：每一个hop都会以这个点为中心构建一个trastion cube，cube尽量大但不能碰到导体边界，然后在这个cube边界选一个点，作为下一个hop的中心点。

采样：transition cube不能乱采样。对于每次跳跃，立方体边界上的采样点必须服从表面上的随机分布，其概率密度函数被称为**表面格林函数 Surface Green**。这个概率密度函数很难计算，所以为了加速也是用各种方法近似的，但是对于复杂芯片的计算也有误差。因此，迫切需要一种快速而准确的方法，以快速获取具有复杂电介质配置的立方体的表面格林函数。深度学习技术可以用于预测这种函数，转化为ML回归问题。

<iframe
	class="note-interactive"
	src="/interactives/floating-random-walk/index.html"
	title="浮动随机游走 FRW 交互演示"
	loading="lazy"
></iframe>



## 随机森林

参考文献：MLParest: Machine Learning based Parasitic Estimation for Custom Circuit Design(Intel DAC 2020)

问题：在模拟电路流程中（和自动化数字不太一样），layout前预测的寄生参数比layout后提取的真实寄生参数差的很远。输入互联net的各种属性

ML输入：net连接数量、跨越层级数量、连接到MOS drain gate source的数量...

ML输出：等效电容Ceff和等效电阻Reff

方法：训练随机森林，给每个net训练出一个Ceff和Reff。把互联net看成一个星型拓扑结构，整个net有一个电容和多个电阻，连接到各个pin的电阻是Reff除以pin的个数。

![](MLParset.jpg)

训练集的电容Ceff是post Layout提取出来的真实寄生电容，电阻没用提取出来的电阻，因为提取出的电阻也是一段一段的，而且一个net的所有电阻不能简单累加成一个Reff。所以论文用一个等效公式，用真实的寄生电容算出真实的寄生电阻。

这里我们定义了有效时间常数 ($\tau_{eff}$) 的概念 。对于一个拥有 $N$ 个极点（poles，$p_1, p_2, ..., p_N$）的系统，其有效时间常数定义如下 ：
$$
\tau_{eff}=\sqrt{\frac{1}{{p_{1}}^{2}}+\cdot\cdot\cdot+\frac{1}{{p_{i}}^{2}}+\cdot\cdot\cdot+\frac{1}{{{p_{N}}^{2}}}}
$$
可得有效电阻：
$$
R_{eff} = \frac{\tau_{eff}}{C_{eff}}
$$
每个支路电阻就是：
$$
R_{branch} = \frac{R_{eff}}{M}
$$


## 卷积神经网络

参考文献：CNN-Cap: Effective Convolutional Neural Network-basedCapacitance Models for Interconnect Capacitance Extraction （清华 TODAES 2023 CCFB）

这篇论文用卷积神经网络计算寄生电容。我比较喜欢这篇论文的思想，有点花小钱办大事的感觉。论文只是预测了三层的芯片区域，用场求解器计算master和target之间的耦合电容然后计算，没有扩展到更大的区域。论文训练了两个模型，分别用于预测total电容和耦合电容。

![](CNN-Cap_Fig6.png)

一开始，论文的2021年版本是只是对2.5D芯片做的寄生电容预测，编码大概是：

论文把层看成channel，由于每一层的导线属性都差不多，所以文本用了一种取巧的方法，把输入的每一层变为一维的特征向量。每一层输入特征向量有两个，分为从前面看和从侧面看（视角正交）。

特征向量用正交的视角有一个好处：这样顾及到导线的四个面对于同层和不同层之间的绕射电容。如Fig2所示，比如我要计算上面的导线对下面的导线的耦合电容，是$C_{1f1}+C_{1f2}+C_{2f1}+C_{2f2}+C_{1o}$，注意$C_{1o}$和$C_{2o}$是一个东西。

![](CNN-Cap_Fig3.jpg)

论文对于特征值的编码也很取巧，如图所示，是在一个单元格内按照面积占比编码，master导线额外加1，target导线变为负值。论文的模型是这样输入输出的：我一次只预测一个导线的total电容或者一对导线的电容，然后只会输出一个值，这样有效避免了因为数据集中的导线数量不同导致的输出数据个数不同。

![](CNN-Cap_Fig7.jpg)

这样有一个最严重的问题：无法考虑到同一层中有两个导线不完全重叠的情况，这种情况下侧面视图无法得到有效信息。为此，论文自己也在23年提出了3D的改进方案：

仍然把一层看成一个Channel，但是每一个channel变成了一个有x-y轴的二维图像，这个图像就是从上向下对于这一层的俯视图，如图所示，编码同2.5D那个。

![](CNN-Cap_Fig9.jpg)

论文对于一根导线能与其他导线耦合的最大范围边界定为了5um，这个范围叫window。其中windows内有0.5um的padding，以及4um×4um大小的core-region。当master导线完全在core-region内时，忽略window外的导线其的耦合电容，只计算window内的；当master导线很长的时候，考虑到性能问题，没有加大window而是对master导线进行截断，只考虑在core-region内的master导线，只对window内的导线有耦合电容（包含在padding区域内的dummy master）。

![](CNN-Cap_Fig13.jpg)

## 图神经网络

### ParaGraph

参考文献：ParaGraph:Layout Parasitics and Device Parameter Prediction using Graph Neural Networks(Nvidia DAC 2020)

问题：在模拟电路中，在pre layout时，估计电路模块寄生参数总是凭经验。本文提出了基于各种图神经网络并提出了新的适配模块级的寄生电容和其他相关参数图神经网络

ML输入：晶体管的ploy长度、鳍片个数、电阻长度、...

ML输出：晶体管LDE参数 源极漏极面积和参数 寄生电容（没有电阻）

方法：
在图神经网络的基础上，结合了RGCN(不同边区别对待)，GAT(自注意力抓重点)，GraphSage(用自己的旧特征和新特征拼接)。论文把电路图转化为异构图，pin和导线都设置为节点，节点间用有向边连。由于不同器件的电容差距过大，所以论文根据电容范围把器件分为四个类别，训练了四组模型。

![](ParaGraph_Fig3.jpg)

邻接边的种类有四个：导线→源极漏极，导线→栅极，源极漏极→导线，源极漏极→导线。边不同，则对应的参数权重矩阵不同。

![](ParaGraph.jpg)

1. 根据邻接边的种类，把传过来的其余节点嵌入分类

2. 用自注意力机制，把各种嵌入加权处理为一个嵌入

分类关系收集：

$$
h_{N(i)}^{(l+1)} = \sum_{r \in R} \sum_{j \in N^{r}(i)} \frac{1}{c_{i,r}} W_{r}^{(l)} h_{j}^{(l)}
$$

3. 把多个新嵌入变成一个新嵌入，然后拼接到自己的旧嵌入上

算出原始权重：

$$
e_{ij}^{l} = \vec{a}^{T} \text{concat}(W^{(l)}h_{i}^{l}, W^{(l)}h_{j}^{l})
$$

权重归一化：

$$
\alpha_{ij}^{l} = \text{softmax}_{i}(\text{LeakyReLU}(e_{ij}^{l}))
$$

算出，这里的$N(i)$和$W$是各种不同边集合/权重矩阵的简写，有不同的W对应不同的N，最后都要加和。

$$
h_{i}^{(l+1)} = \sigma(\sum_{j \in N(i)} \alpha_{i,j} W^{(l)} h_{j}^{(l)})
$$


4. 把新的长嵌入再压回到原来的长度

$$
h_i^{(l+1)} \leftarrow \sigma \left( W^{(l)} \cdot \text{concat}(h_i^{(l)}, h_i + b^{(l)}) \right)
$$

### Parasitic-Aware

参考文献：Parasitic-Aware Analog Circuit Sizing with Graph Neural Networks and Bayesian Optimization(Nvidia DATE 2021)

上一篇论文的续作。上一篇论文主要讲的是集总电容（对地、基底等电容），这篇论文在图神经网络上做了改进，用一对边节点的嵌入计算耦合电容（导线之间电容），用相邻边节点和引脚节点的嵌入计算电阻。加上了导线间的耦合电容后，准确度有明显的改进。

![](Parastic-Aware_Fig2.jpg)

在论文中，把一段导线近似为一个net 模型，里边可能有很多分支，两端可能连很多单元，甚至还有可能跨层，对于大型芯片来说这种预测不够准。

同时，论文没有明确提出用于计算的耦合电容的两个边节点是怎么来的，只是说所有边两两算耦合电容没必要。


### GNN-Cap

参考文献：GNN-Cap: Chip-Scale Interconnect Capacitance Extraction Using Graph Neural Network(复旦 TCAD 2024)

方法：论文中把一段net分为一个个cuboid（和tile类似，以下称为tile）。论文把tile当成一个节点，三个特征为长宽高。论文的边有七个特征，分别为两个tile中心的距离，两个tile的X/Y/Z方向坐标差。

![](GNN-Cap_Fig4.jpg)

论文在水平方向定义了阈值$d_e$(和halo类似，以下称为halo)，在halo范围内，则认为两个节点有边。论文在垂直方向，给每个tile上下加上比层间绝缘层高一点的的halo，目的是让两个tile之间能被识别为边。

![](GNN-Cap_Fig2.jpg)

论文中把芯片建模成这样：

![](GNN-Cap_Fig1.jpg)

本文中主要计算三种电容：自带电容、耦合电容、隐藏边导致的电容。其中，自带电容用节点自己的嵌入算，耦合电容用两个节点和之间的边算。论文中提到，在同层中当两个tile相距过远的时候，中间没有tile隔着的时候，本文的建模方法是不会给这两个tile连上边的，即使这两个tile存在耦合电容；同理，当上下层的两个tile中间隔一层，但是这一层没有tile遮挡的时候，这两个tile也是有耦合电容的，但是本文的建模方法则认为这两个tile之间没有边。因此，本文加了一些这样的虚拟边，但是也不参与GCN的计算。

![](GNN-Cap_Fig5.jpg)

公式中，$h$是节点嵌入，两个$W$是两个权重矩阵，一个作用与聚合的边，一个作用于节点的旧嵌入，$c$是每两个节点之间的消息缩放比例。

$$
h_{v_i}^{l} = \phi \left( W^{l-1} \sum_{v_j \in N(v_i)} \frac{1}{c(v_i, v_j)} h_{v_j}^{l-1} + W_0^{l-1} h_{v_i}^{l-1} \right)
$$

这是边嵌入的计算公式：

$$
h_{e_{ij}}^{l} = \text{MLP} \left( \text{CONCAT} \left( h_{v_i}^{l}, h_{v_j}^{l}, \text{MLP}_{trans}(h_{e_{ij}}^{l-1}) \right) \right)
$$

由于算的都是按照一个个tile或者tile之间的电容，寄生参数提取下一步的STA要每个网络（一段由一个或几个tile拼接的抽象长导线）的电容，所以把一段net内的tile电容都加和。

论文的标签是场求解器得到的值，论文中只用了一个开源的28nm工艺库和八个不同的芯片设计用例。速度比场求解器快。论文用了平均相对误差MARE，也就是每个电容都算一个相对误差，再平均。论文是这样比较的：自己的算法和场求解器算一个MARE，用starRC自己的快速估值和starRC自己的场求解器算一个MARE，结果更好一些。

$$
\text{MARE} = \frac{1}{N} \sum_{i=1}^{N} \left|    1 - \frac{f(x_i)}{y_i} \right|
$$


