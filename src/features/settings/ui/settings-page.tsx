import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
} from '@/components/ui';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { DevicePresetManagerCard } from './device-preset-manager-card';
import { ResourceManagementCard } from './resource-management-card';
import { ThemeCustomizerCard } from './theme-customizer-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { SettingsPageProps } from '@/features/settings/model/types';

function formatBytes(input: number | null): string {
	if (input === null || input <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = input;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}


export function SettingsPage({
	useCustomColor,
	preset,
	customColor,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
	resources,
	onRefreshResources,
	onInstallChromium,
	onActivateChromium,
	resourceProgress,
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onRefreshDevicePresets,
	onOpenRecycleBin,
}: SettingsPageProps) {
	const section = CONSOLE_NAV_SECTIONS.settings;
	const [pendingKey, setPendingKey] = useState('');

	const chromiumItems = useMemo(
		() => resources.filter((item) => item.kind === 'chromium'),
		[resources],
	);

	const runAction = async (key: string, action: () => Promise<void>) => {
		if (pendingKey) {
			return;
		}
		setPendingKey(key);
		try {
			await action();
		} finally {
			setPendingKey('');
		}
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="设置" title={section.title} description={section.desc} />

			<div className="space-y-3">
				<ThemeCustomizerCard
					useCustomColor={useCustomColor}
					preset={preset}
					customColor={customColor}
					onPresetChange={onPresetChange}
					onCustomColorChange={onCustomColorChange}
					onToggleCustomColor={onToggleCustomColor}
				/>

				<ResourceManagementCard
					chromiumItems={chromiumItems}
					pendingKey={pendingKey}
					resourceProgress={resourceProgress}
					onRefreshResources={() => {
						void runAction('refresh-resources', onRefreshResources);
					}}
					onInstallChromium={(resourceId) => {
						void runAction(`install-${resourceId}`, () => onInstallChromium(resourceId));
					}}
					onActivateChromium={(version) => {
						void runAction(`activate-${version}`, () => onActivateChromium(version));
					}}
					formatBytes={formatBytes}
				/>

				<DevicePresetManagerCard
					devicePresets={devicePresets}
					pendingKey={pendingKey}
					onRefreshDevicePresets={onRefreshDevicePresets}
					onCreateDevicePreset={onCreateDevicePreset}
					onUpdateDevicePreset={onUpdateDevicePreset}
				/>

				<Card className="p-4">
					<CardHeader className="p-0">
						<CardTitle className="text-sm">维护</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-3">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer text-muted-foreground hover:text-foreground"
							onClick={onOpenRecycleBin}
							disabled={!onOpenRecycleBin}
						>
							<Icon icon={Trash2} size={12} />
							打开回收站
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
