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
		siteShortName: 'Aiu Web',
		about: '关于我',
		homeAcademicDescription: '记录论文阅读、组内任务，以及想法与阶段性总结。',
		homeNotesDescription: '放置和组内研究不强绑定的学习记录、工具笔记和自由探索。',
		homeMusicDescription: '每次听到喜欢的曲子，都会忍不住幻想自己也能把它弹出来。',
		academicEyebrow: 'Academic',
		notesEyebrow: 'Notes',
		academicListLede: '用更紧凑的列表快速回看论文阅读、组内任务和想法总结。',
		notesListLede: '用列表模式快速扫描零散笔记、工具记录和学习材料。',
		openNav: '打开导航',
		closeNav: '关闭导航',
		siteNav: '站点导航',
		breadcrumbNav: '页面层级',
		socialNav: '社交平台',
		viewSwitch: '视图切换',
		paginationNav: '分页',
		contentStats: '内容统计',
		animeSortLabel: '排序方式',
		pinnedBadge: '置顶',
		currentPinned: '当前置顶：{title}',
		toggleLanguage: '切换语言',
		toggleTheme: '切换深浅色',
		titleWithSite: '{title} | {site}',
		titleWithPageLabel: '{title} | {pageLabel}',
		titleWithSection: '{title} | {section}',
		listSuffix: '列表',
		notFoundPageTitle: '404',
		cardView: '卡片视图',
		listView: '列表视图',
		previous: '上一页',
		next: '下一页',
		page: '第 {page} 页',
		pageStatus: '第 {current} 页 / 共 {total} 页',
		chineseOnly: 'Chinese only',
		latest: '最近更新',
		mainQuest: '主线任务',
		publications: '个人论文',
		noPublications: '暂无发表论文。先把阅读、实验和想法整理好。',
		open: '查看详情',
		openExternal: '查看外部资料',
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
		animeLede: '像steam那样的番剧墙。有些番剧没评分是因为真的忘了讲的啥。',
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
		musicTotalCount: '共 {count} 条',
		animeArchiveOpen: '查看归档',
		subjectTags: '题材标签',
		watchDate: '观看日期',
		animeFormat: '形式',
		originalType: '原作类型',
		bangumiLink: 'Bangumi',
		tiebaPost: '贴吧原帖',
		musicEyebrow: 'Music',
		musicTitle: '音乐专区',
		musicLede:
			'每次听音乐总会幻想着自己能在很多人面前演奏这个曲目，因为想象中的自己演奏得很好而开心。毕竟，练琴和敲代码没有什么本质区别，都是动动手指的事。',
		appreciation: '音乐鉴赏',
		appreciationLede: '像整理喜欢的专辑和曲目一样，把当下会反复回去听的东西留在这里。',
		practice: '练习视频',
		practiceLede: '把阶段练习留下来。现在先只保留封面、标题、时间和短评，点击直接去 Bilibili。',
		classicalLede: '这里放完整的古典鉴赏卡片墙。按时间降序排列，每页 16 张。',
		popLede: '这里放完整的流行鉴赏卡片墙。按时间降序排列，每页 16 张。',
		pianoLede: '这里放完整的钢琴练习视频卡片墙。按时间降序排列，每页 16 张。',
		violinLede: '这里放完整的小提琴练习视频卡片墙。按时间降序排列，每页 16 张。',
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
		siteShortName: 'Aiu Web',
		about: 'About',
		homeAcademicDescription: 'Paper reading, group tasks, and ideas that slowly become research memory.',
		homeNotesDescription: 'Learning notes, tool records, and explorations outside the main research thread.',
		homeMusicDescription: 'Every favorite piece makes me imagine that one day I might play it well myself.',
		academicEyebrow: 'Academic',
		notesEyebrow: 'Notes',
		academicListLede: 'A compact list for quickly scanning research notes and tasks.',
		notesListLede: 'A compact list for scanning learning notes and tool records.',
		openNav: 'Open navigation',
		closeNav: 'Close navigation',
		siteNav: 'Site navigation',
		breadcrumbNav: 'Breadcrumb',
		socialNav: 'Social links',
		viewSwitch: 'View switch',
		paginationNav: 'Pagination',
		contentStats: 'Content stats',
		animeSortLabel: 'Sort options',
		pinnedBadge: 'Pinned',
		currentPinned: 'Pinned: {title}',
		toggleLanguage: 'Switch language',
		toggleTheme: 'Toggle theme',
		titleWithSite: '{title} | {site}',
		titleWithPageLabel: '{title} | {pageLabel}',
		titleWithSection: '{title} | {section}',
		listSuffix: 'List',
		notFoundPageTitle: '404',
		cardView: 'Card',
		listView: 'List',
		previous: 'Previous',
		next: 'Next',
		page: 'Page {page}',
		pageStatus: 'Page {current} of {total}',
		chineseOnly: 'Chinese only',
		latest: 'Latest',
		mainQuest: 'Main Quests',
		publications: 'Publications',
		noPublications: 'No publications yet. Reading, experiments, and ideas are taking shape first.',
		open: 'Open',
		openExternal: 'Open External Resource',
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
		animeLede: 'An anime wall inspired by Steam. Some animation don\'t have rate because I really forget what the story are taking about.',
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
		musicTotalCount: '{count} total',
		animeArchiveOpen: 'Open Archive',
		subjectTags: 'Themes',
		watchDate: 'Watch Date',
		animeFormat: 'Format',
		originalType: 'Source',
		bangumiLink: 'Bangumi',
		tiebaPost: 'Tieba Post',
		musicEyebrow: 'Music',
		musicTitle: 'Music',
		musicLede:
			'Every time I listen to a piece, I end up imagining myself playing it well in front of a crowd and feeling happy just because that version of me sounds great. Practicing an instrument and writing code are not that different. In both cases, you are really just moving your fingers.',
		appreciation: 'Music Appreciation',
		appreciationLede: 'A small shelf for the albums and pieces I keep returning to.',
		practice: 'Practice Videos',
		practiceLede: 'A place to leave stage-by-stage practice clips. For now each card only keeps the cover, title, date, and a short note, then jumps straight to Bilibili.',
		classicalLede: 'The full classical shelf, sorted by date in descending order, 16 cards per page.',
		popLede: 'The full pop shelf, sorted by date in descending order, 16 cards per page.',
		pianoLede: 'The full piano practice wall, sorted by date in descending order, 16 cards per page.',
		violinLede: 'The full violin practice wall, sorted by date in descending order, 16 cards per page.',
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
