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

export const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: '通用', icon: Settings },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'resources', label: '资源', icon: HardDrive },
  { id: 'ai', label: 'AI 配置', icon: Bot },
  { id: 'recycle-bin', label: '回收站', icon: Trash2 },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'appearance';
