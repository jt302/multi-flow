import { listen } from '@tauri-apps/api/event';

import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	ChatMessageDeltaEvent,
	ChatMessageEvent,
	ChatMessageRecord,
	ChatPhaseEvent,
	ChatSession,
	CreateChatSessionRequest,
	ProfileEnvironmentContext,
	UpdateChatSessionRequest,
} from '../model/types';

export const listChatSessions = () =>
	tauriInvoke<ChatSession[]>('list_chat_sessions');

export const createChatSession = (payload: CreateChatSessionRequest) =>
	tauriInvoke<ChatSession>('create_chat_session', { payload });

export const updateChatSession = (sessionId: string, payload: UpdateChatSessionRequest) =>
	tauriInvoke<ChatSession>('update_chat_session', { sessionId, payload });

export const deleteChatSession = (sessionId: string) =>
	tauriInvoke<void>('delete_chat_session', { sessionId });

export const listChatMessages = (sessionId: string) =>
	tauriInvoke<ChatMessageRecord[]>('list_chat_messages', { sessionId });

export const sendChatMessage = (sessionId: string, text: string, imageBase64?: string | null) =>
	tauriInvoke<void>('send_chat_message', { sessionId, text, imageBase64: imageBase64 ?? null });

export const stopChatGeneration = (sessionId: string) =>
	tauriInvoke<void>('stop_chat_generation', { sessionId });

export const regenerateChatMessage = (sessionId: string) =>
	tauriInvoke<void>('regenerate_chat_message', { sessionId });

export const readAiChatGlobalPrompt = () =>
	tauriInvoke<string | null>('read_ai_chat_global_prompt');

export const updateAiChatGlobalPrompt = (prompt: string | null) =>
	tauriInvoke<void>('update_ai_chat_global_prompt', { prompt });

export const listenChatMessage = (handler: (e: ChatMessageEvent) => void) =>
	listen<ChatMessageEvent>('ai_chat://message', (e) => handler(e.payload));

export const listenChatPhase = (handler: (e: ChatPhaseEvent) => void) =>
	listen<ChatPhaseEvent>('ai_chat://phase', (e) => handler(e.payload));

export const listenChatMessageStart = (handler: (e: ChatMessageEvent) => void) =>
	listen<ChatMessageEvent>('ai_chat://message_start', (e) => handler(e.payload));

export const listenChatMessageDelta = (handler: (e: ChatMessageDeltaEvent) => void) =>
	listen<ChatMessageDeltaEvent>('ai_chat://message_delta', (e) => handler(e.payload));

export const getProfileEnvironmentContext = (
	profileIds: string[],
	activeProfileId: string | null,
) =>
	tauriInvoke<ProfileEnvironmentContext[]>('get_profile_environment_context', {
		profileIds,
		activeProfileId,
	});
