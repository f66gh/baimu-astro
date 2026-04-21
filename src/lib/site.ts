import type { Lang } from './i18n';

export const siteName = '白木的个人主页';
export const siteEyebrow = 'BaiMu-Astro';
export const siteAvatar = '/images/profile/avatar.jfif';
export const gmailAddress = 'deng37548@gmail.com';

export const socialLinks = {
	github: 'https://github.com/f66gh',
	bilibili: 'https://space.bilibili.com/91254003?spm_id_from=333.1007.0.0',
	tieba:
		'https://tieba.baidu.com/home/main?id=tb.1.ba2285cf.dxNvbbDgaRfxsMQsBsRUSw&fr=personalize_page',
} as const;

export const siteDescriptions: Record<Lang, string> = {
	zh: '本网站纯 Vibe Coding，由 Codex 完成。写帖子主要用于锻炼我的文字表达能力，顺便记录我的学习进展和课余爱好。',
	en: 'This site is built through pure vibe coding with Codex. I write posts to practice expression and keep track of study progress and hobbies.',
};

export const siteHomeTitles: Record<Lang, string> = {
	zh: siteName,
	en: "Baimu's Homepage",
};

export const siteIdentityLines: Record<Lang, string> = {
	zh: '计算机专业研究生 / EDA 后端 / STA / 宅家练琴型选手',
	en: 'Graduate student / Backend EDA / STA / desk-to-practice-room commuter',
};

export const aboutTags = [
	{ zh: '宅男', en: 'Homebody' },
	{ zh: '计算机', en: 'Computer' },
	{ zh: '研究生', en: 'Graduate' },
	{ zh: '音乐', en: 'Music' },
	{ zh: '二次元', en: 'ACG' },
	{ zh: '日漫', en: 'Anime' },
	{ zh: '抽象', en: 'Absurd' },
] as const;

export const aboutParagraphs: Record<Lang, string[]> = {
	zh: [
		'我是计算机专业的在读研究生，主要研究 EDA 后端中的 STA 问题。喜欢音乐和日漫，支持我天天来工位的原因之一，是学琴和练琴的地方离我的工位很近，晚饭后通常会练一个半到两个小时的琴。',
		'我很喜欢钢琴，在考研复试之后，也就是 2025 年 4 月左右，在学校附近报了一对一。后来又觉得只学一门乐器还是不够打发时间，毕竟从复试结束到研一上半学期都比较闲，游戏也有点打不动了。',
		'我在看了 B 站 UP 主“尔东和小明”之后，又很喜欢《四月是你的谎言》的 OP《若能绽放光芒》，于是对小提琴产生了兴趣，并在 2025 年 10 月开始学小提琴。小提琴比钢琴难很多，到我写这个介绍的时候，学了半年还是拉得像锯木头一样。',
		'我不爱运动，也不太善社交，非常喜欢家里蹲，算是标准宅男。只有天暖和的时候，才会偶尔出去跑步。学乐器除了从小对音乐感兴趣之外，也因为我总会幻想自己有朝一日能上台或者在路边把喜欢的曲子演奏出来，顺便装个大的。',
		'毕竟，练琴和敲代码没有什么本质区别，都是动动手指的事。',
	],
	en: [
		'I am a graduate student in computer science, mainly working on STA in backend EDA. I like music and anime, and one reason I show up at my desk every day is that the rooms for practicing instruments are very close to it. After dinner I usually practice for one and a half to two hours.',
		'I especially love the piano. After my graduate school interview in April 2025, I started one-on-one piano lessons near campus. Later I felt that learning only one instrument was still not enough to fill my free time, especially when games no longer pulled me in that much.',
		'After watching the Bilibili creator Erdong and Xiaoming, and after getting obsessed with Hikaru Nara, the opening of Your Lie in April, I became interested in the violin and started learning it in October 2025. The violin is much harder than the piano, and by April 2026 it still sounds like I am sawing wood.',
		'I am not much into sports, not especially social, and honestly a full-on homebody. I only go out for running when the weather gets warm. Part of why I learn instruments is that I always imagine myself one day playing a piece I love on stage or on the street and absolutely showing off.',
		'After all, practicing an instrument and writing code are not that different. In both cases, you are really just moving your fingers.',
	],
};
