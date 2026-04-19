import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const baseFields = {
	title: z.string(),
	summary: z.string(),
	date: z.coerce.date(),
	tags: z.array(z.string()).default([]),
	cover: z.string().url().optional(),
};

const anime = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/anime' }),
	schema: z.object({
		...baseFields,
		year: z.number().int(),
		status: z.enum(['watching', 'finished', 'paused', 'planned']),
		rating: z.number().min(0).max(10).optional(),
		episodes: z.number().int().positive().optional(),
	}),
});

const notes = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
	schema: z.object({
		...baseFields,
		category: z.string(),
	}),
});

const videos = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/videos' }),
	schema: z.object({
		...baseFields,
		platform: z.enum(['bilibili', 'youtube', 'other']),
		url: z.string().url(),
	}),
});

const academic = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/academic' }),
	schema: z.object({
		...baseFields,
		stage: z.enum(['idea', 'reading', 'experiment', 'writing', 'published']),
	}),
});

export const collections = { anime, notes, videos, academic };
