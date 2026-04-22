import type { Lang } from './i18n';
import { sortPinnedThenDateDesc } from './content';
import type { LocalizedItem } from './content';

export const musicGroups = {
	classical: {
		label: { zh: '古典', en: 'Classical' },
		section: 'appreciation',
		variant: 'album',
	},
	pop: {
		label: { zh: '流行', en: 'Pop' },
		section: 'appreciation',
		variant: 'album',
	},
	piano: {
		label: { zh: '钢琴练习', en: 'Piano Practice' },
		section: 'practice',
		variant: 'video',
	},
	violin: {
		label: { zh: '小提琴练习', en: 'Violin Practice' },
		section: 'practice',
		variant: 'video',
	},
} as const;

export type MusicGroup = keyof typeof musicGroups;

export const appreciationGroups: MusicGroup[] = ['classical', 'pop'];
export const practiceGroups: MusicGroup[] = ['piano', 'violin'];
export const musicPageSize = 16;

export function getMusicTagHue(tag: string) {
	let hash = 0;

	for (const char of tag) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
	}

	return hash;
}

export function getMusicGroupLabel(group: MusicGroup, lang: Lang = 'zh') {
	return musicGroups[group].label[lang];
}

export function sortMusicByDateDesc(entries: LocalizedItem<'music'>[]) {
	return [...entries].sort((a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf());
}

export function filterMusicGroup(entries: LocalizedItem<'music'>[], group: MusicGroup) {
	return sortPinnedThenDateDesc(entries.filter((entry) => entry.entry.data.group === group));
}
