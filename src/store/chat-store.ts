import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

import type { ChatMessageRecord, ChatPhaseEvent } from '@/entities/chat/model/types';

type GenerationPhase = 'idle' | 'thinking' | 'tool_calling' | 'done';

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
};

type ChatStoreActions = {
	setActiveSession: (id: string | null) => void;
	startGeneration: () => void;
	finishGeneration: () => void;
	appendMessage: (msg: ChatMessageRecord) => void;
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
			set({ activeSessionId: id, liveMessages: [], isGenerating: false, generationPhase: 'idle' }),

		startGeneration: () => set({ isGenerating: true, generationPhase: 'thinking', generationStartTime: Date.now(), currentRound: 0, promptTokens: 0, completionTokens: 0, elapsedMs: 0 }),

		finishGeneration: () => set({ isGenerating: false, generationPhase: 'idle', currentToolName: null, generationStartTime: null }),

		appendMessage: (msg) =>
			set((s) => ({ liveMessages: upsertLiveMessage(s.liveMessages, msg) })),

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
				if (event.phase === 'done' || event.phase === 'error') {
					return { isGenerating: false, generationPhase: 'idle', currentToolName: null, generationStartTime: null, ...shared };
				} else if (event.phase === 'thinking') {
					return { generationPhase: 'thinking', currentToolName: null, ...shared };
				} else if (event.phase === 'tool_calling') {
					return { generationPhase: 'tool_calling', currentToolName: event.toolName ?? null, ...shared };
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
				set({ activeSessionId: id, liveMessages: [], isGenerating: false, generationPhase: 'idle' }),

			startGeneration: () => set({ isGenerating: true, generationPhase: 'thinking', generationStartTime: Date.now(), currentRound: 0, promptTokens: 0, completionTokens: 0, elapsedMs: 0 }),

			finishGeneration: () => set({ isGenerating: false, generationPhase: 'idle', currentToolName: null, generationStartTime: null }),

			appendMessage: (msg) =>
				set((s) => ({ liveMessages: upsertLiveMessage(s.liveMessages, msg) })),

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
				if (event.phase === 'done' || event.phase === 'error') {
					set({ isGenerating: false, generationPhase: 'idle', currentToolName: null, generationStartTime: null, ...shared });
				} else if (event.phase === 'thinking') {
					set({ generationPhase: 'thinking', currentToolName: null, ...shared });
				} else if (event.phase === 'tool_calling') {
					set({ generationPhase: 'tool_calling', currentToolName: event.toolName ?? null, ...shared });
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
