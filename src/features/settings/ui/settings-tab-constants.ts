import type { LucideIcon } from 'lucide-react';
import { Settings, Palette, HardDrive, Bot, Wrench } from 'lucide-react';

export const SETTINGS_TAB_IDS = {
  general: 'general',
  appearance: 'appearance',
  resources: 'resources',
  ai: 'ai',
  advanced: 'advanced',
} as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[keyof typeof SETTINGS_TAB_IDS];

export const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: '通用', icon: Settings },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'resources', label: '资源', icon: HardDrive },
  { id: 'ai', label: 'AI 配置', icon: Bot },
  { id: 'advanced', label: '高级', icon: Wrench },
];

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'appearance';
