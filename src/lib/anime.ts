import type { Lang } from './i18n';

export interface AnimeSeason {
	value: string;
	label: string;
	sort: number;
}

export const animeCardPageSize = 10;
export const animeListPageSize = 12;

export function getAnimeSeason(date: Date, lang: Lang = 'zh'): AnimeSeason {
	const year = date.getFullYear();

	if (year >= 2026) {
		return {
			value: '2026',
			label: '2026',
			sort: 2026,
		};
	}

	if (year >= 2021) {
		return {
			value: '2025-2021',
			label: lang === 'en' ? '2025-2021' : '2025-2021',
			sort: 2025,
		};
	}

	if (year >= 2016) {
		return {
			value: '2020-2016',
			label: lang === 'en' ? '2020-2016' : '2020-2016',
			sort: 2020,
		};
	}

	if (year >= 2011) {
		return {
			value: '2015-2011',
			label: lang === 'en' ? '2015-2011' : '2015-2011',
			sort: 2015,
		};
	}

	return {
		value: 'pre-2011',
		label: lang === 'en' ? '2010 & Earlier' : '2010及之前',
		sort: 2010,
	};
}

export function getRatingLabel(rating?: number, lang: Lang = 'zh'): string {
	if (!rating) return lang === 'en' ? 'Not Rated' : '未评分';
	return lang === 'en' ? `${rating} Stars` : `${rating} 星`;
}

export function getStars(rating?: number): string {
	if (!rating) return '☆☆☆☆☆';
	return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

export function getRewatchBucket(rewatchCount = 1): 'first' | 'rewatch' {
	return rewatchCount >= 2 ? 'rewatch' : 'first';
}

export function getRewatchLabel(rewatchCount = 1, lang: Lang = 'zh'): string {
	if (rewatchCount <= 1) return lang === 'en' ? 'First Watch' : '首看';
	if (rewatchCount >= 5) return lang === 'en' ? 'Rewatch 5+' : '重看 5 次+';
	return lang === 'en' ? `Rewatch ${rewatchCount}` : `重看 ${rewatchCount} 次`;
}

export function uniqueValues<T>(items: T[], key: (item: T) => string): string[] {
	return Array.from(new Set(items.map(key).filter(Boolean)));
}
