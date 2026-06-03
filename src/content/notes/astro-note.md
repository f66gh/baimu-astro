---
title: "用静态站Astro构建个人主页，以及组件说明"
summary: "静态生成决定部署方式，不决定交互上限；组件和内容模型才是长期扩展的关键。"
date: 2026-04-18
tags: ["Astro", "内容模型", "静态生成"]
cover: "/images/notes/astro-note/cover.png"
---

## mdx图片插入

```
<NoteImage
  src="场求解器1.png"
  size="sm"
  caption="单位电压激励示意"
/>
```

```
<MediaPair
  src="场求解器2.png"
  imageSide="right"
  imageSize="md"
  caption="Maxwell 电容矩阵"
>
  对于导体 $A$：

  $$
  Q_A = C_{AB}(U_A-U_B)+C_{AC}(U_A-U_C)
  $$

  - 对角线项表示总电荷响应
  - 非对角线项表示耦合电容
</MediaPair>
```

```
size="xs|sm|md|lg|full"
width="520px" 或 width="68%" 覆盖单图宽度
```

```
verticalAlign="start"，默认是center，文字居中对齐
imageSide="left|right"，默认左图右文
imageWidth="46%" 覆盖图文组件的图片列宽
窄屏自动变成图在上、文字在下
caption 自动作为默认 alt
轻边框，无点击放大
src="场求解器1.png" 会继续沿用 frontmatter 里的 imageRoot
```