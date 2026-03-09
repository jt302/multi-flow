import { Navigate, useLocation } from 'react-router-dom';

export function RootRedirectPage() {
	const { search } = useLocation();
	const standalone = new URLSearchParams(search).get('standalone');
	if (standalone === 'logs') {
		return <Navigate to="/logs?standalone=1" replace />;
	}
	return <Navigate to="/dashboard" replace />;
}
