import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@/styles/global.css';
import { QueryProvider } from '@/app/providers/query-provider';
import { installInputSelectAllHotkey } from '@/shared/lib/hotkeys/install-input-select-all-hotkey';
import { installWindowHotkeys } from '@/shared/lib/hotkeys/install-window-hotkeys';

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
