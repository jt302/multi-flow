import { Route, Routes } from 'react-router-dom';

import { ConsolePage } from '@/pages/console';
import { LogPanelPage } from '@/pages/log-panel';
import { RootRedirectPage } from '@/pages/root-redirect';

export function AppRouter() {
	return (
		<Routes>
			<Route path="/" element={<RootRedirectPage />} />
			<Route path="/logs" element={<LogPanelPage />} />
			<Route path="/*" element={<ConsolePage />} />
		</Routes>
	);
}
