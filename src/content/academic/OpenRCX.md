---
title: "OpenRCX和calibration"
summary: "学习一下寄生参数提取"
date: 2026-04-20
tags: ["group-task"]
cover: "/images/academic/OpenRCX/cover.png"
externalUrl: "https://www.jianguoyun.com/p/De5v3eUQ2fCkCxiJlKgGIAA"
externalLabel: "下载PPT（坚果云）"
---
OpenROAD中的OpenRCX不是一上来就能读tlef和def文件然后做寄生参数提取，还需要这个工艺库的其他参数，例如一根线大概有多少电阻，和旁边线大概有多大耦合电容。
这个OpenRCX学习这些参数的过程叫**标定(calibration)**

下面是三个开源项目的调用管理图
![](/images/academic/OpenRCX/1.jpg)

