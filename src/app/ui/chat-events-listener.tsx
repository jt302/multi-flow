import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

import { chatStore } from '@/store/chat-store';
import { queryKeys } from '@/shared/config/query-keys';
import type {
	ChatMessageDeltaEvent,
	ChatMessageEvent,
	ChatPhaseEvent,
	ChatSessionEvent,
} from '@/entities/chat/model/types';

/**
 * 全局监听 ai_chat:// 系列事件，确保用户离开聊天页面后事件不丢失。
 */
export function ChatEventsListener() {
	const qc = useQueryClient();
	const unlistenMsgRef = useRef<(() => void) | null>(null);
	const unlistenPhaseRef = useRef<(() => void) | null>(null);
	const unlistenSessionRef = useRef<(() => void) | null>(null);
	const unlistenStartRef = useRef<(() => void) | null>(null);
	const unlistenDeltaRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		// 流式占位消息开始
		listen<ChatMessageEvent>('ai_chat://message_start', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				state.startLiveMessage(event.payload.message);
			}
		}).then((u) => { unlistenStartRef.current = u; });

		// 流式增量文本 / 工具占位
		listen<ChatMessageDeltaEvent>('ai_chat://message_delta', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				if (event.payload.kind === 'text' && event.payload.delta) {
					state.appendTextChunk(event.payload.sessionId, event.payload.messageId, event.payload.delta);
				} else if (event.payload.kind === 'tool_start' && event.payload.toolName) {
					state.markToolCallPlaceholder(event.payload.sessionId, event.payload.messageId, event.payload.toolName);
				}
			}
		}).then((u) => { unlistenDeltaRef.current = u; });

		// 完整消息（用户消息、工具结果、流式完成后的最终版本）
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
			unlistenStartRef.current?.();
			unlistenDeltaRef.current?.();
			unlistenMsgRef.current?.();
			unlistenPhaseRef.current?.();
			unlistenSessionRef.current?.();
		};
	}, [qc]);

	return null;
}
