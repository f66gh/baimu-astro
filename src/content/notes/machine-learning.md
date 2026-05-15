---
title: "机器学习"
summary: "感觉自己的机器学习基础还很薄弱，要从头学一下"
date: 2026-05-13
tags: ["机器学习", "深度学习"]
cover: "/images/notes/machine-learning/cover.png"
---
## 用于机器学习的NVIDIA架构

### 模块
nvidia-smi：System Management Interface 英伟达系统管理接口。主要是英伟达驱动的命令行工具。

CUDA：Compute Unified Device Architecture 统一计算设备架构。让程序用英伟达GPU做计算的工具和接口。

PyTorch：深度学习框架，核心对象是 Tensor。相比 NumPy，PyTorch 的 Tensor 可以放到 GPU 上计算，也支持自动求导。需要手动把模型和数据移动到 CUDA 设备上，相关计算才会在 GPU 上执行。

### CUDA常用库
nvcc：nvidia CUDA compiler，CUDA编译驱动。主要用于写CUDA的C/C++代码，用Pytorch接触不到

cuBLAS：CUDA Basic Linear Algebra Subprograms。基础线性代数库，用于计算矩阵乘法。

cuDNN：CUDA Deep Neural Network library，给深度神经网络准备的高性能算子库。包含卷积，池化等。 

### Python常用库
numpy: python中做科学计算的基础库。核心对象是ndarray，即多维数组。

torch: PyTorch是深度学习框架，核心对象是Tensor，相比于numpy多了可以放到GPU上算，可以自动求导等等。

## 通用深度学习流程

### 引入

以函数：

$$
\hat{y}=wx^2+b
$$

为例。其中，$w$ 是权重，$b$ 是偏置，$\hat{y}$ 是模型预测值。

设有一组训练数据：$x=1,\ y=2$。

目标是通过训练找到合适的 $w$ 和 $b$，使得预测值 $\hat{y}$ 接近真实值 $y$。

设初始值为：$w=0,\ b=0$。

第一轮前向传播：$\hat{y}=0\times1^2+0=0$。

定义平方误差损失函数：

$$
L=(\hat{y}-y)^2
$$

代入 $\hat{y}=wx^2+b$，得到：

$$
L=(wx^2+b-y)^2
$$

代入当前数值：$L=(0-2)^2=4$。

对 $w$ 求偏导：

$$
\frac{\partial L}{\partial w}=2(wx^2+b-y)x^2
$$

代入 $x=1,\ y=2,\ w=0,\ b=0$：$\frac{\partial L}{\partial w}=2(0+0-2)\times1^2=-4$。

对 $b$ 求偏导：

$$
\frac{\partial L}{\partial b}=2(wx^2+b-y)
$$

代入当前数值：$\frac{\partial L}{\partial b}=2(0+0-2)=-4$。

设学习率：$lr=0.1$。

梯度下降更新公式为：

$$
\theta=\theta_{\text{old}}-lr\frac{\partial L}{\partial \theta}
$$

所以：$w=0-0.1\times(-4)=0.4$，$b=0-0.1\times(-4)=0.4$。

以后训练依此类推：前向传播、计算 Loss、反向传播求梯度、更新参数。

### 标准流程

```python
optimizer.zero_grad()          # 0. 清空旧梯度

output = net(input)            # 1. 前向传播

loss = criterion(output, target)  # 2. 计算 Loss

loss.backward()                # 3. 反向传播，计算梯度

optimizer.step()               # 4. 更新参数

```

### 简易图神经网络

conv: 卷积，三个参数是输入通道, 输出通道，卷积核大小
fc：全连接层，通常接收二维张量，形状是`[batch_size, feature_dim]`。需要手动设置输入特征数和输出特征数

全流程走一遍：
随机出一张图片，1个通道，32×32大小，随机出一个0-9的数作为目标值
输入图片的shape为`[1,1,32,32]`，格式为`[batch,channel,height,width]`

把每个参数的梯度归零

conv1输入是1通道，变成6个通道，卷积核5\*5大小，参数量是`6×5×5+6`，shape是`1×6×28×28`
做一次relu
做一次池化，shape是`1×6×14×14`
conv2输入是6通道，变成16个通道，卷积核5\*5大小，参数量是`6×16×5×5+6`，shape是`1×16×10×10`
做一次relu
做一次池化，shape是`1×16×5×5`
扁平化，保留图片个数(为1)，把shape捏成`[1,16×5×5]`的张量
全连接层fc1，shape变为`[1,120]`
全连接层fc2，shape变为`[1,84]`
全连接层fc3，shape变为`[1,10]`

求解loss
反向求偏导
更新参数

