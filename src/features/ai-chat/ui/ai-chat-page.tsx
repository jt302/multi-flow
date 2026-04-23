import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PanelLeft } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';

import {
	sendChatMessage,
	stopChatGeneration,
	updateChatSession,
	regenerateChatMessage,
} from '@/entities/chat/api/chat-api';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui';
import { queryKeys } from '@/shared/config/query-keys';
import { chatStore, useChatStore } from '@/store/chat-store';
import { useIsMobile } from '@/hooks/use-mobile';
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
	const qc = useQueryClient();
	const isMobile = useIsMobile();
	const { defaultLayout: chatLayout, onLayoutChanged: onChatLayoutChanged } = usePersistentLayout({
		id: 'ai-chat-layout',
		defaultSizes: [14, 86],
	});
	const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

const sessionsQuery = useChatSessionsQuery();
	const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

	const persistedSessionId = useChatStore((s) => s.activeSessionId);
	const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
	const [isRestoringSession, setIsRestoringSession] = useState(
		() => !!chatStore.getState().activeSessionId,
	);
	const isGenerating = useChatStore((s) => s.isGenerating);
	const liveMessages = useChatStore((s) => s.liveMessages);
	const contextUsed = useChatStore((s) => s.contextUsed);
	const terminalState = useChatStore((s) => s.terminalState);
	const terminalError = useChatStore((s) => s.terminalError);
	const hydratedSession = sessions.find((s) => s.id === hydratedSessionId) ?? null;
	const listActiveSessionId = hydratedSessionId ?? persistedSessionId;

	const messagesQuery = useChatMessagesQuery(hydratedSessionId);
	const dbMessages: ChatMessageRecord[] = messagesQuery.data ?? [];

	// merge DB messages with live messages (avoid duplicates)
	const allMessages = useMemo(() => {
		const liveIds = new Set(liveMessages.map((m) => m.id));
		return [
			...dbMessages.filter((m) => !liveIds.has(m.id)),
			...liveMessages,
		].sort((a, b) => a.sortOrder - b.sortOrder);
	}, [dbMessages, liveMessages]);

	const createSession = useCreateChatSession();
	const deleteSession = useDeleteChatSession();

	const activateSession = useCallback((id: string | null) => {
		setHydratedSessionId(id);
		setIsRestoringSession(false);
		chatStore.getState().setActiveSession(id);
	}, []);

	useEffect(() => {
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

		// rAF + effect 依赖变更之间有竞态（Strict Mode 下 effect 二次运行会取消 rAF），
		// startTransition 单独已足够保证低优先级延迟更新。
		startTransition(() => {
			setHydratedSessionId(persistedSessionId);
			setIsRestoringSession(false);
		});
	}, [hydratedSessionId, persistedSessionId, sessions, sessionsQuery.isLoading]);

	const handleCreate = useCallback(async () => {
		const session = await createSession.mutateAsync({});
		activateSession(session.id);
	}, [createSession, activateSession]);

	// 当前会话是否关联了环境
	const hasProfile = (hydratedSession?.profileIds?.length ?? 0) > 0
		|| !!hydratedSession?.profileId;

	const handleSubmit = useCallback(async (text: string, img: string | null) => {
		if (!hydratedSessionId || isGenerating) return;

		// 未关联任何环境时提醒（input bar 的 sendDisabled=false 允许点击，这里负责拦截）
		if (!hasProfile) {
			toast.warning(t('noProfileWarning', '请先在顶部选择一个运行环境，否则浏览器工具将无法使用。'));
			return;
		}

		if (!text.trim() && !img) return;

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
	}, [hydratedSessionId, isGenerating, hasProfile, t, hydratedSession, qc]);

	const handleStop = useCallback(() => {
		if (hydratedSessionId) {
			stopChatGeneration(hydratedSessionId);
			chatStore.getState().finishGeneration();
		}
	}, [hydratedSessionId]);

	const handleContinue = useCallback(async () => {
		if (!hydratedSessionId || isGenerating) return;
		chatStore.getState().startGeneration();
		try {
			await regenerateChatMessage(hydratedSessionId);
		} catch {
			chatStore.getState().finishGeneration();
		}
	}, [hydratedSessionId, isGenerating]);

	const handleDelete = useCallback((id: string) => {
		deleteSession.mutate(id);
		if (persistedSessionId === id || hydratedSessionId === id) {
			activateSession(null);
		}
	}, [deleteSession, persistedSessionId, hydratedSessionId, activateSession]);

	if (isMobile) {
		return (
			<>
				<Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
					{hydratedSessionId && hydratedSession ? (
						<div className="flex h-full flex-col overflow-hidden">
							<div className="shrink-0 border-b px-3 py-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => setMobileSessionsOpen(true)}
								>
									<PanelLeft className="size-4" />
									{t('sessionList', '会话列表')}
								</Button>
							</div>
							<div className="flex h-full flex-col overflow-hidden">
								<ChatHeader session={hydratedSession} />
								<ChatMessageList
									key={hydratedSessionId}
									messages={allMessages}
									isGenerating={isGenerating}
									terminalState={terminalState}
									terminalError={terminalError}
									sessionId={hydratedSessionId}
									onContinue={handleContinue}
								/>
								<ChatInputBar
									onSubmit={handleSubmit}
									onStop={handleStop}
									isGenerating={isGenerating}
									sendDisabled={hasProfile ? undefined : false}
									contextUsed={contextUsed}
								/>
							</div>
						</div>
					) : isRestoringSession ? (
						<div className="flex flex-1 flex-col justify-center gap-4 px-4 text-muted-foreground">
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
						<ChatSessionList
							sessions={sessions}
							activeId={listActiveSessionId}
							onSelect={activateSession}
							onCreate={handleCreate}
							onDelete={handleDelete}
						/>
					)}
					<SheetContent side="left" className="w-[min(88vw,360px)] p-0">
						<SheetHeader className="border-b">
							<SheetTitle>{t('sessionList', '会话列表')}</SheetTitle>
						</SheetHeader>
						<div className="min-h-0 flex-1 overflow-hidden">
							<ChatSessionList
								sessions={sessions}
								activeId={listActiveSessionId}
								onSelect={(id) => {
									activateSession(id);
									setMobileSessionsOpen(false);
								}}
								onCreate={handleCreate}
								onDelete={handleDelete}
							/>
						</div>
					</SheetContent>
				</Sheet>
			</>
		);
	}

	return (
		<ResizablePanelGroup direction="horizontal" className="h-full" defaultLayout={chatLayout} onLayoutChanged={onChatLayoutChanged}>
				<ResizablePanel id="ai-chat-sidebar" defaultSize={14} minSize={12} maxSize={35}>
					<ChatSessionList
						sessions={sessions}
						activeId={listActiveSessionId}
						onSelect={activateSession}
						onCreate={handleCreate}
						onDelete={handleDelete}
					/>
				</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel id="ai-chat-main" defaultSize={86}>
				<div className="flex h-full flex-col overflow-hidden">
					{hydratedSessionId && hydratedSession ? (
						<>
							<ChatHeader session={hydratedSession} />
							<ChatMessageList
								key={hydratedSessionId}
								messages={allMessages}
								isGenerating={isGenerating}
								terminalState={terminalState}
								terminalError={terminalError}
								sessionId={hydratedSessionId}
								onContinue={handleContinue}
							/>
							<ChatInputBar
								onSubmit={handleSubmit}
								onStop={handleStop}
								isGenerating={isGenerating}
								sendDisabled={hasProfile ? undefined : false}
								contextUsed={contextUsed}
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
