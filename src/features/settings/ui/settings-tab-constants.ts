import i18next from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { Settings, Palette, HardDrive, Bot, Trash2, Code } from 'lucide-react';

import { SETTINGS_PATHS } from '@/app/workspace-routes';

const IS_DEV = Boolean(import.meta.env?.DEV);

export const SETTINGS_TAB_IDS = {
	general: 'general',
	appearance: 'appearance',
	resources: 'resources',
	ai: 'ai',
	'recycle-bin': 'recycle-bin',
	dev: 'dev',
} as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[keyof typeof SETTINGS_TAB_IDS];

export type SettingsTabItem = {
	id: SettingsTabId;
	label: string;
	icon: LucideIcon;
	path: string;
};

export function getSettingsTabs(): SettingsTabItem[] {
	const t = i18next.t.bind(i18next);
	const tabs: SettingsTabItem[] = [
		{
			id: 'general',
			label: t('settings:tabs.general'),
			icon: Settings,
			path: SETTINGS_PATHS.general,
		},
		{
			id: 'appearance',
			label: t('settings:tabs.appearance'),
			icon: Palette,
			path: SETTINGS_PATHS.appearance,
		},
		{
			id: 'resources',
			label: t('settings:tabs.resources'),
			icon: HardDrive,
			path: SETTINGS_PATHS.resources,
		},
		{
			id: 'ai',
			label: t('settings:tabs.ai'),
			icon: Bot,
			path: SETTINGS_PATHS.ai,
		},
		{
			id: 'recycle-bin',
			label: t('settings:tabs.recycleBin'),
			icon: Trash2,
			path: SETTINGS_PATHS['recycle-bin'],
		},
	];
	if (IS_DEV) {
		tabs.push({
			id: 'dev',
			label: t('settings:tabs.dev'),
			icon: Code,
			path: SETTINGS_PATHS.dev,
		});
	}
	return tabs;
}

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'general';

export function resolveSettingsTab(pathname: string): SettingsTabItem {
	const tabs = getSettingsTabs();
	return tabs.find((tab) => tab.path === pathname) ?? tabs[0];
}
