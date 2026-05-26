---
title: "机器学习"
summary: "感觉自己的机器学习基础还很薄弱，要从头学一下"
date: 2026-05-17
tags: ["机器学习", "深度学习"]
cover: "cover.png"
imageRoot: "/images/notes/machine-learning"
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

### 简易卷积神经网络

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


### 额外补充

残差函数：让某层网络的输入值不变或者学一点变化量直接输出，所以残差连接让网络更容易保留原信息。

$$
y = x + F(x)
$$

批量归一化：为了避免不同batch造成的输出特征差距过大，训练的时候，对一个batch内某一层计算均值和方差，用公式将一层的数据尽量服从均值为0，方差为1的分布。测试时候用训练好的均值和方差算。

$$
\hat{x}_i = \frac{x_i-\mu_B}{\sqrt{\sigma_B^2+\epsilon}}
$$

也可以做变换和平移：

$$
y_i = \gamma \hat{x}_i + \beta
$$

dropout：训练的时候让输入的特征值随机变为0，让模型避免过度依赖一些特征。测试时候关闭。


## Transformer基础文献

### attention is all you need

![](attentionisallyouneed.jpg)

问题：传统的RNN对于序列类工作只能串行输出，而且无法有效利用GPU。Transformer在训练阶段摒弃了RNN，在神经网络中考虑了每个词和其他词的编码位置，实现可以同时读入整个序列，用GPU并行计算预测下个token是什么，并串行输出处理结果。注意，训练时候的解码器也是并行计算，推理时候的解码器仍然是自回归一个token一个token生成

以 `I love machine learning` ，每个词看成一个token举例子。

**编码器**：

输入是词嵌入，如果每个词嵌入用512维向量表示，那么输入向量shape就是[4, 512]

为每个token按照奇偶性编写正弦余弦位置编码，这样每一个token的位置编码都不一样，然后把词嵌入和编码位置直接按位相加。

$$
PE_{(pos,2i)}=sin(\frac{pos}{10000^{2i/d_{model}}})
$$

$$
PE_{(pos,2i+1)}=cos(\frac{pos}{10000^{2i/d_{model}}})
$$

在多头注意力中，我们先弄清楚缩放点积注意力公式。公式输入Q K V三个变量，分别代表当前token发出的查询，每个token被匹配的索引，以及每个token被关注后真正提供的信息内容。我们假设$d_k = d_v = 64$。

在上面的句子中，每个token的都有三个64维向量，分别是$q_i$、$k_i$、$v_i$，以`machine`为例，那么对应的向量是$q_3$、$k_3$、$v_3$。假设现在$q_3$发起查询，那么会乘所有token的k值，即$q_3 · k_1$、$q_3 · k_2$、$q_3 · k_3$、$q_3 · k_4$，经过softmax归一化计算得到权重$a_{31}$、$a_{32}$、$a_{33}$、$a_{34}$，再和对应token的值加权求和得到中间变量分数向量，一个$o_i$的shape是[1, 64]，四个中间变量分数向量$O$的shape就是[4, 64]：

$$
o_i = \sum_{j = 1}^{n} \alpha_{ij} v_j,\qquad \text{where}\qquad \alpha_{ij} = softmax (\frac{q_i k_j^T}{\sqrt{d_{k}}})
$$

这个公式的意思是通过要查询的信息和各个token的索引去匹配，匹配的过程在数学公式中表现为相乘和计算归一化权重，再乘以value矩阵。

$$
Attention(Q,K,V)=softmax(\frac{QK^{T}}{\sqrt{d_{k}}})V
$$

从上面的公式知道每个token都会有自己的$q_i$、$k_i$、$v_i$，是由三个可学习的[512, 64]权重矩阵经过把token向量线性降维变换得到的：$q_i = x_i · W^Q $、$k_i = x_i · W^K$、$v_i = x_i · W^V$，所有token拼接后，K Q V的shape就是[4, 64]。论文中设置有八个不同的head，对应的匹配侧重点不同，每个head的权重矩阵都不同，$head_i$的shape是[4, 64]。

$$
head_{i}=Attention(QW_{i}^{Q},KW_{i}^{K},VW_{i}^{V})
$$

