import type { Palette, PresetKey } from './types';

export const THEME_PRESETS: Record<PresetKey, Palette> = {
	harbor: { light: '#0F8A73', dark: '#56D3BC' },
	olive: { light: '#4C7A38', dark: '#9FDD72' },
	copper: { light: '#B05A2B', dark: '#FF9A66' },
	slate: { light: '#34607C', dark: '#7FC5ED' },
};

export const THEME_PRESET_KEYS: PresetKey[] = ['harbor', 'olive', 'copper', 'slate'];
