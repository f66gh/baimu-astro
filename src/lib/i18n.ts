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
		cardView: '卡片视图',
		listView: '列表视图',
		previous: '上一页',
		next: '下一页',
		page: '第 {page} 页',
		pageStatus: '第 {current} 页 / 共 {total} 页',
		chineseOnly: 'Chinese only',
		latest: '最近更新',
		contentPreview: '内容预览',
		allNotes: '全部笔记',
		publications: '个人论文',
		noPublications: '暂无发表论文。先把阅读、实验和想法整理好。',
		open: '查看详情',
	},
	en: {
		home: 'Home',
		academic: 'Academic',
		notes: 'Notes',
		anime: 'Anime',
		music: 'Music',
		cardView: 'Card',
		listView: 'List',
		previous: 'Previous',
		next: 'Next',
		page: 'Page {page}',
		pageStatus: 'Page {current} of {total}',
		chineseOnly: 'Chinese only',
		latest: 'Latest',
		contentPreview: 'Preview',
		allNotes: 'All Notes',
		publications: 'Publications',
		noPublications: 'No publications yet. Reading, experiments, and ideas are taking shape first.',
		open: 'Open',
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