回到多头注意力公式，是把八个head直接横向拼接到一起，并再用一个shape为[512,512]的权重矩阵$W^O$乘一下，得到输出。

$$
MultiHead(Q,K,V)=Concat(head_{1},...,head_{h})W^{O}
$$

再用一层残差网络和归一化，前馈神经网络升维再降维，然后再一层残差网络和归一化：

$$
FFN(x)=max(0,xW_{1}+b_{1})W_{2}+b_{2}
$$

上述步骤重复六次

**解码器**:

假设目标输出句子是`我 喜欢 机器 学习`，四个token

每次右移输入，即

```
看到 <BOS>              → 预测 我
看到 <BOS> 我           → 预测 喜欢
看到 <BOS> 我 喜欢      → 预测 机器
看到 <BOS> 我 喜欢 机器 → 预测 学习
```

因为语言生成本质是一个“下一个词预测”问题，即：

$$
P(y_1, y_2, y_3, y_4) = P(y_1)P(y_2|y_1)P(y_3|y_1, y_2)P(y_4|y_1, y_2, y_3) \qquad P(y_i) = P(y_i | y_{<i}, X)
$$

训练时，在掩码多头注意力中，为了防止ai作弊看到后面正确的输出，把后面token对应的概率变为0。

在第二个多头注意力中，K和V来自编码器，Q来自解码器。

上述步骤重复六次

假设词表大小为37000，最后的残差和归一化层输出的shape是[4, 512]，linear线性层变换到词表后，shape是[4, 37000]，再由激活函数算出归一化概率。

### BERT

基于transformer的编码器，做了双向表示预训练，在特定NLP任务表现良好。

预训练：用大量的语料库学习通用语言知识。预训练做了两个自监督任务：Masked Language Model 掩盖语言模型和Next Sentence Prediction 下一句预测。

在MLM中，我们遮住句子的一个token，让MLM根据上下文猜这个是什么东西。论文中用输入序列15%的词 token作为预测目标。在15%被选中的token，有80%的token直接变为[Mask]，10%的token不变，10%的token是随机的。

在NSP中，训练模型句子B是不是句子A的下一句。

输入格式是[CLS] sentence A [SEP] sentece B [SEP]，在预训练样本中，有50%是真的，有50%是假的。

输出是[CLS]，用它做二分类判断是不是真的。

微调：根据预训练的参数，以及特定任务的有标注的训练集，在预训练模型的基础上加上简单的输出层训练特定的任务，同时训练BERT主题参数和微调参数。

![](BERT.jpg)

上图中，最终输入向量等于token嵌入＋属于哪个句子的嵌入＋位置嵌入

$$
E_{input} = E_{token} +  E_{segment} + E_{position}
$$

把训练拆成预训练和微调的好处是：预训练阶段可以利用海量无标注文本学习通用语言表示，微调阶段只需要较少的有标注任务数据。防止只训练特定任务（如情感分类）过拟合，而且减少为每个任务从零设计复杂模型的需求。

### GPT

基于Transformer的解码器，仍然采用预训练+微调的方法。

无监督预训练：同样是采用无标签训练，主要是根据前文预测下一个词。论文目标是让下一个词的出现概率尽可能地大，公式如下，其中i是当前词的位置，$u_i$是当前词，条件是这个词左边已经出现的词：

$$
L(U) = \sum_{i} \log p(u_i | u_{i - k}, ..., u_{i - 1}; Θ)
$$

解码器，首先是输入整句话token和位置编码。假设这句话有4个token，$h$一般是4维token id序列，$W_e$是token嵌入矩阵，$W_p$是位置嵌入矩阵，假设隐藏维度是768, $h_0$的shape是[4, 768]

$$
h_0 = UW_e + W_p
$$

然后经过多层如图所示的块，并行训练时也需要用多头掩码注意机制：

$$
h_l = transformer_block(h_{l - 1})
$$

再输出下一个token的频率，$h_m W_e^T$的shape是[4, 40000]，softmax后每个位置都输出一个词表大小的概率分布。

注意这里的token嵌入矩阵和一开始的嵌入矩阵是转置关系：

