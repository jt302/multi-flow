import {
	Bot,
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
	{ id: 'windows', label: '窗口管理', icon: PanelsTopLeft },
	{ id: 'rpa', label: 'RPA 流程', icon: Bot },
	{ id: 'settings', label: '设置', icon: Settings2 },
];

