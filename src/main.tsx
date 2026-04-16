import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/global.css';
import i18n, { normalizeAppLanguage } from '@/shared/i18n';
import { QueryProvider } from '@/app/providers/query-provider';
import { installInputSelectAllHotkey } from '@/shared/lib/hotkeys/install-input-select-all-hotkey';
import { installWindowHotkeys } from '@/shared/lib/hotkeys/install-window-hotkeys';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

installInputSelectAllHotkey();
installWindowHotkeys();

function renderApp() {
	ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
		<React.StrictMode>
			<QueryProvider>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</QueryProvider>
		</React.StrictMode>,
	);
}

async function syncInitialAppLanguage() {
	try {
		const saved = await invoke<string | null>('read_app_language');
		if (saved) {
			await i18n.changeLanguage(normalizeAppLanguage(saved));
			return;
		}

		const locale = await invoke<string>('update_app_language', {
			locale: normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language),
		});
		await i18n.changeLanguage(normalizeAppLanguage(locale));
	} catch {
		// 非 Tauri 环境（浏览器预览等）忽略
	}
}

async function waitAndShowMainWindow() {
	try {
		const done = await invoke<boolean>('is_init_complete');
		if (done) {
			await invoke('show_main_window');
		} else {
			const unlisten = await listen('splashscreen://init-complete', async () => {
				unlisten();
				await invoke('show_main_window');
			});
		}
	} catch {
		// 非 Tauri 环境（浏览器预览等）忽略
	}
}

(async () => {
	await syncInitialAppLanguage();
	renderApp();
	await waitAndShowMainWindow();
})();
