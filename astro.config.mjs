// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkImageRoot from './src/lib/remark-image-root.mjs';

// https://astro.build/config
export default defineConfig({
	integrations: [icon()],
	markdown: {
		remarkPlugins: [remarkImageRoot, remarkMath],
		rehypePlugins: [rehypeKatex],
	},
});
