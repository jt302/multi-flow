import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/global.css';
import { invoke } from '@tauri-apps/api/core';
import { QueryProvider } from '@/app/providers/query-provider';
import i18n, { normalizeAppLanguage } from '@/shared/i18n';
import { installInputSelectAllHotkey } from '@/shared/lib/hotkeys/install-input-select-all-hotkey';
import { installWindowHotkeys } from '@/shared/lib/hotkeys/install-window-hotkeys';

installInputSelectAllHotkey();
installWindowHotkeys();

function renderApp() {
	ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
		<React.StrictMode>
			<QueryProvider>
				<BrowserRouter unstable_useTransitions={false}>
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
		// 用轮询代替 event listen：Tauri 对 visible=false 的 hidden window 投递 event 不可靠，
		// is_init_complete 是普通 invoke（request-response），不受影响
		for (let attempt = 0; attempt < 100; attempt++) {
			const done = await invoke<boolean>('is_init_complete');
			if (done) {
				await invoke('show_main_window');
				return;
			}
			await new Promise<void>((r) => setTimeout(r, 100));
		}
	} catch {
		// 非 Tauri 环境（浏览器预览等）忽略
	}
}

(async () => {
	await syncInitialAppLanguage();
	renderApp();
	// 预热 dashboard chunk（首屏必然跳转到 /dashboard，并行加载避免首次点击触发 Suspense fallback）
	void import('@/pages/dashboard');
	await waitAndShowMainWindow();
})();
