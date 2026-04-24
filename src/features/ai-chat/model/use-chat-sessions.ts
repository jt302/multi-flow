import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
	createChatSession,
	deleteChatSession,
	listChatSessions,
	updateChatSession,
} from '@/entities/chat/api/chat-api';
import type {
	CreateChatSessionRequest,
	UpdateChatSessionRequest,
} from '@/entities/chat/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useChatSessionsQuery() {
	return useQuery({ queryKey: queryKeys.chatSessions, queryFn: listChatSessions });
}

export function useCreateChatSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateChatSessionRequest) => createChatSession(payload),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
	});
}

export function useUpdateChatSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			sessionId,
			payload,
		}: {
			sessionId: string;
			payload: UpdateChatSessionRequest;
		}) => updateChatSession(sessionId, payload),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
	});
}

export function useDeleteChatSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (sessionId: string) => deleteChatSession(sessionId),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
	});
}