$$
P(u) = softmax(h_m W_e^T)
$$

![](GPT.jpg)

同样的，拿着预训练好的参数，取最后一层位置的隐藏状态，在特定任务微调中，加上线性层和softmax一起再给特定任务训练参数，而不是直接输出某一个词出现的概率。其中，$h^m_l$是第l层最后的一个位置的hidden state，$W_y$是新加的任务分类参数，$y$是任务标签，$m$是序列长度.例如我要做分类任务，有三个类别，那么$W_y$的shape是[768, 3]

$$
P(y | x^1, ..., x^m) = softmax(h^m_l W_y)
$$

## 图基础文献

### MPNN

Message Passing Neural Network，消息传递神经网络，基本上有关于图的算法都围绕着这三个流程与公式：

1. 邻居给节点发消息

$$
m_u^{t+1} = \sum_{v \in \mathcal{N}(u)} M_t(v^t, u^t, e_{uv}^t)
$$

2. 当前节点通过邻居发的消息更新自己

$$
h_{u}^{t + 1} = U_{t} (h_u^t, m_u^{t+1})
$$

3. 整张图做个输出，做Readout

$$
\hat{y} = R(\{h^T_u | u \in G\})
$$

### GCN

**问题**：传统的图节点预测网络，认为相邻节点的属性必然是接近的，并以此为目标设计Loss函数。在函数中，$\mathcal{L}_0$ 是有标签节点的Loss，$\mathcal{L}_{reg}$是图平滑正则项，用来约束相邻节点的模型输出尽量平滑。

在公式中，$\mathcal{L}_{reg}$的含义是，如果两个节点$X_i$和$X_j$在图上邻接，那么认为他们的特征函数的输出$f(\cdot)$也一定近似，$A_{ij}$是邻接矩阵的i行j列的值，所以Loss公式设计就是想让两个邻接节点的特征函数差值也尽可能地小。

$$
\mathcal{L}=\mathcal{L}_0 + \lambda \mathcal{L_{reg}},\quad \text{with}~ \mathcal{L}_{reg} = \sum_{i,j} A_{ij} || f(X_i) - f(X_j) ||^2 = f(X)^{\top} \Delta f(X)
$$

我们给公式在数学上简化。我们设$A$为邻接矩阵，$I$为单位矩阵，$D$为度数矩阵（对角线是对应节点的度，其余非对角线值为0）。有$L = D - A$为拉普拉斯矩阵。我们假设$h = f(X)$，h是向量，$h_i$是标量，可推导：

$$
\begin{aligned}
\frac{1}{2}
\sum_{i,j}A_{ij}(h_i-h_j)^2
&=
\frac{1}{2}
\sum_{i,j}A_{ij}
\left(h_i^2-2h_i h_j+h_j^2\right) \\
&=
\frac{1}{2}
\sum_{i,j}A_{ij}h_i^2
-
\sum_{i,j}A_{ij}h_i h_j
+
\frac{1}{2}
\sum_{i,j}A_{ij}h_j^2.
\end{aligned}
$$

由于无向图的邻接矩阵满足：

$$
A_{ij}=A_{ji}
$$

并且：

$$
D_{ii}=\sum_j A_{ij}
$$

所以：

$$
\begin{aligned}
\frac{1}{2}
\sum_{i,j}A_{ij}(h_i-h_j)^2
&=
\sum_iD_{ii}h_i^2
-
\sum_{i,j}A_{ij}h_i h_j \\
&=
h^\top D h-h^\top A h \\
&=
h^\top(D-A)h \\
&=
h^\top Lh.
\end{aligned}
$$

很明显，图的相邻节点的特征不一定接近，这种学习方式面对一些图的时候不一定对。

**方法**：为此，本文提出了一种半监督式的图卷积网络，把图结构$\hat{A}$写进模型，而不是把图结构放到loss里。文章提出了前向神经网络公式，其中$l$是层数，每多一层网络就能读到更多一层的跳数，$H$是某层隐藏输出，$\sigma$是激活函数，$W$是参数矩阵，$\tilde{D}$和$\tilde{A}$是回环度数矩阵和回环邻接矩阵，回环度数矩阵用于给回环邻接矩阵做归一化。图的邻接矩阵的$k$次方中的每一项代表对应的两个节点距离为$k$的路径格式有多少，因此$\hat{A}$和$H$中包含路径信息。

