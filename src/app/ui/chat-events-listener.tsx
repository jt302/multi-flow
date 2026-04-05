import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

import { chatStore } from '@/store/chat-store';
import { queryKeys } from '@/shared/config/query-keys';
import type {
	ChatMessageEvent,
	ChatPhaseEvent,
	ChatSessionEvent,
} from '@/entities/chat/model/types';

/**
 * 全局监听 ai_chat://message / ai_chat://phase 事件，
 * 确保用户离开聊天页面后事件不丢失。
 */
export function ChatEventsListener() {
	const qc = useQueryClient();
	const unlistenMsgRef = useRef<(() => void) | null>(null);
	const unlistenPhaseRef = useRef<(() => void) | null>(null);
	const unlistenSessionRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		listen<ChatMessageEvent>('ai_chat://message', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				state.appendMessage(event.payload.message);
				qc.invalidateQueries({ queryKey: queryKeys.chatSessions });
			}
		}).then((unlisten) => {
			unlistenMsgRef.current = unlisten;
		});

		listen<ChatPhaseEvent>('ai_chat://phase', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				state.updatePhase(event.payload);
				if (event.payload.phase === 'done' || event.payload.phase === 'error') {
					qc.invalidateQueries({ queryKey: queryKeys.chatMessages(event.payload.sessionId) });
					qc.invalidateQueries({ queryKey: queryKeys.chatSessions });
				}
			}
		}).then((unlisten) => {
			unlistenPhaseRef.current = unlisten;
		});

		listen<ChatSessionEvent>('ai_chat://session_updated', () => {
			if (!mounted) return;
			qc.invalidateQueries({ queryKey: queryKeys.chatSessions });
		}).then((unlisten) => {
			unlistenSessionRef.current = unlisten;
		});

		return () => {
			mounted = false;
			unlistenMsgRef.current?.();
			unlistenPhaseRef.current?.();
			unlistenSessionRef.current?.();
		};
	}, [qc]);

	return null;
}
