// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkImageRoot from './src/lib/remark-image-root.mjs';

// https://astro.build/config
export default defineConfig({
	integrations: [icon(), mdx()],
	markdown: {
		remarkPlugins: [remarkImageRoot, remarkMath],
		rehypePlugins: [rehypeKatex],
	},
});
