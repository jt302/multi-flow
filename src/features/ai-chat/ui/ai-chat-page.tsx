import { startTransition, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useQueryClient } from '@tanstack/react-query';

import {
	sendChatMessage,
	stopChatGeneration,
	updateChatSession,
} from '@/entities/chat/api/chat-api';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
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
	const [pastedImage, setPastedImage] = useState<string | null>(null);
	const qc = useQueryClient();
	const { defaultLayout: chatLayout, onLayoutChanged: onChatLayoutChanged } = usePersistentLayout({
		id: 'ai-chat-layout',
		defaultSizes: [14, 86],
	});

	const sessionsQuery = useChatSessionsQuery();
	const sessions = sessionsQuery.data ?? [];

	const persistedSessionId = useChatStore((s) => s.activeSessionId);
	const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
	const [isRestoringSession, setIsRestoringSession] = useState(
		() => !!chatStore.getState().activeSessionId,
	);
	const restoreFrameRef = useRef<number | null>(null);
	const isGenerating = useChatStore((s) => s.isGenerating);
	const liveMessages = useChatStore((s) => s.liveMessages);
	const contextUsed = useChatStore((s) => s.contextUsed);
	const hydratedSession = sessions.find((s) => s.id === hydratedSessionId) ?? null;
	const listActiveSessionId = hydratedSessionId ?? persistedSessionId;

	const messagesQuery = useChatMessagesQuery(hydratedSessionId);
	const dbMessages: ChatMessageRecord[] = messagesQuery.data ?? [];

	// merge DB messages with live messages (avoid duplicates)
	const liveIds = new Set(liveMessages.map((m) => m.id));
	const allMessages = [
		...dbMessages.filter((m) => !liveIds.has(m.id)),
		...liveMessages,
	].sort((a, b) => a.sortOrder - b.sortOrder);

	const createSession = useCreateChatSession();
	const deleteSession = useDeleteChatSession();

	const activateSession = (id: string | null) => {
		if (restoreFrameRef.current != null) {
			cancelAnimationFrame(restoreFrameRef.current);
			restoreFrameRef.current = null;
		}
		setHydratedSessionId(id);
		setIsRestoringSession(false);
		chatStore.getState().setActiveSession(id);
	};

	useEffect(() => {
		return () => {
			if (restoreFrameRef.current != null) {
				cancelAnimationFrame(restoreFrameRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (restoreFrameRef.current != null) {
			cancelAnimationFrame(restoreFrameRef.current);
			restoreFrameRef.current = null;
		}

		if (!persistedSessionId) {
			setHydratedSessionId(null);
			setIsRestoringSession(false);
			return;
		}

		if (sessionsQuery.isLoading) {
			setIsRestoringSession(true);
			return;
		}

		const matchedSession = sessions.find((session) => session.id === persistedSessionId);
		if (!matchedSession) {
			setHydratedSessionId(null);
			setIsRestoringSession(false);
			if (chatStore.getState().activeSessionId === persistedSessionId) {
				chatStore.getState().setActiveSession(null);
			}
			return;
		}

		if (hydratedSessionId === persistedSessionId) {
			setIsRestoringSession(false);
			return;
		}

		setIsRestoringSession(true);
		restoreFrameRef.current = requestAnimationFrame(() => {
			startTransition(() => {
				setHydratedSessionId(persistedSessionId);
				setIsRestoringSession(false);
			});
			restoreFrameRef.current = null;
		});
	}, [hydratedSessionId, persistedSessionId, sessions, sessionsQuery.isLoading]);

	const handleCreate = async () => {
		const session = await createSession.mutateAsync({});
		activateSession(session.id);
	};

	// 当前会话是否关联了环境
	const hasProfile = (hydratedSession?.profileIds?.length ?? 0) > 0
		|| !!hydratedSession?.profileId;

	const handleSend = async () => {
		if (!hydratedSessionId || isGenerating) return;

		// 未关联任何环境时提醒并阻止发送（无论输入是否为空都给提示）
		if (!hasProfile) {
			toast.warning(t('noProfileWarning', '请先在顶部选择一个运行环境，否则浏览器工具将无法使用。'));
			return;
		}

		if (!input.trim() && !pastedImage) return;

		const text = input.trim();
		const img = pastedImage;
		setInput('');
		setPastedImage(null);
		chatStore.getState().startGeneration();

		// auto-generate title from the first user message
		if (hydratedSession && !hydratedSession.title) {
			const autoTitle = text.length > 30 ? text.slice(0, 30) + '…' : text;
			updateChatSession(hydratedSessionId, { title: autoTitle }).then(() => {
				qc.invalidateQueries({ queryKey: queryKeys.chatSessions });
			});
		}

		try {
			await sendChatMessage(hydratedSessionId, text, img);
		} catch {
			chatStore.getState().finishGeneration();
		}
	};

	const handleStop = () => {
		if (hydratedSessionId) {
			stopChatGeneration(hydratedSessionId);
			chatStore.getState().finishGeneration();
		}
	};

	return (
		<ResizablePanelGroup direction="horizontal" className="h-full" defaultLayout={chatLayout} onLayoutChanged={onChatLayoutChanged}>
				<ResizablePanel defaultSize={14} minSize={12} maxSize={35}>
					<ChatSessionList
						sessions={sessions}
						activeId={listActiveSessionId}
						onSelect={(id) => activateSession(id)}
						onCreate={handleCreate}
						onDelete={(id) => {
							deleteSession.mutate(id);
							if (persistedSessionId === id || hydratedSessionId === id) {
								activateSession(null);
							}
						}}
					/>
				</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={86}>
				<div className="flex h-full flex-col overflow-hidden">
					{hydratedSessionId && hydratedSession ? (
						<>
							<ChatHeader session={hydratedSession} />
							<ChatMessageList
								key={hydratedSessionId}
								messages={allMessages}
								isGenerating={isGenerating}
							/>
							<ChatInputBar
								value={input}
								onChange={setInput}
								onSend={handleSend}
								onStop={handleStop}
								isGenerating={isGenerating}
								sendDisabled={hasProfile ? ((!input.trim() && !pastedImage) || undefined) : false}
								contextUsed={contextUsed}
								imageBase64={pastedImage}
								onImageChange={setPastedImage}
								/>
							</>
					) : isRestoringSession ? (
						<div className="flex flex-1 flex-col justify-center gap-4 px-6 text-muted-foreground">
						<div className="space-y-2">
							<p className="text-sm font-medium text-foreground">
								{t('restoringChat')}
							</p>
						</div>
							<div className="space-y-3">
								<div className="h-4 w-40 animate-pulse rounded bg-muted" />
								<div className="h-20 w-full animate-pulse rounded-2xl bg-muted/80" />
								<div className="h-20 w-4/5 animate-pulse rounded-2xl bg-muted/60" />
							</div>
						</div>
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
