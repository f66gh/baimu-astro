import { getCollection } from 'astro:content';
import type { Lang } from './i18n';

export interface LocalizedEntry {
	entry: any;
	baseId: string;
	isFallback: boolean;
}

export const cardPageSize = 6;
export const listPageSize = 12;

export function baseEntryId(id: string): string {
	return id.endsWith('.en') ? id.slice(0, -3) : id;
}

export function isEnglishEntry(id: string): boolean {
	return id.endsWith('.en');
}

export function sortByDateDesc<T extends { entry?: any; data?: any }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const aDate = (a.entry?.data.date ?? a.data.date).valueOf();
		const bDate = (b.entry?.data.date ?? b.data.date).valueOf();
		return bDate - aDate;
	});
}

export async function getBaseEntries(collection: string) {
	const entries = await getCollection(collection as never);
	return sortByDateDesc(entries.filter((entry: any) => !isEnglishEntry(entry.id)));
}

export async function getLocalizedEntries(collection: string, lang: Lang): Promise<LocalizedEntry[]> {
	const entries = await getCollection(collection as never);
	const baseEntries = sortByDateDesc(entries.filter((entry: any) => !isEnglishEntry(entry.id)));
	const englishEntries = new Map(
		entries
			.filter((entry: any) => isEnglishEntry(entry.id))
			.map((entry: any) => [baseEntryId(entry.id), entry]),
	);

	return baseEntries.map((entry: any) => {
		const baseId = baseEntryId(entry.id);
		const localized = lang === 'en' ? englishEntries.get(baseId) : undefined;

		return {
			entry: localized ?? entry,
			baseId,
			isFallback: lang === 'en' && !localized,
		};
	});
}

export async function getLocalizedEntry(collection: string, slug: string, lang: Lang): Promise<LocalizedEntry | undefined> {
	const entries = await getLocalizedEntries(collection, lang);
	return entries.find((item) => item.baseId === slug);
}

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number) {
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const start = (currentPage - 1) * pageSize;

	return {
		items: items.slice(start, start + pageSize),
		currentPage,
		totalPages,
	};
}

export function numberedPagePaths<T>(items: T[], pageSize: number) {
	const totalPages = Math.ceil(items.length / pageSize);

	return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
		params: { page: String(index + 2) },
		props: { currentPage: index + 2 },
	}));
}
