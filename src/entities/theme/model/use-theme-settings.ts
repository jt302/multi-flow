import { setTheme as setNativeAppTheme } from '@tauri-apps/api/app';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import type {
	CustomThemePreset,
	Palette,
	PresetKey,
	ThemeMode,
} from '@/entities/theme/model/types';
import { THEME_PRESET_KEYS, THEME_PRESETS } from '@/entities/theme/model/presets';
import {
	addCustomThemePreset,
	readCustomThemePresets,
	removeCustomThemePreset,
} from '@/entities/theme/model/custom-presets';
import { getReadableForeground, hexToRgb, mixHex } from '@/shared/lib/color';

const THEME_SYNC_CHANNEL = 'mf-theme-sync';

const STORAGE_KEYS = {
	mode: 'mf_theme_mode',
	preset: 'mf_theme_preset',
	customColor: 'mf_theme_custom_color',
	useCustom: 'mf_theme_use_custom',
	customPresets: 'mf_theme_custom_presets',
} as const;

type ThemeSyncPayload = {
	mode: ThemeMode;
	preset: PresetKey;
	customColor: string;
	useCustomColor: boolean;
	customPresets: CustomThemePreset[];
};

function isThemeMode(value: string | null): value is ThemeMode {
	return value === 'light' || value === 'dark' || value === 'system';
}

function isPresetKey(value: string | null): value is PresetKey {
	return THEME_PRESET_KEYS.includes(value as PresetKey);
}

function getStorageItem(key: string): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return window.localStorage.getItem(key);
}

function getInitialThemeMode(): ThemeMode {
	const saved = getStorageItem(STORAGE_KEYS.mode);
	return isThemeMode(saved) ? saved : 'system';
}

function getInitialPreset(): PresetKey {
	const saved = getStorageItem(STORAGE_KEYS.preset);
	return isPresetKey(saved) ? saved : 'harbor';
}

function getInitialCustomColor(): string {
	const saved = getStorageItem(STORAGE_KEYS.customColor);
	if (saved && hexToRgb(saved)) {
		return saved;
	}
	return '#0F8A73';
}

function getInitialUseCustomColor(): boolean {
	const saved = getStorageItem(STORAGE_KEYS.useCustom);
	return saved === 'true';
}

function getInitialCustomPresets(): CustomThemePreset[] {
	return readCustomThemePresets(getStorageItem(STORAGE_KEYS.customPresets));
}

function getInitialSystemDark(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useThemeSettings() {
	const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
	const [preset, setPreset] = useState<PresetKey>(getInitialPreset);
	const [customColor, setCustomColor] = useState(getInitialCustomColor);
	const [useCustomColor, setUseCustomColor] = useState(getInitialUseCustomColor);
	const [customPresets, setCustomPresets] = useState<CustomThemePreset[]>(
		getInitialCustomPresets,
	);
	const [systemDark, setSystemDark] = useState(getInitialSystemDark);
	const resolvedMode = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const sync = () => setSystemDark(media.matches);
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	}, []);

	useEffect(() => {
		const onStorage = (event: StorageEvent) => {
			if (event.storageArea !== window.localStorage || !event.key) {
				return;
			}
			if (event.key === STORAGE_KEYS.mode && isThemeMode(event.newValue)) {
				setThemeMode(event.newValue);
				return;
			}
			if (event.key === STORAGE_KEYS.preset && isPresetKey(event.newValue)) {
				setPreset(event.newValue);
				return;
			}
			if (event.key === STORAGE_KEYS.customColor && event.newValue && hexToRgb(event.newValue)) {
				setCustomColor(event.newValue);
				return;
			}
			if (event.key === STORAGE_KEYS.useCustom && (event.newValue === 'true' || event.newValue === 'false')) {
				setUseCustomColor(event.newValue === 'true');
				return;
			}
			if (event.key === STORAGE_KEYS.customPresets) {
				setCustomPresets(readCustomThemePresets(event.newValue));
			}
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
			return;
		}

		const channel = new BroadcastChannel(THEME_SYNC_CHANNEL);
		channel.onmessage = (event: MessageEvent<ThemeSyncPayload>) => {
			const payload = event.data;
			if (!payload) {
				return;
			}

			setThemeMode(payload.mode);
			setPreset(payload.preset);
			setCustomColor(payload.customColor);
			setUseCustomColor(payload.useCustomColor);
			setCustomPresets(payload.customPresets);
		};

		return () => {
			channel.close();
		};
	}, []);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.mode, themeMode);
		const root = document.documentElement;
		const shouldDark = themeMode === 'dark' || (themeMode === 'system' && systemDark);
		root.classList.toggle('dark', shouldDark);
		root.style.colorScheme = resolvedMode;
	}, [resolvedMode, systemDark, themeMode]);

	useEffect(() => {
		const nativeTheme = themeMode === 'system' ? null : themeMode;
		void setNativeAppTheme(nativeTheme).catch((error) => {
			console.warn('sync native app theme failed', error);
		});
	}, [themeMode]);

	const activePalette = useMemo<Palette>(() => {
		if (useCustomColor && hexToRgb(customColor)) {
			return {
				light: customColor,
				dark: mixHex(customColor, '#FFFFFF', 0.28),
			};
		}
		return THEME_PRESETS[preset];
	}, [customColor, preset, useCustomColor]);

	useLayoutEffect(() => {
		localStorage.setItem(STORAGE_KEYS.preset, preset);
		localStorage.setItem(STORAGE_KEYS.customColor, customColor);
		localStorage.setItem(STORAGE_KEYS.useCustom, String(useCustomColor));
		localStorage.setItem(
			STORAGE_KEYS.customPresets,
			JSON.stringify(customPresets),
		);

		if (typeof BroadcastChannel !== 'undefined') {
			const channel = new BroadcastChannel(THEME_SYNC_CHANNEL);
			channel.postMessage({
				mode: themeMode,
				preset,
				customColor,
				useCustomColor,
				customPresets,
			} satisfies ThemeSyncPayload);
			channel.close();
		}

		const root = document.documentElement;
		root.style.setProperty('--primary-light', activePalette.light);
		root.style.setProperty('--primary-dark', activePalette.dark);
		root.style.setProperty('--primary-foreground-light', getReadableForeground(activePalette.light));
		root.style.setProperty('--primary-foreground-dark', getReadableForeground(activePalette.dark));
		root.style.setProperty('--ring-light', mixHex(activePalette.light, '#FFFFFF', 0.4));
		root.style.setProperty('--ring-dark', mixHex(activePalette.dark, '#0B1220', 0.35));
	}, [activePalette, customColor, customPresets, preset, themeMode, useCustomColor]);

	return {
		themeMode,
		setThemeMode,
		preset,
		setPreset,
		customColor,
		setCustomColor,
		useCustomColor,
		setUseCustomColor,
		customPresets,
		addCustomPreset: (value: string) =>
			setCustomPresets((current) => addCustomThemePreset(current, value)),
		removeCustomPreset: (value: string) =>
			setCustomPresets((current) => removeCustomThemePreset(current, value)),
		resolvedMode,
	};
}
