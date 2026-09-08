import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';
import { getLatestGitCommitDate } from './git';

export type ContentCollectionKey = 'academic' | 'notes' | 'logbook' | 'anime' | 'music';
export type ContentEntry<C extends ContentCollectionKey = ContentCollectionKey> = CollectionEntry<C>;

export interface LocalizedItem<C extends ContentCollectionKey = ContentCollectionKey> {
	entry: ContentEntry<C>;
	baseId: string;
	lang: Lang;
	isFallback: boolean;
	updatedDate?: Date;
}

type DatedEntry = { data: { date: Date; pinned?: boolean } };
type DatedItem = DatedEntry | { entry: DatedEntry; updatedDate?: Date };

export const cardPageSize = 12;
export const listPageSize = 12;

export function baseEntryId(id: string): string {
	return id.endsWith('.en') ? id.slice(0, -3) : id;
}

export function resolveImagePath(imagePath?: string, imageRoot?: string): string | undefined {
	if (!imagePath) return undefined;

	const trimmedPath = imagePath.trim();
	if (
		trimmedPath.startsWith('/') ||
		trimmedPath.startsWith('./') ||
		trimmedPath.startsWith('../') ||
		trimmedPath.startsWith('#') ||
		trimmedPath.startsWith('//') ||
		/^[a-z][a-z\d+.-]*:/i.test(trimmedPath)
	) {
		return trimmedPath;
	}

	if (!imageRoot?.trim()) {
		return trimmedPath;
	}

	return `${imageRoot.trim().replace(/\/+$/, '')}/${trimmedPath.replace(/^\/+/, '')}`;
}

export function isEnglishEntry(id: string): boolean {
	return id.endsWith('.en');
}

function getDateValue(item: DatedItem): number {
	const date = 'entry' in item ? item.updatedDate ?? item.entry.data.date : item.data.date;
	return date.valueOf();
}

function getPinnedValue(item: DatedItem): number {
	const pinned = 'entry' in item ? item.entry.data.pinned : item.data.pinned;
	return pinned ? 1 : 0;
}

function makeLocalizedItem<C extends ContentCollectionKey>(entry: ContentEntry<C>, lang: Lang, isFallback: boolean): LocalizedItem<C> {
	const tracksUpdates = entry.collection === 'academic' || entry.collection === 'notes';
	return {
		entry,
		baseId: baseEntryId(entry.id),
		lang,
		isFallback,
		updatedDate: tracksUpdates
			? (entry.filePath ? getLatestGitCommitDate(entry.filePath) : undefined) ?? entry.data.date
			: undefined,
	};
}

export function sortByDateDesc<T extends DatedItem>(items: T[]): T[] {
	return [...items].sort((a, b) => getDateValue(b) - getDateValue(a));
}

export function sortPinnedThenDateDesc<T extends DatedItem>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const pinnedDiff = getPinnedValue(b) - getPinnedValue(a);
		if (pinnedDiff !== 0) return pinnedDiff;
		return getDateValue(b) - getDateValue(a);
	});
}

export async function getBaseEntries<C extends ContentCollectionKey>(collection: C): Promise<LocalizedItem<C>[]> {
	const entries = await getCollection(collection);
	const baseEntries = sortPinnedThenDateDesc(entries.filter((entry) => !isEnglishEntry(entry.id)));

	return sortPinnedThenDateDesc(baseEntries.map((entry) => makeLocalizedItem(entry, 'zh', false)));
}

export async function getLocalizedEntries<C extends ContentCollectionKey>(collection: C, lang: Lang): Promise<LocalizedItem<C>[]> {
	const entries = await getCollection(collection);
	const baseEntries = sortPinnedThenDateDesc(entries.filter((entry) => !isEnglishEntry(entry.id)));
	const englishEntries = new Map(
		entries.filter((entry) => isEnglishEntry(entry.id)).map((entry) => [baseEntryId(entry.id), entry]),
	);

	const items = baseEntries.map((entry) => {
		const localized = lang === 'en' ? englishEntries.get(baseEntryId(entry.id)) : undefined;
		return makeLocalizedItem(localized ?? entry, lang, lang === 'en' && !localized);
	});
	return collection === 'academic' || collection === 'notes' ? sortPinnedThenDateDesc(items) : items;
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
