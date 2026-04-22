import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const baseFields = {
	title: z.string(),
	summary: z.string(),
	date: z.coerce.date(),
	tags: z.array(z.string()).default([]),
	cover: z.string().optional(),
	pinned: z.boolean().default(false),
	externalUrl: z.string().url().optional(),
	externalLabel: z.string().optional(),
};

const anime = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/anime' }),
	schema: z.object({
		...baseFields,
		rating: z.number().int().min(0).max(5).optional(),
		rewatchCount: z.number().int().min(1).default(1),
		format: z.string().optional(),
		originalType: z.string().optional(),
		moods: z.array(z.string()).default([]),
		episodes: z.number().int().positive().optional(),
		bangumi: z.string().url().optional(),
		tieba: z.string().url().optional(),
	}),
});

const notes = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
	schema: z.object({
		...baseFields,
	}),
});

const music = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/music' }),
	schema: z.object({
		...baseFields,
		section: z.enum(['appreciation', 'practice']),
		group: z.enum(['classical', 'pop', 'piano', 'violin']),
		formats: z.array(z.string()).default([]),
		materials: z.array(z.string()).default([]),
		url: z.string().url(),
	}),
});

const academic = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/academic' }),
	schema: z.object({
		...baseFields,
	}),
});

export const collections = { anime, notes, music, academic };