$$
H^{(l + 1)} = \sigma (\tilde{D}^{-\frac{1}{2}}\tilde{A}\tilde{D}^{-\frac{1}{2}}H^{(l)}W^{(l)})
$$

在本文中，当一个节点邻居很多时，$\tilde{A}$对应的值会变得很大，那么对于节点邻居很少的值会极其不公平。因此文中采用了对称归一化的方法，在回环邻接矩阵基础上，$A_{ij}$除以自己节点的度数和连接节点的度数，即$\hat{A}=\tilde{D}^{-\frac{1}{2}}\tilde{A}\tilde{D}^{-\frac{1}{2}}$。这样做的好处是，比如一个节点连了很多节点，把信息传给另一个节点时，这条信息的重要程度就没有那么大；而一个节点只连了另一个节点，那么这条信息就很重要了：

$$
\hat{A}_{ij} = \frac{\tilde{A}_{ij}}{\sqrt{\tilde{d}_i \tilde{d}_j}}
$$

在论文中，提到了两到三层GCN网络在测试中最好，其中X为输入，A为邻接矩阵：

$$
Z = f(X, A) = \text{softmax} (\hat{A}~\text{ReLU}(\hat{A}XW^{(0)}) W^{(1)})
$$

![](GCN.jpg)

如图所示，半监督学习的意思是训练样本中只有部分是打上标签的，而网络要通过打上标签的这些节点预测所有节点的类别。前向传播会使用整张图的节点特征和边结构，最终模型可以输出所有节点的类别概率。

针对已经打上标签的交叉熵如下，其中$f$是类别数：

$$
\mathcal{L} = - \sum_{l \in \mathcal{Y}_L} \sum_{f = 1}^{F} Y_{lf} \ln Z_{lf}
$$

**讨论**：GCN适用于无向图，对有向边和边特征不太能支持，而且装入内存/显存的图不能太大，要不然装不下。

### GraphSAGE

问题：传统transductive直推式学习直接为训练图中每个节点学一个嵌入，但是新加入的节点没有现成的嵌入，而Inductive归纳式学习是学习了一个嵌入函数，新加入的节点可以通过邻居和自己的原有特征更新自己的嵌入。同时，通过采样训练，也解决了GCN更新一个节点需要整张图信息导致面对大图时候效率低下的问题。

![](GraphSAGE.jpg)

**第一步**：随机采样邻居，本文中设置训练层数为2。设要更新的中心节点为$v$，则节点v的幂集为$2^{V}$，节点$v$的邻居集合可表示为：

$$
\mathcal{N} : v \rightarrow 2^{V}
$$

**第二步**：多层邻居由外向内地聚合信息，设$h$为节点的特征向量，$k$为层数，$W$为隐藏参数矩阵

$$
h_v^{(k - 1)} = \sigma (\text{AGGREGATE}({h_v^{(k)}\space|\space\forall u \in \mathcal{N}(v)}))
$$

文中提到了三种聚合函数：

第一种是直接求平均值，好处是快，但是无法表示不同节点传递特征的重要性，这种重要性被平均了

第二种是LSTM，缺点是LSTM训练的数据中顺序会影响聚合特征，图本身是无序的，文中用了给LSTM随机顺序输入邻居规避了这个问题，训练效果不错

第三种是池化，只记录邻居每个特征向量中最突出的那个，又快又好，公式如下：

$$
\text{AGGREGATE}_{k-1}^{pool} = \max ({\space\sigma (W_{\text{POOL}}h_v^{(k)} + b)\space|\space\forall u \in \mathcal{N}(v)})
$$

在聚合了之后，更新节点特征向量：

$$
h_u^{(k - 1)} = \sigma (W^{(k-1)}\cdot\text{CONCAT}(h_u^{k},\space h_{\mathcal{N}(v)}^{(k - 1)}))
$$

并做L2归一化：

