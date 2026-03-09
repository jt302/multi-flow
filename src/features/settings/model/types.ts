import type { ProfileDevicePresetItem, SaveProfileDevicePresetPayload } from '@/entities/profile/model/types';
import type { ResourceItem, ResourceProgressState } from '@/entities/resource/model/types';
import type { PresetKey } from '@/entities/theme/model/types';

export type ThemeCustomizerCardProps = {
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
};

export type SettingsPageProps = {
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	resources: ResourceItem[];
	onRefreshResources: () => Promise<void>;
	onInstallChromium: (resourceId: string) => Promise<void>;
	onActivateChromium: (version: string) => Promise<void>;
	resourceProgress: ResourceProgressState | null;
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (presetId: string, payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
	onOpenRecycleBin?: () => void;
};
