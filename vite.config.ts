import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const host = process.env.TAURI_DEV_HOST;

function getNodeModulePackageName(id: string) {
	const parts = id.split('node_modules/');
	const packagePath = parts[parts.length - 1];
	if (!packagePath) {
		return null;
	}

	const segments = packagePath.split('/');
	if (segments[0]?.startsWith('@')) {
		return `${segments[0]}/${segments[1] ?? ''}`;
	}

	return segments[0] ?? null;
}

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react(), svgr(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
		dedupe: ['react', 'react-dom'],
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

					const packageName = getNodeModulePackageName(id);
					if (!packageName) {
						return;
					}

					if (
						packageName === 'react' ||
						packageName === 'react-dom' ||
						packageName === 'scheduler' ||
						packageName === 'use-sync-external-store'
					) {
						return 'vendor-react-core';
					}

					if (
						packageName === 'react-router' ||
						packageName === 'react-router-dom' ||
						packageName === '@tanstack/react-query' ||
						packageName === 'zustand' ||
						packageName === 'react-i18next'
					) {
						return 'vendor-react';
					}

					if (packageName.startsWith('@tauri-apps/')) {
						return 'vendor-tauri';
					}

					if (
						packageName.startsWith('@radix-ui/') ||
						packageName === 'radix-ui' ||
						packageName === 'cmdk' ||
						packageName === 'sonner' ||
						packageName === 'react-resizable-panels'
					) {
						return 'vendor-ui';
					}

					if (packageName === 'lucide-react') {
						return 'vendor-icons';
					}

					if (
						packageName === 'react-markdown' ||
						packageName.startsWith('remark-') ||
						packageName.startsWith('rehype-') ||
						packageName === 'highlight.js' ||
						packageName === 'unified' ||
						packageName === 'vfile' ||
						packageName.startsWith('micromark') ||
						packageName.startsWith('mdast-util-') ||
						packageName.startsWith('hast-util-') ||
						packageName.startsWith('unist-util-')
					) {
						return 'vendor-markdown';
					}

					if (packageName === '@xyflow/react' || packageName.startsWith('@xyflow/')) {
						return 'vendor-flow';
					}

					if (
						packageName === 'zod' ||
						packageName === 'react-hook-form' ||
						packageName.startsWith('@hookform/')
					) {
						return 'vendor-forms';
					}

					if (packageName === 'i18next' || packageName.startsWith('i18next-')) {
						return 'vendor-i18n';
					}
				},
			},
		},
	},
}));