$$
h_u^{(k - 1)} \leftarrow \frac{h_u^{(k-1)}}{\| h_u^{k - 1} \|_2} 
$$

**第三步**：若节点无标签，则本文也采用了图中相邻节点特征向量接近的假设，求loss。文中采用了随机游走的形式，抽取了在路径上和$z$接近的节点，设节点$u$和$v$离得很近，和$n$离得很远，规定节点间点积越大越相似，下面公式是一个节点的loss

$$
\mathcal{J}_{\mathcal{G}}(z_u) = -\log(\sigma (z_u^{\top} z_v)) - Q \cdot \mathbb{E}_{v_n \sim P_n(v)} \log (\sigma (- z_u^{\top} z_{v_n} )) \quad
$$

其中负样本期望项可以用 Q 个负样本近似为：

$$
Q \cdot \mathbb{E}_{v_n \sim P_n(v)} \log (\sigma (-z_u^{\top} z_n)) \approx \sum_{i=1}^{Q} \log (\sigma ( - z_u^{\top} z_{n_i} ))
$$

**讨论**：论文对于大图的解决方案是每一层随机抽几个，例如论文中只算了两层，第一层（外层）抽25个节点，第二层（内层）抽10个节点，设$batch_size = 512$，在所有抽到的节点都不相互重合的最差情况下，需要计算$512+512×10+512×10×25$个节点

### GAT

问题：GCN只能通过图的结构（邻接矩阵）学习节点对节点的重要性，缺少灵活性；GraphSAGE只能抽取节点的部分邻接节点。本文提出了一种注意力机制的图模型，能聚合节点的所有邻接节点，而且能学习节点间的多种重要性。

![](GAT.jpg)

单头注意力：

我们想知道邻居节点j对当前节点i的重要性，其中$h$是隐藏嵌入，$c$是注意力分数：

$$
h_i' = \sigma(\sum_{j \in \mathcal{N}_i} c_{ij} Wh_j)
$$

注意力分数$c$的计算公式，套了一层softmax：

$$
c_{ij} = \frac{\exp (e_{ij})}{\sum_{k \in \mathcal{N}_i} \exp (e_{ik})}
$$

其中，$a$是参数向量，$Wh$已经变成向量了，$e$是标量，$e$的计算公式是：

$$
e_{ij} = \text{LeakyReLU}(a^{\top}(Wh_i \| Wh_j))
$$

多头注意力：

文中提到只有单头注意力还不太够，为此论文设置了8个头，有8个注意力分数，每个头都用来学习所有邻居的不同的特征，在每个单头得到的隐藏嵌入的基础上拼接而成：

$$
h_i' = \|_{k = 1}^{K} \sigma(\sum_{j \in \mathcal{N}_i} c_{ij}^k W^kh_j)
$$

如果是最后一层，则直接输出8个头的平均值：

$$
h_i' = \sigma(\frac{1}{K} \sum_{k = 1}^{K} \sum_{j \in \mathcal{N}_i} c_{ij} Wh_j) 
$$

讨论：存储复杂度降到了和边以及节点的数量线性相关。在稀疏图上，GPU不一定比CPU优势明显，因为图的数据往往访存不连续。而且本文中提到的GAT的感受野受限于网络层数。本文提到领域重叠会重复计算。本文没把边特征也加入注意力分数。


### GIN

Graph Isomorphism Network（图同构网络），本文同样讨论了图神经网络的通用步骤，同时指明了图神经网络的精度上限，并指出聚合函数的种类对于精度有决定性影响。

论文中提到了Weisfeiler-Lehman Test，WL测试。在图论中，判断两个图是否同构，即判断两个图的拓扑结构是否一模一样是难题。WL测试则通过每个节点Hash值组合成整张图的集合可以判断大部分图是否为同构。

主要分为三个步骤，和图神经网络步骤相仿：

1. 聚合，收集邻居标签，对应到神经网络的通用公式是：

$$
a_v^{(k)} = \text{AGGREGATE}^{(k)}(\{h_u^{(k-1)}~:~u \in \mathcal{N}(v)\})
$$

