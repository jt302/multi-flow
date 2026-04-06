import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/global.css';
import '@/shared/i18n';
import { QueryProvider } from '@/app/providers/query-provider';
import { installInputSelectAllHotkey } from '@/shared/lib/hotkeys/install-input-select-all-hotkey';
import { installWindowHotkeys } from '@/shared/lib/hotkeys/install-window-hotkeys';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

installInputSelectAllHotkey();
installWindowHotkeys();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<QueryProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</QueryProvider>
	</React.StrictMode>,
);

// React 渲染完成后，等 init 信号再切换窗口：
// - 若 init 已完成（React 比 init 慢）：直接切换
// - 若 init 未完成（React 比 init 快）：等待事件再切换
// show_main_window 原子完成"关 splash + 显主窗口"，消除空档
(async () => {
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
})();
