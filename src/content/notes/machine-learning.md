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