在数学上，单射指的是不同的输入一定能得到不同的输出，WL更新标签相当于单射，因此能区分更多异构图。但是神经网络中的一些聚合函数会丢失信息，例如GCN的平均值和GraphSAGE的最大池化，这就让即使节点的邻居有较大不同，聚合之后的嵌入也有概率接近或相同。

论文中给出了三种聚合函数的表达能力，从理论角度说为什么GCN和GraphSAGE天然地比GAT准确率差一点：

$$
\text{SUM} > \text{MEAN} > \text{MAX}
$$

在GIN中，聚合函数用的是$\text{SUM}$

2. 更新，WL主要用的是hash，对应通用公式是：

$$
h_v^{(k)} = \text{COMBINE}(h_v^{(k-1)}, a_v^{(k)})
$$

在GIN中，更新节点是直接加，并可以调参，决定保留节点多少自己的信息。在本文中，MLP指的是多层感知机，是一种前馈神经网络结构。一个MLP通常包含输入层、隐藏层和输出层。论文中提到，只有单层网络表达能力有限，而网络中只要包含至少一个隐含层，那就几乎可以逼近任何复杂的连续函数，可以逼近单射的效果。为此，论文也认为神经网络的表达能力上限是WL。

$$
h_v^{(k)} = \text{MLP}^{(k)}((1 + \epsilon)h_v^{(k-1)} + \sum_{u \in \mathcal{N}(v)} h_u ^ {(k - 1)})
$$

3. Readout，如果需要把图的每个节点都汇总的话，通用公式如下：

$$
h_G = \text{READOUT}(h_v^{(K)}~:~u \in G)
$$

论文中也提到可以把不同层数表示的图拿来做拼接：

$$
h_G =  \text{CONCAT}(\text{READOUT}(h_v^{(k)}~:~u \in G) | k = 1,...,K) 
$$

在 EDA 中，不同 GNN 层数可以对应不同范围的电路结构信息。例如第1层可能更偏向局部 wire/pin/cell 邻接关系，第2层可能覆盖更远的 netlist 连接或 RC tree 邻域，更深层可能涉及 timing path 上更大范围的传播关系。因此，把不同层的图表示拼接起来，可能有助于同时利用局部寄生信息和更全局的时序结构信息。

## Graph Transformer

### Graphormer

问题：transformer在图中准确率不高，是因为本身适配的任务天然带有顺序，而图是无序的。此外，Transformer原公式中很难注意到到图这样有明显的路径编码。论文用Transformer的机制，给隐藏层加上额外的中心性、边和最短距离编码，论证了Transformer在图中也很实用。

![](Graphormer.jpg)

中心性编码：文中给每个节点一个特征向量，加上这个节点的入度和出度对应的同维度向量（无向图只用一个向量就够了）。注意，即使是不同节点，度数相同则对应的度向量也是一致的。公式中$h$是节点的嵌入向量。

$$
h_i' = h_i + z_{deg(v_i)^+} + z_{deg(v_i)^-}
$$

和Transformer类似地，$h$嵌入点积三个参数矩阵，$d$是隐藏维度，并缩放，得到初始注意力分数，这里的分数是一个标量，表示节点$v_i$和$v_j$的初始注意力分数：

$$
a_{ij} = \frac{(h_i'W_Q) \cdot (h_j'W_K)^{\top}}{\sqrt{d}}
$$

距离编码：文中维护一个距离矩阵（Spatial），这个矩阵作为参数更新。矩阵中的每一项都是两个节点的最短距离$\text{DFS} (v_i, v_j)$，每个距离都是标量，而且不同节点间的相同距离的参数值是一致的。

$$
b_{ij} = \phi_{(v_i, v_j)}  = \text{SPD} (v_i, v_j) 
$$

边编码：每个边有一个特征向量$e$，在不同节点和节点的最短路径中，边的序号相同则参数向量$w^E$相同，边分数$c_{ij}$的计算方式是：

$$
\frac{1}{N} \sum_{n=1}^{N}x_{e_n}(w_n^E)^{\top}
$$

综上，单头注意力每个节点的注意力分数是：

$$
A_{ij} = a_{ij} + b_{ij} + c_{ij}
$$

