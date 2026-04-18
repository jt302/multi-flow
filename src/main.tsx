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
import { getCurrentWindow } from '@tauri-apps/api/window';

// 诊断探针：带时间戳的轻量 logger（仅 dev 阶段使用）
const diag = (event: string, data?: Record<string, unknown>) =>
	console.log(`[diag:startup] t=${performance.now().toFixed(1)} ${event}`, data ?? '');

diag('module-evaluated', { readyState: document.readyState, visibility: document.visibilityState });

// 捕获 document 层 mousedown（capture=true 最先触发），判定假设 A：
// 若首次点击 sidebar 连此日志都没打，说明 Cocoa 在激活窗口时吞了 mousedown
document.addEventListener('mousedown', (e) => {
	const target = e.composedPath()[0] as HTMLElement | undefined;
	diag('document-mousedown-capture', {
		tagName: (e.target as HTMLElement).tagName,
		className: target?.className?.toString?.()?.slice(0, 60) ?? '',
		x: e.clientX,
		y: e.clientY,
	});
}, { capture: true });

document.addEventListener('visibilitychange', () => {
	diag('visibility-change', { state: document.visibilityState });
});
window.addEventListener('focus', () => diag('window-focus'));
window.addEventListener('blur', () => diag('window-blur'));

// 监听 Tauri 窗口焦点变化
getCurrentWindow().onFocusChanged(({ payload: focused }) => {
	diag('tauri-focus-changed', { focused });
}).catch(() => {/* 非 Tauri 环境忽略 */});

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
	diag('lang-sync-start');
	try {
		const saved = await invoke<string | null>('read_app_language');
		if (saved) {
			await i18n.changeLanguage(normalizeAppLanguage(saved));
			diag('lang-sync-end', { lang: i18n.resolvedLanguage });
			return;
		}

		const locale = await invoke<string>('update_app_language', {
			locale: normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language),
		});
		await i18n.changeLanguage(normalizeAppLanguage(locale));
		diag('lang-sync-end', { lang: i18n.resolvedLanguage });
	} catch (e) {
		diag('lang-sync-fail', { error: String(e) });
		// 非 Tauri 环境（浏览器预览等）忽略
	}
}

async function waitAndShowMainWindow() {
	diag('wait-show-enter');
	try {
		// 用轮询代替 event listen：Tauri 对 visible=false 的 hidden window 投递 event 不可靠，
		// is_init_complete 是普通 invoke（request-response），不受影响
		for (let attempt = 0; attempt < 100; attempt++) {
			const done = await invoke<boolean>('is_init_complete');
			if (done) {
				diag('is-init-complete-result', { done: true, attempt });
				diag('invoke-show-start', { path: 'poll' });
				await invoke('show_main_window');
				diag('invoke-show-end', { path: 'poll' });
				return;
			}
			if (attempt === 0) diag('is-init-complete-result', { done: false, attempt });
			await new Promise<void>((r) => setTimeout(r, 100));
		}
	} catch (e) {
		diag('wait-show-fail', { error: String(e) });
		// 非 Tauri 环境（浏览器预览等）忽略
	}
}

(async () => {
	await syncInitialAppLanguage();
	diag('render-start');
	renderApp();
	diag('render-called');
	// 预热 dashboard chunk（首屏必然跳转到 /dashboard，并行加载避免首次点击触发 Suspense fallback）
	void import('@/pages/dashboard');
	diag('wait-show-schedule');
	await waitAndShowMainWindow();
})();
