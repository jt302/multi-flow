import {
	AppWindow,
	Bot,
	FolderKanban,
	Folders,
	Globe2,
	LayoutDashboard,
	MessageSquare,
	PanelsTopLeft,
	Puzzle,
	Settings2,
} from 'lucide-react';
import i18next from 'i18next';

import type { NavItem } from './workspace-types';

export function getWorkspaceNavItems(): NavItem[] {
	const t = i18next.t.bind(i18next);
	return [
		{ id: 'dashboard', label: t('nav:dashboard'), icon: LayoutDashboard },
		{ id: 'profiles', label: t('nav:profiles'), icon: FolderKanban },
		{ id: 'plugins', label: t('nav:plugins'), icon: Puzzle },
		{ id: 'groups', label: t('nav:groups'), icon: Folders },
		{ id: 'proxy', label: t('nav:proxy'), icon: Globe2 },
		{ id: 'windows', label: t('nav:windows'), icon: PanelsTopLeft },
		{ id: 'browser-control', label: t('nav:browserControl'), icon: AppWindow },
		{ id: 'automation', label: t('nav:automation'), icon: Bot },
		{ id: 'ai-chat', label: t('nav:aiChat'), icon: MessageSquare },
		{ id: 'settings', label: t('nav:settings'), icon: Settings2 },
	];
}