论文中还调整了前馈神经网络和多头注意力机制的顺序，MHA是多头注意力，FFN是前馈神经网络，LN是层归一化：

$$
\begin{aligned}
h'^{(l)} &= \mathrm{MHA}\left(\mathrm{LN}\left(h^{(l-1)}\right)\right) + h^{(l-1)} \\
h^{(l)} &= \mathrm{FFN}\left(\mathrm{LN}\left(h'^{(l)}\right)\right) + h'^{(l)}
\end{aligned}
$$

### GraphGPS

问题：这篇文章说传统GCN通过多层网络可以感知到很远的节点，但是可能导致节点嵌入过平滑和信息丢失的问题。Transformer由于时间复杂度的限制，以及自身没有结构性编码，很难在图中准确地感知其余节点。本文提出了两个编码：位置性编码（PE，position Encoding）和结构性编码（SE，structure Encoding），并在节点的局部用了MPNN，用线性transformer做全局感知，有效解决了上述问题。

![](GraphGPS.jpg)

设X为节点嵌入，E为边嵌入，A为邻接矩阵，MPNN只看与自己直接相邻的节点，Transformer则看全局的节点，则有如下公式：

$$
X^{l+1}, E^{l+1} = \text{GPS}^l(X^l, E^l, A)
$$

其中，文中 MLP 是 2 层，隐藏维度为 2×D，激活函数 ReLU：

$$
\begin{aligned}
\hat{X^{l+1}}_T &= \text{GLOBALATTN}^l(X^l)\\
\hat{X^{l+1}}_M, E^{l+1} &= \text{MPNN}(X^l, E^l, A)\\
X^{l+1}_T &= \text{BatchNorm}(\text{Dropout}(\hat{X^{l+1}}_T) + X^l)\\
X^{l+1}_M &= \text{BatchNorm}(\text{Dropout}(\hat{X^{l+1}}_M) + X^l)\\
X^{l+1} &= \text{MLP}(X^{l+1}_T + X^{l+1}_M)
\end{aligned}
$$

在初始化中，论文根据相对编码（描述两个节点间的关系）和非相对编码（描述节点自己）给初始的节点和边嵌入赋予不同的值。相对编码中，会根据$PE(G)$和$SE(G)$生成$P_{edge}$和$S_{edge}$，在非相对编码则生成的是$P_{node}$和$S_{node}$

其中的$N$是节点数，$E$是边数，$D$是隐藏维度，$⨁$在文中为拼接和线性投影，统一的公式如下：

$$
\begin{aligned}
X^0 \leftarrow ⨁_{node} (\text{NodeEncoder}(X), P_{node}, S_{node}) \in \mathbb{R}^{N \times D}\\
E^0 \leftarrow ⨁_{edge} (\text{EdgeEncoder}(E_{feat}), P_{edge}, S_{edge}) \in \mathbb{R}^{E \times D}
\end{aligned}
$$

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

### 随机森林

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


### 图神经网络

#### 参考文献：ParaGraph:Layout Parasitics and Device Parameter Prediction using Graph Neural Networks(Nvidia DAC 2020)

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

#### 参考文献：Parasitic-Aware Analog Circuit Sizing with Graph Neural Networks and Bayesian Optimization(Nvidia DATE 2021)

上一篇论文的续作。上一篇论文主要讲的是集总电容（对地、基底等电容），这篇论文在图神经网络上做了改进，用一对边节点的嵌入计算耦合电容（导线之间电容），用相邻边节点和引脚节点的嵌入计算电阻。加上了导线间的耦合电容后，准确度有明显的改进。

![](Parastic-Aware_Fig2.jpg)

在论文中，把一段导线近似为一个net 模型，里边可能有很多分支，两端可能连很多单元，甚至还有可能跨层，对于大型芯片来说这种预测不够准。

同时，论文没有明确提出用于计算的耦合电容的两个边节点是怎么来的，只是说所有边两两算耦合电容没必要。


#### 参考文献：GNN-Cap: Chip-Scale Interconnect Capacitance Extraction Using Graph Neural Network(复旦 TCAD 2024)

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