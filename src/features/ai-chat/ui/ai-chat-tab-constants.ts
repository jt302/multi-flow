import i18next from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { FolderTree, MessagesSquare, Plug, Sparkles } from 'lucide-react';

import { AI_CHAT_DEFAULT_PATH, AI_CHAT_PATHS } from '@/app/workspace-routes';

export const AI_CHAT_TAB_IDS = {
	sessions: 'sessions',
	skills: 'skills',
	fileSystem: 'fileSystem',
	mcp: 'mcp',
} as const;

export type AiChatTabId = (typeof AI_CHAT_TAB_IDS)[keyof typeof AI_CHAT_TAB_IDS];

export type AiChatTabItem = {
	id: AiChatTabId;
	label: string;
	icon: LucideIcon;
	path: string;
};

export function getAiChatTabs(): AiChatTabItem[] {
	const t = i18next.t.bind(i18next);
	return [
		{
			id: 'sessions',
			label: t('nav:sidebar.aiChatSessions'),
			icon: MessagesSquare,
			path: AI_CHAT_PATHS.sessions,
		},
		{
			id: 'skills',
			label: t('nav:sidebar.aiChatSkills'),
			icon: Sparkles,
			path: AI_CHAT_PATHS.skills,
		},
		{
			id: 'fileSystem',
			label: t('nav:sidebar.aiChatFileSystem'),
			icon: FolderTree,
			path: AI_CHAT_PATHS.fileSystem,
		},
		{
			id: 'mcp',
			label: t('nav:sidebar.aiChatMcp'),
			icon: Plug,
			path: AI_CHAT_PATHS.mcp,
		},
	];
}

export const DEFAULT_AI_CHAT_TAB: AiChatTabId = 'sessions';
export { AI_CHAT_DEFAULT_PATH };
