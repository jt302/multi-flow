import {
	FolderKanban,
	Folders,
	Globe2,
	LayoutDashboard,
	PanelsTopLeft,
	Settings2,
} from 'lucide-react';

import type { NavItem } from './workspace-types';

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
	{ id: 'dashboard', label: '总览', icon: LayoutDashboard },
	{ id: 'profiles', label: '环境', icon: FolderKanban },
	{ id: 'groups', label: '分组', icon: Folders },
	{ id: 'proxy', label: '代理池', icon: Globe2 },
	{ id: 'windows', label: '窗口同步', icon: PanelsTopLeft },
	{ id: 'settings', label: '设置', icon: Settings2 },
];
