---
title: "ML for STA"
summary: "读文献"
date: 2026-06-02
tags: ["机器学习", "STA"]
cover: "cover.jpg"
imageRoot: "/images/notes/ML-4-STA"
---

## 综述

参考文献：Machine Learning for Electronic Design Automation: A Survey(ACM TODAES 2021 CCFB)
```
System Specification
系统规格
↓
Architectural Design
架构设计
↓
Functional Design and Logic Design (RTL)
功能设计与逻辑设计
↓
Logic Synthesis
逻辑综合
↓
Physical Design
物理设计 / 后端设计 
↓
Physical Verification and Signoff
物理验证与签核，包括DRC(design rule check), LVS(Layout Versus Schematic)检查抽出来的电路和原始网表是否一致, STA
↓
Fabrication
制造
↓
Packaging and Testing
封装与测试
↓
Chip
最终芯片
```

## 线性回归

参考文献：Learning-Based Approximation of Interconnect Delay and Slew in Signoff Timing Tools(ACM/IEEE International Workshop on System Level Interconnect Prediction，SLIP 2014)

问题：商业STA是个黑盒模型，要在布图（布局布线和RCX STA结束之后）完成之后修时序和降低漏电，反复调整单元尺寸和阈值电压，频繁更新时序，但是速度慢。现在门延时和门slew查表比较准，现有的分析线延时和线slew的方法相比于商业STA偏差比较大。为此，本文提出一个计算线延时和线slew的线性回归模型。**目的是减少商业STA调用次数，加速后端流程。给我的启发是模型预测不一定要预测最终的slack，可以预测计算slack的中间值；以及输入特征可以用以前存在的经验公式计算得到的结果**

ML输入：传统的多个计算线延时和线slew的模型算出的线延时和线slew

$$
EM = r_d \cdot C_{n_0} + \sum_{v \in path(n_0, n_i)} r_c \cdot C_v
$$
$$
D2M = \frac{m_1^2}{\sqrt{m_2}} \cdot \ln 2
$$
$$
D2M_r = \alpha \cdot D2M + (1-\alpha)EM \qquad \alpha = \left(\frac{2m_2 - m_1^2}{2m_2 - m_1^2 + T^2/12}\right)^{5/2}
$$

$$
LNS_s = \frac{m_1^2}{\sqrt{2m_2}} \cdot \left( k \cdot \sqrt{2 \ln\left(\frac{2m_2}{m_1^2}\right)} - e^{-k \cdot \sqrt{2 \ln\left(\frac{3m_2}{m_1^2}\right)}} \right)
$$

ML输出：更接近商业STA的线延时和线slew

方法：
1. 用最小二乘回归学习多个解析模型的加权组合（找一组权重让模型预测值和真实值的差距最小）
结合回归和分类的方法，其中α是分类特征，AEM AD2M EM 是回归特征，a b c是要学习的参数

$$
WD_{ML} = \begin{cases} a_1 \cdot AEM + a_2 \cdot AD2M + a_3 \cdot EM, & \text{if } \alpha < 0.3 \\ b_1 \cdot AEM + b_2 \cdot AD2M + b_3 \cdot EM, & \text{if } 0.3 \le \alpha < 0.94 \\ c_1 \cdot AEM + c_2 \cdot AD2M + c_3 \cdot EM, & \text{if } \alpha \ge 0.94 \end{cases}
$$

$$
WS_{ML} = \begin{cases} \sqrt{a_1 \cdot EM^2 + a_2 \cdot LNS_s^2 + T^2}, & \text{if } \alpha < 0.96 \\ \sqrt{b_1 \cdot EM^2 + b_2 \cdot LNS_s^2 + T^2}, & \text{if } 0.96 \le \alpha < 0.99 \\ \sqrt{c_1 \cdot EM^2 + c_2 \cdot LNS_s^2 + T^2}, & \text{if } \alpha \ge 0.99 \end{cases}
$$

