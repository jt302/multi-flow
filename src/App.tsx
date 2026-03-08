import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ConsolePage } from '@/features/console';
import { LogPanelPage } from '@/features/logs';

function RootRedirect() {
	const { search } = useLocation();
	const standalone = new URLSearchParams(search).get('standalone');
	if (standalone === 'logs') {
		return <Navigate to="/logs?standalone=1" replace />;
	}
	return <Navigate to="/dashboard" replace />;
}

function App() {
	return (
		<Routes>
			<Route path="/" element={<RootRedirect />} />
			<Route path="/logs" element={<LogPanelPage />} />
			<Route path="/*" element={<ConsolePage />} />
		</Routes>
	);
}

export default App;
