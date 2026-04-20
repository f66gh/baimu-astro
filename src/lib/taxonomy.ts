import type { Lang } from './i18n';

export const tones = ['teal', 'coral', 'violet', 'gold', 'leaf'] as const;
export type Tone = (typeof tones)[number];

export const academicTags: Record<string, { label: Record<Lang, string>; tone: Tone }> = {
	'paper-reading': {
		label: { zh: '论文阅读', en: 'Paper Reading' },
		tone: 'teal',
	},
	'group-task': {
		label: { zh: '组内任务', en: 'Group Task' },
		tone: 'coral',
	},
	'idea-summary': {
		label: { zh: '想法总结', en: 'Ideas & Summary' },
		tone: 'violet',
	},
};

export function hashTone(value: string): Tone {
	let hash = 0;

	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}

	return tones[hash % tones.length];
}

export function getTagMeta(tag: string, collection: 'academic' | 'notes' | 'anime', lang: Lang) {
	if (collection === 'academic') {
		const meta = academicTags[tag];

		if (meta) {
			return {
				label: meta.label[lang],
				tone: meta.tone,
			};
		}
	}

	return {
		label: tag,
		tone: hashTone(tag),
	};
}
