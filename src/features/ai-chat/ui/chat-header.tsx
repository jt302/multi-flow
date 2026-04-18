import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pencil, ScrollText } from 'lucide-react';

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import { useDefaultAiConfigQuery } from '@/entities/ai/model/use-default-ai-config-query';
import { listAiConfigs } from '@/entities/automation/api/automation-api';
import type {
	ChatSession,
	UpdateChatSessionRequest,
} from '@/entities/chat/model/types';
import { queryKeys } from '@/shared/config/query-keys';
import { useUpdateChatSession } from '../model/use-chat-sessions';
import { McpServerMultiSelect } from './mcp-server-multi-select';
import { ProfileMultiSelect } from './profile-multi-select';

type Props = {
	session: ChatSession;
};

export const ChatHeader = memo(function ChatHeader({ session }: Props) {
	const { t } = useTranslation('chat');
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState('');
	const [promptOpen, setPromptOpen] = useState(false);
	const [promptDraft, setPromptDraft] = useState('');
	const titleInputRef = useRef<HTMLInputElement>(null);

	const updateSession = useUpdateChatSession();

	const aiConfigsQuery = useQuery({
		queryKey: queryKeys.aiConfigs,
		queryFn: listAiConfigs,
	});
	const aiConfigs = aiConfigsQuery.data ?? [];

	const defaultConfigQuery = useDefaultAiConfigQuery();
	const defaultConfigId = defaultConfigQuery.data ?? null;
	// 当前会话未指定 AI 配置时，在显示层回退到默认配置
	const defaultConfig = defaultConfigId
		? (aiConfigs.find((c) => c.id === defaultConfigId) ?? null)
		: null;
	// 当前会话明确选择的配置（用于 SelectValue 显示）
	const selectedConfig = session.aiConfigId
		? aiConfigs.find((c) => c.id === session.aiConfigId)
		: null;

	// sync prompt draft when session changes
	useEffect(() => {
		setPromptDraft(session.systemPrompt ?? '');
		setPromptOpen(false);
		setIsEditingTitle(false);
	}, [session.id]);

	const doUpdate = (payload: UpdateChatSessionRequest) => {
		updateSession.mutate({ sessionId: session.id, payload });
	};

	const startEditTitle = () => {
		setTitleDraft(session.title ?? '');
		setIsEditingTitle(true);
		setTimeout(() => titleInputRef.current?.focus(), 0);
	};

	const commitTitle = () => {
		setIsEditingTitle(false);
		const trimmed = titleDraft.trim();
		if (trimmed && trimmed !== (session.title ?? '')) {
			doUpdate({ title: trimmed });
		}
	};

	const handlePromptSave = () => {
		const trimmed = promptDraft.trim();
		const current = session.systemPrompt ?? '';
		if (trimmed !== current) {
			doUpdate({ systemPrompt: trimmed || null });
		}
		setPromptOpen(false);
	};

	return (
		<div className="shrink-0 border-b px-4 py-2">
			{/* Row 1: Title + Profile + AI Config */}
			<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 min-h-[32px]">
				{/* Editable title */}
				<div className="flex items-center gap-1.5 min-w-0 flex-1">
					{isEditingTitle ? (
						<Input
							ref={titleInputRef}
							value={titleDraft}
							onChange={(e) => setTitleDraft(e.target.value)}
							onBlur={commitTitle}
							onKeyDown={(e) => {
								if (e.key === 'Enter') commitTitle();
								if (e.key === 'Escape') setIsEditingTitle(false);
							}}
							className="h-7 text-sm font-medium"
						/>
					) : (
						<button
							type="button"
							onClick={startEditTitle}
							className="flex items-center gap-1 text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
							title={t('editTitle')}
						>
							<span className="truncate">
								{session.title ?? t('defaultTitle')}
							</span>
							<Pencil className="size-3 shrink-0 opacity-50" />
						</button>
					)}
				</div>

				{/* Profile multi-select */}
				<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
					<ProfileMultiSelect
						selectedIds={session.profileIds ?? (session.profileId ? [session.profileId] : [])}
						activeId={session.activeProfileId ?? session.profileId ?? null}
						onSelectionChange={(ids, activeId) =>
							doUpdate({ profileIds: ids.length > 0 ? ids : null, activeProfileId: activeId })
						}
					/>

					{/* AI Config selector */}
					<Select
						value={session.aiConfigId ?? '__none__'}
						onValueChange={(v) =>
							doUpdate({ aiConfigId: v === '__none__' ? null : v })
						}
					>
						<SelectTrigger size="sm" className="w-full text-xs sm:w-48">
							<SelectValue placeholder={t('selectAiConfig')}>
								{selectedConfig?.name
									?? (defaultConfig
										? `${t('globalConfig')}(${defaultConfig.name})`
										: t('noAiConfig'))}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__none__">
								{defaultConfig
									? `${t('globalConfig')}(${defaultConfig.name})`
									: t('noAiConfig')}
							</SelectItem>
							{aiConfigs.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{/* MCP server session filter */}
					<McpServerMultiSelect
						disabledIds={session.disabledMcpServerIds}
						onSelectionChange={(ids) => doUpdate({ disabledMcpServerIds: ids.length > 0 ? ids : null })}
					/>

					{/* Toggle system prompt */}
					<button
						type="button"
						onClick={() => setPromptOpen(true)}
						className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border px-2 text-xs transition-colors cursor-pointer shrink-0 sm:w-auto ${session.systemPrompt ? 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10' : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent'}`}
					>
						<ScrollText className="size-3" />
						{t('systemPrompt')}
					</button>
				</div>
			</div>

			{/* System prompt dialog */}
			<Dialog open={promptOpen} onOpenChange={(open) => {
				if (!open) handlePromptSave();
			}}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{t('systemPrompt')}</DialogTitle>
					</DialogHeader>
					<Textarea
						value={promptDraft}
						onChange={(e) => setPromptDraft(e.target.value)}
						placeholder={t('systemPromptPlaceholder')}
						className="min-h-[200px] resize-none text-sm"
						rows={8}
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setPromptDraft(session.systemPrompt ?? '');
							setPromptOpen(false);
						}} className="cursor-pointer">
							{t('cancel', '取消')}
						</Button>
						<Button onClick={handlePromptSave} className="cursor-pointer">
							{t('save', '保存')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
});
