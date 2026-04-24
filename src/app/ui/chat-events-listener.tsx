import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import type {
	ChatMessageDeltaEvent,
	ChatMessageEvent,
	ChatPhaseEvent,
	ChatSessionEvent,
} from '@/entities/chat/model/types';
import { queryKeys } from '@/shared/config/query-keys';
import { chatStore } from '@/store/chat-store';

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

		// rAF 合批：每帧最多写入一次 chatStore，把每秒数十次 token 事件压缩为 ~60Hz 更新
		const pending = new Map<string, { sessionId: string; delta: string }>();
		let rafId: number | null = null;

		function flush() {
			rafId = null;
			if (!mounted) return;
			const state = chatStore.getState();
			const retry = new Map<string, { sessionId: string; delta: string }>();
			for (const [messageId, { sessionId, delta }] of pending) {
				// 若 message_start 还未落地（liveMessages 中找不到该 id），延迟到下一帧，不能丢字
				const idx = state.liveMessages.findIndex((m) => m.id === messageId);
				if (idx === -1) {
					retry.set(messageId, { sessionId, delta });
				} else {
					state.appendTextChunk(sessionId, messageId, delta);
				}
			}
			pending.clear();
			if (retry.size > 0) {
				for (const [k, v] of retry) pending.set(k, v);
				rafId = requestAnimationFrame(flush);
			}
		}

		// 流式占位消息开始
		listen<ChatMessageEvent>('ai_chat://message_start', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				state.startLiveMessage(event.payload.message);
			}
		}).then((u) => {
			unlistenStartRef.current = u;
		});

		// 流式增量文本 / 工具占位（text delta 走 rAF 合批；tool_start 立即处理）
		listen<ChatMessageDeltaEvent>('ai_chat://message_delta', (event) => {
			if (!mounted) return;
			const state = chatStore.getState();
			if (event.payload.sessionId === state.activeSessionId) {
				if (event.payload.kind === 'text' && event.payload.delta) {
					const { messageId, sessionId, delta } = event.payload;
					const existing = pending.get(messageId);
					pending.set(messageId, { sessionId, delta: (existing?.delta ?? '') + delta });
					if (rafId === null) rafId = requestAnimationFrame(flush);
				} else if (event.payload.kind === 'tool_start' && event.payload.toolName) {
					state.markToolCallPlaceholder(
						event.payload.sessionId,
						event.payload.messageId,
						event.payload.toolName,
					);
				}
			}
		}).then((u) => {
			unlistenDeltaRef.current = u;
		});

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
					// 最终消息已由 ai_chat://message 事件写入 liveMessages，无需再 refetch chatMessages。
					// 下次重开会话时 useChatMessagesQuery 会重新拉取最新数据。
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
			if (rafId !== null) cancelAnimationFrame(rafId);
			pending.clear();
			unlistenStartRef.current?.();
			unlistenDeltaRef.current?.();
			unlistenMsgRef.current?.();
			unlistenPhaseRef.current?.();
			unlistenSessionRef.current?.();
		};
	}, [qc]);

	return null;
}
