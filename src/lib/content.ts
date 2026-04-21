import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';

export type ContentCollectionKey = 'academic' | 'notes' | 'anime' | 'music';
export type ContentEntry<C extends ContentCollectionKey = ContentCollectionKey> = CollectionEntry<C>;

export interface LocalizedItem<C extends ContentCollectionKey = ContentCollectionKey> {
	entry: ContentEntry<C>;
	baseId: string;
	lang: Lang;
	isFallback: boolean;
}

type DatedEntry = { data: { date: Date } };
type DatedItem = DatedEntry | { entry: DatedEntry };

export const cardPageSize = 6;
export const listPageSize = 12;

export function baseEntryId(id: string): string {
	return id.endsWith('.en') ? id.slice(0, -3) : id;
}

export function isEnglishEntry(id: string): boolean {
	return id.endsWith('.en');
}

function getDateValue(item: DatedItem): number {
	const date = 'entry' in item ? item.entry.data.date : item.data.date;
	return date.valueOf();
}

function makeLocalizedItem<C extends ContentCollectionKey>(entry: ContentEntry<C>, lang: Lang, isFallback: boolean): LocalizedItem<C> {
	return {
		entry,
		baseId: baseEntryId(entry.id),
		lang,
		isFallback,
	};
}

export function sortByDateDesc<T extends DatedItem>(items: T[]): T[] {
	return [...items].sort((a, b) => getDateValue(b) - getDateValue(a));
}

export async function getBaseEntries<C extends ContentCollectionKey>(collection: C): Promise<LocalizedItem<C>[]> {
	const entries = await getCollection(collection);
	const baseEntries = sortByDateDesc(entries.filter((entry) => !isEnglishEntry(entry.id)));

	return baseEntries.map((entry) => makeLocalizedItem(entry, 'zh', false));
}

export async function getLocalizedEntries<C extends ContentCollectionKey>(collection: C, lang: Lang): Promise<LocalizedItem<C>[]> {
	const entries = await getCollection(collection);
	const baseEntries = sortByDateDesc(entries.filter((entry) => !isEnglishEntry(entry.id)));
	const englishEntries = new Map(
		entries.filter((entry) => isEnglishEntry(entry.id)).map((entry) => [baseEntryId(entry.id), entry]),
	);

	return baseEntries.map((entry) => {
		const localized = lang === 'en' ? englishEntries.get(baseEntryId(entry.id)) : undefined;
		return makeLocalizedItem(localized ?? entry, lang, lang === 'en' && !localized);
	});
}

export async function getLocalizedEntry<C extends ContentCollectionKey>(
	collection: C,
	slug: string,
	lang: Lang,
): Promise<LocalizedItem<C> | undefined> {
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
