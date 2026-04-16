import type { LucideIcon } from 'lucide-react';

import type {
	CustomThemePreset,
	PresetKey,
	ThemeMode,
} from '@/entities/theme/model/types';

export type NavId = 'dashboard' | 'profiles' | 'plugins' | 'groups' | 'proxy' | 'windows' | 'browser-control' | 'automation' | 'ai-chat' | 'settings';

export type NavChildItem = {
	label: string;
	path: string;
	icon: LucideIcon;
};

export type NavItem = {
	id: NavId;
	label: string;
	icon: LucideIcon;
	children?: NavChildItem[];
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
	/** If set, the back button navigates to this nav instead of showing the profile list */
	returnNav?: NavId;
} | null;

export type WorkspaceThemeState = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	customPresets: CustomThemePreset[];
	themeMode: ThemeMode;
};

export type WorkspaceThemeActions = {
	setThemeMode: (mode: ThemeMode) => void;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	onAddCustomPreset: () => void;
	onApplyCustomPreset: (value: CustomThemePreset) => void;
	onDeleteCustomPreset: (value: CustomThemePreset) => void;
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
