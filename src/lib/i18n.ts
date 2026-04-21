export const languages = ['zh', 'en'] as const;
export type Lang = (typeof languages)[number];

export const defaultLang: Lang = 'zh';

export const ui = {
	zh: {
		home: '首页',
		academic: '学术进展',
		notes: '个人笔记',
		anime: '追番列表',
		music: '音乐专区',
		about: '关于我',
		cardView: '卡片视图',
		listView: '列表视图',
		previous: '上一页',
		next: '下一页',
		page: '第 {page} 页',
		pageStatus: '第 {current} 页 / 共 {total} 页',
		chineseOnly: 'Chinese only',
		latest: '最近更新',
		publications: '个人论文',
		noPublications: '暂无发表论文。先把阅读、实验和想法整理好。',
		open: '查看详情',
		viewAll: '查看全部',
		copyMail: 'Gmail',
		copyMailDone: '已复制',
		themeLight: '白天',
		themeDark: '黑夜',
		notFoundTitle: '前面的路以后再来探索吧。',
		notFoundLede: '这个页面暂时还没有被写出来，不过首页和几个主模块都已经准备好了。',
		backToHome: '返回首页',
		backToAcademic: '去学术进展',
		backToNotes: '去个人笔记',
		animeEyebrow: 'Anime',
		animeTitle: '追番列表',
		animeLede: '把那些看完之后还会在心里留一阵回声的作品，慢慢排成一面墙。',
		animeWallLabel: '追番作品墙',
		animeFilterLabel: '追番筛选',
		watchTime: '观看时间',
		all: '全部',
		rewatch: '是否重看',
		firstWatch: '首看',
		rewatchShort: '重看',
		sortDateDesc: '按时间降序',
		sortDateAsc: '按时间升序',
		sortRatingDesc: '按星级降序',
		sortRatingAsc: '按星级升序',
		showingCount: '当前显示 {visible} / {total} 条',
		musicItemCount: '{count} 条',
		animeArchiveOpen: '查看归档',
		subjectTags: '题材标签',
		watchDate: '观看日期',
		animeFormat: '形式',
		originalType: '原作类型',
		tiebaPost: '贴吧原帖',
		musicEyebrow: 'Music',
		musicTitle: '音乐专区',
		musicLede:
			'每次听音乐总会幻想着自己能在很多人面前演奏这个曲目，因为想象中的自己演奏得很好而开心。毕竟，练琴和敲代码没有什么本质区别，都是动动手指的事。',
		appreciation: '音乐鉴赏',
		appreciationLede: '像整理喜欢的专辑和曲目一样，把当下会反复回去听的东西留在这里。',
		practice: '练习视频',
		practiceLede: '把阶段练习留下来。现在先只保留封面、标题、时间和短评，点击直接去 Bilibili。',
		classical: '古典',
		pop: '流行',
		piano: '钢琴练习',
		violin: '小提琴练习',
		openLink: '打开链接',
		openBilibili: '前往 Bilibili',
		onlyChineseCard: 'Chinese only',
	},
	en: {
		home: 'Home',
		academic: 'Academic',
		notes: 'Notes',
		anime: 'Anime Archive',
		music: 'Music',
		about: 'About',
		cardView: 'Card',
		listView: 'List',
		previous: 'Previous',
		next: 'Next',
		page: 'Page {page}',
		pageStatus: 'Page {current} of {total}',
		chineseOnly: 'Chinese only',
		latest: 'Latest',
		publications: 'Publications',
		noPublications: 'No publications yet. Reading, experiments, and ideas are taking shape first.',
		open: 'Open',
		viewAll: 'View All',
		copyMail: 'Gmail',
		copyMailDone: 'Copied',
		themeLight: 'Light',
		themeDark: 'Dark',
		notFoundTitle: 'The road ahead can wait for another visit.',
		notFoundLede: 'This page is not here yet, but the homepage and the main sections are ready to explore.',
		backToHome: 'Back Home',
		backToAcademic: 'Go to Academic',
		backToNotes: 'Go to Notes',
		animeEyebrow: 'Anime',
		animeTitle: 'Anime Archive',
		animeLede: 'A wall for the shows that keep echoing for a while after the credits are over.',
		animeWallLabel: 'Anime archive wall',
		animeFilterLabel: 'Anime filters',
		watchTime: 'Watch Time',
		all: 'All',
		rewatch: 'Rewatch',
		firstWatch: 'First Watch',
		rewatchShort: 'Rewatch',
		sortDateDesc: 'Newest First',
		sortDateAsc: 'Oldest First',
		sortRatingDesc: 'Highest Rated',
		sortRatingAsc: 'Lowest Rated',
		showingCount: 'Showing {visible} / {total}',
		musicItemCount: '{count} items',
		animeArchiveOpen: 'Open Archive',
		subjectTags: 'Themes',
		watchDate: 'Watch Date',
		animeFormat: 'Format',
		originalType: 'Source',
		tiebaPost: 'Tieba Post',
		musicEyebrow: 'Music',
		musicTitle: 'Music',
		musicLede:
			'Every time I listen to a piece, I end up imagining myself playing it well in front of a crowd and feeling happy just because that version of me sounds great. Practicing an instrument and writing code are not that different. In both cases, you are really just moving your fingers.',
		appreciation: 'Music Appreciation',
		appreciationLede: 'A small shelf for the albums and pieces I keep returning to.',
		practice: 'Practice Videos',
		practiceLede: 'A place to leave stage-by-stage practice clips. For now each card only keeps the cover, title, date, and a short note, then jumps straight to Bilibili.',
		classical: 'Classical',
		pop: 'Pop',
		piano: 'Piano Practice',
		violin: 'Violin Practice',
		openLink: 'Open Link',
		openBilibili: 'Open Bilibili',
		onlyChineseCard: 'Chinese only',
	},
} as const;

type UiKey = keyof (typeof ui)[typeof defaultLang];

export function getLangFromPath(pathname: string): Lang {
	return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : defaultLang;
}

export function stripLangPrefix(pathname: string): string {
	if (pathname === '/en') return '/';
	if (pathname.startsWith('/en/')) return pathname.slice(3) || '/';
	return pathname || '/';
}

export function localizePath(pathname: string, lang: Lang): string {
	const cleanPath = stripLangPrefix(pathname.startsWith('/') ? pathname : `/${pathname}`);

	if (lang === defaultLang) {
		return cleanPath;
	}

	return cleanPath === '/' ? '/en/' : `/en${cleanPath}`;
}

export function toggleLangPath(pathname: string): string {
	const lang = getLangFromPath(pathname);
	return localizePath(pathname, lang === 'en' ? 'zh' : 'en');
}

export function t(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
	let value: string = ui[lang][key] ?? ui[defaultLang][key];

	for (const [name, replacement] of Object.entries(vars)) {
		value = value.replace(`{${name}}`, String(replacement));
	}

	return value;
}
