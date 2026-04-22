---
title: "INSTA 英伟达实验室"
summary: "DAC 2025 最佳论文奖"
date: 2026-03-21
tags: ["paper-reading"]
cover: "/images/academic/INSTA/cover.png"
externalUrl: "https://www.jianguoyun.com/p/DSG5nu4Q2fCkCxjdk6gGIAA"
externalLabel: "下载PPT（坚果云）"
---
这篇文章引入了可微的概念。

简单来说，这篇文章通过算法把芯片中的每一个时序弧（门和导线）对于这一段电路造成的时序影响给量化了。论文说在一段时间内，只需要用一次前向传播和后向传播就能又快又准地算出这种影响。从而方便后端的各个步骤在影响时序最大的地方做调整。

![](/images/academic/INSTA/2.png)

![](/images/academic/INSTA/1.png)