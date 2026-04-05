import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listChatMessages } from '@/entities/chat/api/chat-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useChatMessagesQuery(sessionId: string | null) {
	return useQuery({
		queryKey: queryKeys.chatMessages(sessionId ?? ''),
		queryFn: () => listChatMessages(sessionId!),
		enabled: !!sessionId,
	});
}

export function useInvalidateChatMessages() {
	const qc = useQueryClient();
	return (sessionId: string) =>
		qc.invalidateQueries({ queryKey: queryKeys.chatMessages(sessionId) });
}
