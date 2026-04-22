---
title: "OpenROAD Flow Script(ORFS) 流程学习"
summary: "研一上学期三天摸鱼两天划水看了两个月的开源项目"
date: 2025-12-31
tags: ["group-task"]
cover: "/images/academic/ORFS/cover.png"
externalUrl: "https://www.jianguoyun.com/p/DUpUhM4Q2fCkCxiJk6gGIAA"
externalLabel: "下载PPT（坚果云）"
pinned: true
---

OpenROAD是一套开源的EDA流程，我是做STA（Static Timing Analysis 静态时序分析）的。

芯片设计出来到流片之前，最重要的步骤是检查是否符合时序，即芯片是否所有的电路都满足设计要求的时钟周期。通俗地讲是判断电信号从一端寄存器（引脚）到另一端寄存器（引脚）能不能在规定的时间范围内跑完。这个检查是否符合时序的步骤，在EDA中被叫做STA。除了在流片之前需要做静态时序分析，在芯片设计路径如逻辑综合、布局、CTS、布线也需要静态时序分析，用于**检测**当前步骤跑出来的结果是否合理，以及为后续步骤提供**指导**优化。因此，STA算是EDA流程的“心脏”。

芯片在工业上后端设计流程的时间成本太高，一个真实的芯片可能在EDA要跑几天甚至几周才能到流片之前的STA这一步。如果STA报告时序违例，最坏情况下还要从Verilog这一步更改设计。随着机器学习在芯片领域的应用，如果我们能在整个芯片设计流程中的某一步做一下STA**预测**，提前判断这个芯片是否能流片成功，则将大幅度减少设计迭代时间，加速芯片生产。

综上所述，由于芯片后端流程的几乎每一步都与STA密切相关，因此指导老师让我阅读整个开源的OpenROAD项目。

笔记已开源，点击按钮可以获得坚果云的链接。笔记可能有误，发现错误可以用邮件联系我。
![](/images/academic/ORFS/1.png)

用简要的例子和模型，介绍计算门延时查表法
![](/images/academic/ORFS/2.png)

用简要的例子，介绍在布局阶段结束是如何计算门延时和线延时，预估STA
![](/images/academic/ORFS/3.png)

OpenROAD简要流程和用到OpenSTA的地方
![](/images/academic/ORFS/4.jpg)