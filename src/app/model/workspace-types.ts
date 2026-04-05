import type { LucideIcon } from 'lucide-react';

import type { PresetKey, ThemeMode } from '@/entities/theme/model/types';

export type NavId = 'dashboard' | 'profiles' | 'plugins' | 'groups' | 'proxy' | 'windows' | 'browser-control' | 'automation' | 'ai-chat' | 'settings';

export type NavItem = {
	id: NavId;
	label: string;
	icon: LucideIcon;
};

export type SessionRow = {
	name: string;
	group: string;
	status: string;
	geo: string;
	last: string;
};

export type NavSection = {
	title: string;
	desc: string;
	tableTitle: string;
	rows: SessionRow[];
};

export type ActiveSectionCardProps = {
	label: string;
	title: string;
	description: string;
};

export type ProfileNavigationIntent = {
	profileId: string;
	view: 'detail' | 'edit';
} | null;

export type WorkspaceThemeState = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	themeMode: ThemeMode;
};

export type WorkspaceThemeActions = {
	setThemeMode: (mode: ThemeMode) => void;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
};

export type WorkspaceNavigation = {
	pathname: string;
	intent: ProfileNavigationIntent;
	onConsumeNavigationIntent: () => void;
	onSetProfileNavigationIntent: (intent: ProfileNavigationIntent) => void;
	onNavigate: (path: string) => void;
};

export type WorkspaceOutletContext = {
	activeNav: NavId;
	theme: WorkspaceThemeState & WorkspaceThemeActions;
	navigation: WorkspaceNavigation;
};
