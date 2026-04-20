export interface AnimeSeason {
	value: string;
	label: string;
	sort: number;
}

export const animeCardPageSize = 10;
export const animeListPageSize = 12;

export function getAnimeSeason(date: Date): AnimeSeason {
	const year = date.getFullYear();

	if (year < 2026) {
		return {
			value: 'pre-2026',
			label: '2026 之前',
			sort: 0,
		};
	}

	const quarter = Math.floor(date.getMonth() / 3) + 1;

	return {
		value: `${year}-q${quarter}`,
		label: `${year} Q${quarter}`,
		sort: year * 10 + quarter,
	};
}

export function getRatingLabel(rating?: number): string {
	if (!rating) return '未评分';
	return `${rating} 星`;
}

export function getStars(rating?: number): string {
	if (!rating) return '☆☆☆☆☆';
	return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

export function getRewatchBucket(rewatchCount = 1): 'first' | 'rewatch' {
	return rewatchCount >= 2 ? 'rewatch' : 'first';
}

export function getRewatchLabel(rewatchCount = 1): string {
	if (rewatchCount <= 1) return '首看';
	if (rewatchCount >= 5) return '重看 5 次+';
	return `重看 ${rewatchCount} 次`;
}

export function uniqueValues<T>(items: T[], key: (item: T) => string): string[] {
	return Array.from(new Set(items.map(key).filter(Boolean)));
}
