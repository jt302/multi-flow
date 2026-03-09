import type { LucideIcon } from 'lucide-react';

import type { PresetKey } from '@/entities/theme/model/types';

export type NavId = 'dashboard' | 'profiles' | 'groups' | 'proxy' | 'windows' | 'ai' | 'settings';

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

export type ConsoleSidebarProps = {
	activeNav: NavId;
	onNavChange: (nav: NavId) => void;
	isRunning: boolean;
	onToggleRunning: () => void;
};

export type ConsoleTopbarProps = {
	activeNav: NavId;
	themeMode: 'light' | 'dark' | 'system';
	onThemeModeChange: (mode: 'light' | 'dark' | 'system') => void;
	onOpenLogPanel?: () => void;
};

export type MetricsGridProps = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
};

export type ActiveSectionCardProps = {
	label: string;
	title: string;
	description: string;
};

export type SessionTableCardProps = {
	title: string;
	rows: SessionRow[];
};