$$
L(\boldsymbol{\beta}) = \sum_{i=1}^{N} (y_i - \hat{y}_i)^2 = \sum_{i=1}^{N} \left( y_i - \sum_{j=1}^{p} \beta_j x_{ij} \right)^2
$$

2. 校准时，模型和商业STA一起按步骤算delay slew AAT/RAT 和 slack，然后作比较给模型的中间步骤计算加上offset
3. 当改变的单元数量小于一个值时，可以用模型和offset更新slack；当改变的门数量大于一个值时，重新回到第二步校准

## 随机森林

参考文献：Machine Learning-Based Pre-Routing Timing Prediction with Reduced Pessimism(DAC 2019)

问题：在布线前，商软预测布线后的slack总是偏悲观。本文比较了线性回归，随机森林和神经网络在布线前预测布线后slack和真实布线后slack作比较，发现随机森林效果最好。

ML输入：电容、距离、slew、sink分布等特征

ML输出：某个网从驱动到引脚的delay，以及目标引脚的slew

方法：
类比数据结构，把电路当做DAG有向无环图，看成一张AOE网，前向拓扑遍历，算得每个事件最早发生时间ve（即AAT），再反向拓扑遍历求解每个事件的最晚发生时间vl（即RAT），活动裕量就是vl - ve。但是和数据结构不同的是终点寄存器的vl是时钟周期，所以终点的slack也不一定是0.

训练阶段：根据各个net的delay和slew，把ML输入当成训练的条件，每课决策树都会随机采样不同的数据特征，学习一套if-else判断规则，然后把这些树的预测delay和slew结果平均一下得到随机森林。用预测值计算slack，和真实slack对比。

![](决策树与随机森林.png)

$x_i$是第i个线网的特征向量，$y_i$是第i个线网真实的delay/slew值，$\hat{y}_{R1}$, $\hat{y}_{R2}$是这一堆中$y_i$的平均值，调用二分法，让最小化均方误差（MSE）最小，就是当前节点最佳的if-else判断条件。反复调用下面的公式，得到一颗决策树：
$$
\min_{j, s} \left[ \sum_{x_i \in R_1(j,s)} (y_i - \hat{y}_{R1})^2 + \sum_{x_i \in R_2(j,s)} (y_i - \hat{y}_{R2})^2 \right]
$$

$\hat{h}(x)$是这颗树对于线网x的预测延迟值，$M$是这颗树总共有多少个叶子结点，$R_m$是第 $m$ 个叶子节点所代表的特征空间（可以理解为到达这个叶子节点需要满足的所有 if-else 条件）。$c_m$是第 $m$ 个叶子节点的预测输出值。它等于训练时落在这个叶子节点里所有样本的平均延迟。$I(x \in R_m)$是指示函数（Indicator Function）。如果输入特征 $x$ 顺着树枝走，最终落进了第 $m$ 个叶子节点，它的值就是 $1$，否则就是 $0$：

$$
\hat{h}(x) = \sum_{m=1}^{M} c_m I(x \in R_m)
$$

整个森林的最终预测是通过对所有树的结果取平均值来完成的:
$$
\hat{y}_{RF}(x) = \frac{1}{K} \sum_{k=1}^{K} \hat{h}_k(x)
$$


## 组合方法

参考文献：A Deep Learning Methodology to Proliferate Golden Signoff Timing(2014 DATE)

问题：各种商软跑出来的时序结果差的太多了，而且跑一轮巨慢。在我们用了某个商软跑STA后，我们还想比较不同商软的时序差距，我们希望通过大模型，输入我们商软的参数和时序，能预测出来其他商软的参数和时序。

ML输入：setup time, cell delay, wire delay, stage delay, path slack

ML输出：对应的参数

方法：每一种参数都用不同的模型预测效果最好，有用ANN、最小二乘法和随机森林的。
