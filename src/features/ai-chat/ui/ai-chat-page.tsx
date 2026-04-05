import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryClient } from '@tanstack/react-query';

import {
	sendChatMessage,
	stopChatGeneration,
	updateChatSession,
} from '@/entities/chat/api/chat-api';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { queryKeys } from '@/shared/config/query-keys';
import { chatStore, useChatStore } from '@/store/chat-store';
import {
	useCreateChatSession,
	useDeleteChatSession,
	useChatSessionsQuery,
} from '../model/use-chat-sessions';
import { useChatMessagesQuery } from '../model/use-chat-messages';
import { ChatSessionList } from './chat-session-list';
import { ChatMessageList } from './chat-message-list';
import { ChatHeader } from './chat-header';
import { ChatInputBar } from './chat-input-bar';

export function AiChatPage() {
	const { t } = useTranslation('chat');
	const [input, setInput] = useState('');
	const qc = useQueryClient();

	const sessionsQuery = useChatSessionsQuery();
	const sessions = sessionsQuery.data ?? [];

	const activeSessionId = useChatStore((s) => s.activeSessionId);
	const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
	const isGenerating = useChatStore((s) => s.isGenerating);
	const liveMessages = useChatStore((s) => s.liveMessages);

	const messagesQuery = useChatMessagesQuery(activeSessionId);
	const dbMessages: ChatMessageRecord[] = messagesQuery.data ?? [];

	// merge DB messages with live messages (avoid duplicates)
	const liveIds = new Set(liveMessages.map((m) => m.id));
	const allMessages = [
		...dbMessages.filter((m) => !liveIds.has(m.id)),
		...liveMessages,
	].sort((a, b) => a.sortOrder - b.sortOrder);

	const createSession = useCreateChatSession();
	const deleteSession = useDeleteChatSession();

	const handleCreate = async () => {
		const session = await createSession.mutateAsync({});
		chatStore.getState().setActiveSession(session.id);
	};

	const handleSend = async () => {
		if (!input.trim() || !activeSessionId || isGenerating) return;
		const text = input.trim();
		setInput('');
		chatStore.getState().startGeneration();

		// auto-generate title from the first user message
		if (activeSession && !activeSession.title) {
			const autoTitle = text.length > 30 ? text.slice(0, 30) + '…' : text;
			updateChatSession(activeSessionId, { title: autoTitle }).then(() => {
				qc.invalidateQueries({ queryKey: queryKeys.chatSessions });
			});
		}

		try {
			await sendChatMessage(activeSessionId, text);
		} catch {
			chatStore.getState().finishGeneration();
		}
	};

	const handleStop = () => {
		if (activeSessionId) stopChatGeneration(activeSessionId);
	};

	return (
		<ResizablePanelGroup direction="horizontal" className="h-full">
			<ResizablePanel defaultSize={16} minSize={14} maxSize={35}>
				<ChatSessionList
					sessions={sessions}
					activeId={activeSessionId}
					onSelect={(id) => chatStore.getState().setActiveSession(id)}
					onCreate={handleCreate}
					onDelete={(id) => {
						deleteSession.mutate(id);
						if (activeSessionId === id)
							chatStore.getState().setActiveSession(null);
					}}
				/>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={78}>
				<div className="flex h-full flex-col overflow-hidden">
					{activeSessionId && activeSession ? (
						<>
							<ChatHeader session={activeSession} />
							<ChatMessageList
								key={activeSessionId}
								messages={allMessages}
								isGenerating={isGenerating}
							/>
							<ChatInputBar
								value={input}
								onChange={setInput}
								onSend={handleSend}
								onStop={handleStop}
								isGenerating={isGenerating}
							/>
						</>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
							<p className="text-sm">{t('selectChat')}</p>
						</div>
					)}
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
