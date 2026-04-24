import { useStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import type { ChatMessageRecord, ChatPhaseEvent } from '@/entities/chat/model/types';

type GenerationPhase = 'idle' | 'thinking' | 'tool_calling' | 'done';

export type TerminalState = 'success' | 'error' | 'stalled' | 'max_rounds' | null;

type ChatStoreState = {
	activeSessionId: string | null;
	isGenerating: boolean;
	generationPhase: GenerationPhase;
	currentToolName: string | null;
	currentRound: number;
	maxRounds: number;
	elapsedMs: number;
	promptTokens: number;
	completionTokens: number;
	contextUsed: number;
	contextLimit: number;
	generationStartTime: number | null;
	liveMessages: ChatMessageRecord[];
	terminalState: TerminalState;
	terminalError: string | null;
};

type ChatStoreActions = {
	setActiveSession: (id: string | null) => void;
	startGeneration: () => void;
	finishGeneration: () => void;
	appendMessage: (msg: ChatMessageRecord) => void;
	startLiveMessage: (msg: ChatMessageRecord) => void;
	appendTextChunk: (sessionId: string, messageId: string, delta: string) => void;
	markToolCallPlaceholder: (sessionId: string, messageId: string, name: string) => void;
	updatePhase: (event: ChatPhaseEvent) => void;
	reset: () => void;
};

const INITIAL_STATE: ChatStoreState = {
	activeSessionId: null,
	isGenerating: false,
	generationPhase: 'idle',
	currentToolName: null,
	currentRound: 0,
	maxRounds: 0,
	elapsedMs: 0,
	promptTokens: 0,
	completionTokens: 0,
	contextUsed: 0,
	contextLimit: 0,
	generationStartTime: null,
	liveMessages: [],
	terminalState: null,
	terminalError: null,
};

function upsertLiveMessage(
	liveMessages: ChatMessageRecord[],
	message: ChatMessageRecord,
): ChatMessageRecord[] {
	const index = liveMessages.findIndex((item) => item.id === message.id);
	if (index === -1) {
		return [...liveMessages, message];
	}

	const next = liveMessages.slice();
	next[index] = message;
	return next;
}

export function createChatStore(initial?: Partial<ChatStoreState>) {
	return createStore<ChatStoreState & ChatStoreActions>((set) => ({
		...INITIAL_STATE,
		...initial,

		setActiveSession: (id) =>
			set({
				activeSessionId: id,
				liveMessages: [],
				isGenerating: false,
				generationPhase: 'idle',
				terminalState: null,
				terminalError: null,
			}),

		startGeneration: () =>
			set({
				isGenerating: true,
				generationPhase: 'thinking',
				generationStartTime: Date.now(),
				currentRound: 0,
				promptTokens: 0,
				completionTokens: 0,
				elapsedMs: 0,
				terminalState: null,
				terminalError: null,
			}),

		finishGeneration: () =>
			set((s) => ({
				isGenerating: false,
				generationPhase: 'idle',
				currentToolName: null,
				generationStartTime: null,
				liveMessages: s.liveMessages.map((m) =>
					m.status === 'streaming'
						? { ...m, status: 'complete' as const, streamingToolNames: undefined }
						: m,
				),
			})),

		appendMessage: (msg) =>
			set((s) => ({
				liveMessages: upsertLiveMessage(s.liveMessages, {
					...msg,
					status: 'complete' as const,
					streamingToolNames: undefined,
				}),
			})),

		startLiveMessage: (msg) =>
			set((s) => {
				const cleared = s.liveMessages.map((m) =>
					m.status === 'streaming'
						? { ...m, status: 'complete' as const, streamingToolNames: undefined }
						: m,
				);
				return {
					liveMessages: upsertLiveMessage(cleared, {
						...msg,
						status: 'streaming' as const,
						contentText: '',
					}),
				};
			}),

		appendTextChunk: (_sessionId, messageId, delta) =>
			set((s) => {
				const idx = s.liveMessages.findIndex((m) => m.id === messageId);
				if (idx === -1) return {};
				const next = s.liveMessages.slice();
				next[idx] = { ...next[idx], contentText: (next[idx].contentText ?? '') + delta };
				return { liveMessages: next };
			}),

		markToolCallPlaceholder: (_sessionId, messageId, name) =>
			set((s) => {
				const idx = s.liveMessages.findIndex((m) => m.id === messageId);
				if (idx === -1) return {};
				const next = s.liveMessages.slice();
				next[idx] = {
					...next[idx],
					streamingToolNames: [...(next[idx].streamingToolNames ?? []), name],
				};
				return { liveMessages: next };
			}),

		updatePhase: (event) =>
			set((s) => {
				const shared = {
					currentRound: event.round ?? 0,
					maxRounds: event.maxRounds ?? 0,
					elapsedMs: event.elapsedMs ?? 0,
					promptTokens: event.promptTokens ?? 0,
					completionTokens: event.completionTokens ?? 0,
					contextUsed: event.contextUsed ?? s.contextUsed,
					contextLimit: event.contextLimit ?? s.contextLimit,
				};
				const cleanedMessages = s.liveMessages.map((m) =>
					m.status === 'streaming'
						? { ...m, status: 'complete' as const, streamingToolNames: undefined }
						: m,
				);
				if (event.phase === 'done') {
					return {
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'success' as const,
						terminalError: null,
						...shared,
					};
				} else if (event.phase === 'error') {
					return {
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'error' as const,
						terminalError: event.error ?? null,
						...shared,
					};
				} else if (event.phase === 'stalled') {
					return {
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'stalled' as const,
						terminalError: null,
						...shared,
					};
				} else if (event.phase === 'max_rounds_reached') {
					return {
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'max_rounds' as const,
						terminalError: null,
						...shared,
					};
				} else if (event.phase === 'thinking') {
					return { generationPhase: 'thinking', currentToolName: null, ...shared };
				} else if (event.phase === 'tool_calling') {
					return {
						generationPhase: 'tool_calling',
						currentToolName: event.toolName ?? null,
						...shared,
					};
				}
				return shared;
			}),

		reset: () => set(INITIAL_STATE),
	}));
}

export const chatStore = createStore<ChatStoreState & ChatStoreActions>()(
	persist(
		(set, get) => ({
			...INITIAL_STATE,

			setActiveSession: (id) =>
				set({
					activeSessionId: id,
					liveMessages: [],
					isGenerating: false,
					generationPhase: 'idle',
					terminalState: null,
					terminalError: null,
				}),

			startGeneration: () =>
				set({
					isGenerating: true,
					generationPhase: 'thinking',
					generationStartTime: Date.now(),
					currentRound: 0,
					promptTokens: 0,
					completionTokens: 0,
					elapsedMs: 0,
					terminalState: null,
					terminalError: null,
				}),

			finishGeneration: () =>
				set((s) => ({
					isGenerating: false,
					generationPhase: 'idle',
					currentToolName: null,
					generationStartTime: null,
					liveMessages: s.liveMessages.map((m) =>
						m.status === 'streaming'
							? { ...m, status: 'complete' as const, streamingToolNames: undefined }
							: m,
					),
				})),

			appendMessage: (msg) =>
				set((s) => ({
					liveMessages: upsertLiveMessage(s.liveMessages, {
						...msg,
						status: 'complete' as const,
						streamingToolNames: undefined,
					}),
				})),

			startLiveMessage: (msg) =>
				set((s) => {
					const cleared = s.liveMessages.map((m) =>
						m.status === 'streaming'
							? { ...m, status: 'complete' as const, streamingToolNames: undefined }
							: m,
					);
					return {
						liveMessages: upsertLiveMessage(cleared, {
							...msg,
							status: 'streaming' as const,
							contentText: '',
						}),
					};
				}),

			appendTextChunk: (_sessionId: string, messageId: string, delta: string) =>
				set((s) => {
					const idx = s.liveMessages.findIndex((m) => m.id === messageId);
					if (idx === -1) return {};
					const next = s.liveMessages.slice();
					next[idx] = { ...next[idx], contentText: (next[idx].contentText ?? '') + delta };
					return { liveMessages: next };
				}),

			markToolCallPlaceholder: (_sessionId: string, messageId: string, name: string) =>
				set((s) => {
					const idx = s.liveMessages.findIndex((m) => m.id === messageId);
					if (idx === -1) return {};
					const next = s.liveMessages.slice();
					next[idx] = {
						...next[idx],
						streamingToolNames: [...(next[idx].streamingToolNames ?? []), name],
					};
					return { liveMessages: next };
				}),

			updatePhase: (event) => {
				const shared = {
					currentRound: event.round ?? 0,
					maxRounds: event.maxRounds ?? 30,
					elapsedMs: event.elapsedMs ?? 0,
					promptTokens: event.promptTokens ?? 0,
					completionTokens: event.completionTokens ?? 0,
					// 保留上一次已知的 context 值，避免未携带该字段的事件把它清零
					contextUsed: event.contextUsed ?? get().contextUsed,
					contextLimit: event.contextLimit ?? get().contextLimit,
				};
				const cleanedMessages = get().liveMessages.map((m) =>
					m.status === 'streaming'
						? { ...m, status: 'complete' as const, streamingToolNames: undefined }
						: m,
				);
				if (event.phase === 'done') {
					set({
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'success',
						terminalError: null,
						...shared,
					});
				} else if (event.phase === 'error') {
					set({
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'error',
						terminalError: event.error ?? null,
						...shared,
					});
				} else if (event.phase === 'stalled') {
					set({
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'stalled',
						terminalError: null,
						...shared,
					});
				} else if (event.phase === 'max_rounds_reached') {
					set({
						isGenerating: false,
						generationPhase: 'idle',
						currentToolName: null,
						generationStartTime: null,
						liveMessages: cleanedMessages,
						terminalState: 'max_rounds',
						terminalError: null,
						...shared,
					});
				} else if (event.phase === 'thinking') {
					set({ generationPhase: 'thinking', currentToolName: null, ...shared });
				} else if (event.phase === 'tool_calling') {
					set({
						generationPhase: 'tool_calling',
						currentToolName: event.toolName ?? null,
						...shared,
					});
				}
			},

			reset: () => set(INITIAL_STATE),
		}),
		{
			name: 'mf-chat-store',
			partialize: (state) => ({ activeSessionId: state.activeSessionId }),
		},
	),
);

export function useChatStore<T>(selector: (s: ChatStoreState & ChatStoreActions) => T): T {
	return useStore(chatStore, selector);
}