```python
class Net(nn.Module):
    def __init__(self):
        super().__init__()

        self.conv1 = nn.Conv2d(1, 6, 5)
        self.conv2 = nn.Conv2d(6, 16, 5)

        self.fc1 = nn.Linear(16 * 5 * 5, 120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10)

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.max_pool2d(x, 2)

        x = F.relu(self.conv2(x))
        x = F.max_pool2d(x, 2)

        x = torch.flatten(x, 1)

        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)

        return x

net = Net()

input = torch.randn(1, 1, 32, 32)
target = torch.randn(1, 10)

criterion = nn.MSELoss()
optimizer = optim.SGD(net.parameters(), lr=0.01)

optimizer.zero_grad()

output = net(input)
loss = criterion(output, target)

loss.backward()

optimizer.step()
```



## ML for STA

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

### 线性回归

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
D2M_r = \alpha \cdot D2M + (1-\alpha)EM  \space\space\space\space\space\space\space\space\space\space  \alpha = \left(\frac{2m_2 - m_1^2}{2m_2 - m_1^2 + T^2/12}\right)^{5/2}
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

### 随机森林

参考文献：Machine Learning-Based Pre-Routing Timing Prediction with Reduced Pessimism(DAC 2019)

问题：在布线前，商软预测布线后的slack总是偏悲观。本文比较了线性回归，随机森林和神经网络在布线前预测布线后slack和真实布线后slack作比较，发现随机森林效果最好。

ML输入：电容、距离、slew、sink分布等特征

ML输出：某个网从驱动到引脚的delay，以及目标引脚的slew

方法：
类比数据结构，把电路当做DAG有向无环图，看成一张AOE网，前向拓扑遍历，算得每个事件最早发生时间ve（即AAT），再反向拓扑遍历求解每个事件的最晚发生时间vl（即RAT），活动裕量就是vl - ve。但是和数据结构不同的是终点寄存器的vl是时钟周期，所以终点的slack也不一定是0.

训练阶段：根据各个net的delay和slew，把ML输入当成训练的条件，每课决策树都会随机采样不同的数据特征，学习一套if-else判断规则，然后把这些树的预测delay和slew结果平均一下得到随机森林。用预测值计算slack，和真实slack对比。

![](/images/notes/machine-learning/决策树与随机森林.png)

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


### 组合方法

参考文献：A Deep Learning Methodology to Proliferate Golden Signoff Timing(2014 DATE)

问题：各种商软跑出来的时序结果差的太多了，而且跑一轮巨慢。在我们用了某个商软跑STA后，我们还想比较不同商软的时序差距，我们希望通过大模型，输入我们商软的参数和时序，能预测出来其他商软的参数和时序。

ML输入：setup time, cell delay, wire delay, stage delay, path slack

ML输出：对应的参数

方法：每一种参数都用不同的模型预测效果最好，有用ANN、最小二乘法和随机森林的。

## ML for RCX

### 随机森林

参考文献：MLParest: Machine Learning based Parasitic Estimation for Custom Circuit Design(Intel DAC 2020)

问题：在模拟电路流程中（和自动化数字不太一样），layout前预测的寄生参数比layout后提取的真实寄生参数差的很远。输入互联net的各种属性

ML输入：net连接数量、跨越层级数量、连接到MOS drain gate source的数量...

ML输出：等效电容Ceff和等效电阻Reff

方法：训练随机森林，给每个net训练出一个Ceff和Reff。把互联net看成一个星型拓扑结构，整个net有一个电容和多个电阻，连接到各个pin的电阻是Reff除以pin的个数。

![](/images/notes/machine-learning/MLParset.jpg)

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


### 图神经网络

参考文献：ParaGraph:Layout Parasitics and Device Parameter Prediction using Graph Neural Networks(Nvidia DAC 2020)

问题：在模拟电路中，在pre layout时，估计电路模块寄生参数总是凭经验。本文提出了基于各种图神经网络并提出了新的适配模块级的寄生电容和其他相关参数图神经网络

ML输入：晶体管的ploy长度、鳍片个数、电阻长度、...

ML输出：晶体管LDE参数 源极漏极面积和参数 寄生电容（没有电阻）

方法：
在图神经网络的基础上，结合了RGCN(不同边区别对待)，GAT(自注意力抓重点)，GraphSage(用自己的旧特征和新特征拼接)。论文把电路图转化为异构图，pin和导线都设置为节点，节点间用有向边连。由于不同器件的电容差距过大，所以论文根据电容范围把器件分为四个类别，训练了四组模型。

邻接边的种类有四个：导线→源极漏极，导线→栅极，源极漏极→导线，源极漏极→导线。

![](/images/notes/machine-learning/ParaGraph.jpg)

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

算出

$$
h_{i}^{(l+1)} = \sigma(\sum_{j \in N(i)} \alpha_{i,j} W^{(l)} h_{j}^{(l)})
$$


4. 把新的长嵌入再压回到原来的长度

$$
h_i^{(l+1)} \leftarrow \sigma \left( W^{(l)} \cdot \text{concat}(h_i^{(l)}, h_i + b^{(l)}) \right)
$$
