import { Route, Routes } from 'react-router-dom';

import { ConsoleRootPage } from '@/pages/console';
import { LogPanelPage } from '@/pages/log-panel';
import { RpaFlowEditorRootPage } from '@/pages/rpa-flow-editor';
import { RootRedirectPage } from '@/pages/root-redirect';

export function AppRouter() {
	return (
		<Routes>
			<Route path="/" element={<RootRedirectPage />} />
			<Route path="/logs" element={<LogPanelPage />} />
			<Route path="/rpa-editor" element={<RpaFlowEditorRootPage />} />
			<Route path="/*" element={<ConsoleRootPage />} />
		</Routes>
	);
}
