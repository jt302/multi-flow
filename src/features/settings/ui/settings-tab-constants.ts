import i18next from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { Settings, Palette, HardDrive, Bot, Trash2 } from 'lucide-react';

export const SETTINGS_TAB_IDS = {
  general: 'general',
  appearance: 'appearance',
  resources: 'resources',
  ai: 'ai',
  'recycle-bin': 'recycle-bin',
} as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[keyof typeof SETTINGS_TAB_IDS];

export function getSettingsTabs(): { id: SettingsTabId; label: string; icon: LucideIcon }[] {
  const t = i18next.t.bind(i18next);
  return [
    { id: 'general', label: t('settings:tabs.general'), icon: Settings },
    { id: 'appearance', label: t('settings:tabs.appearance'), icon: Palette },
    { id: 'resources', label: t('settings:tabs.resources'), icon: HardDrive },
    { id: 'ai', label: t('settings:tabs.ai'), icon: Bot },
    { id: 'recycle-bin', label: t('settings:tabs.recycleBin'), icon: Trash2 },
  ];
}

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'general';
