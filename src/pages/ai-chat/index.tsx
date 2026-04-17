import { Navigate } from 'react-router-dom';

import { AI_CHAT_DEFAULT_PATH } from '@/app/workspace-routes';

export function AiChatRoutePage() {
	return <Navigate to={AI_CHAT_DEFAULT_PATH} replace />;
}
