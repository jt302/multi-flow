import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react(), svgr(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ['**/src-tauri/**'],
		},
	},
	build: {
		target: 'es2022',
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) {
						return;
					}

					if (
						id.includes('/react/') ||
						id.includes('/react-dom/') ||
						id.includes('/scheduler/') ||
						id.includes('/react-router') ||
						id.includes('/react-router-dom') ||
						id.includes('@tanstack/react-query') ||
						id.includes('/zustand/') ||
						id.includes('/react-i18next/')
					) {
						return 'vendor-react';
					}

					if (id.includes('@tauri-apps')) {
						return 'vendor-tauri';
					}

					if (
						id.includes('@radix-ui') ||
						id.includes('/radix-ui/') ||
						id.includes('/cmdk/') ||
						id.includes('/sonner/') ||
						id.includes('/react-resizable-panels/')
					) {
						return 'vendor-ui';
					}

					if (id.includes('/lucide-react/')) {
						return 'vendor-icons';
					}

					if (
						id.includes('/react-markdown/') ||
						id.includes('/remark-') ||
						id.includes('/rehype-') ||
						id.includes('/highlight.js/') ||
						id.includes('/unified/') ||
						id.includes('/vfile/') ||
						id.includes('/micromark') ||
						id.includes('/mdast-util-') ||
						id.includes('/hast-util-') ||
						id.includes('/unist-util-')
					) {
						return 'vendor-markdown';
					}

					if (id.includes('@xyflow')) {
						return 'vendor-flow';
					}

					if (
						id.includes('/zod/') ||
						id.includes('/react-hook-form/') ||
						id.includes('@hookform')
					) {
						return 'vendor-forms';
					}

					if (id.includes('/i18next')) {
						return 'vendor-i18n';
					}
				},
			},
		},
	},
}));
