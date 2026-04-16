import type { ResourceItem, ResourceProgressState } from '@/entities/resource/model/types';
import type {
	CustomThemePreset,
	PresetKey,
} from '@/entities/theme/model/types';

export type ThemeCustomizerCardProps = {
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	customPresets: CustomThemePreset[];
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	onAddCustomPreset: () => void;
	onApplyCustomPreset: (value: CustomThemePreset) => void;
	onDeleteCustomPreset: (value: CustomThemePreset) => void;
};

export type SettingsPageProps = {
	useCustomColor: boolean;
	preset: PresetKey;
	customColor: string;
	customPresets: CustomThemePreset[];
	onPresetChange: (preset: PresetKey) => void;
	onCustomColorChange: (value: string) => void;
	onToggleCustomColor: () => void;
	onAddCustomPreset: () => void;
	onApplyCustomPreset: (value: CustomThemePreset) => void;
	onDeleteCustomPreset: (value: CustomThemePreset) => void;
	resources: ResourceItem[];
	onRefreshResources: () => Promise<void>;
	onInstallChromium: (resourceId: string) => Promise<void>;
	onDownloadResource: (resourceId: string, label?: string) => Promise<void>;
	resourceProgress: ResourceProgressState | null;
};
