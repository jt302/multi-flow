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
import { AiProviderConfigCard } from './ai-provider-config-card';
import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
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
	onDownloadResource,
	resourceProgress,
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onRefreshDevicePresets,
	onOpenRecycleBin,
}: SettingsPageProps) {
	const section = WORKSPACE_SECTIONS.settings;
	const [pendingKey, setPendingKey] = useState('');

	const chromiumItems = useMemo(
		() => resources.filter((item) => item.kind === 'chromium'),
		[resources],
	);
	const geoItems = useMemo(
		() => resources.filter((item) => item.kind === 'geoip_mmdb'),
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
		<div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
			<ActiveSectionCard label="通用设置" title={section.title} description={section.desc} />

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
				<div className="space-y-6">
				<ThemeCustomizerCard
					useCustomColor={useCustomColor}
					preset={preset}
					customColor={customColor}
					onPresetChange={onPresetChange}
					onCustomColorChange={onCustomColorChange}
					onToggleCustomColor={onToggleCustomColor}
				/>
				<AiProviderConfigCard />
				</div>
				<div className="space-y-6">
					<ResourceManagementCard
						chromiumItems={chromiumItems}
						geoItems={geoItems}
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
						onDownloadResource={(resourceId, label) => {
							void runAction(`download-${resourceId}`, () => onDownloadResource(resourceId, label));
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

					<Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm transition-all duration-300">
						<CardHeader className="p-4 pb-2 border-b border-border/40">
							<CardTitle className="text-sm font-medium">高级维护</CardTitle>
						</CardHeader>
						<CardContent className="p-4 pt-4 flex items-center justify-between">
							<div className="space-y-1">
								<p className="text-sm font-medium leading-none">回收站</p>
								<p className="text-xs text-muted-foreground">恢复或彻底删除已归档的数据</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="cursor-pointer border-border/40 bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm transition-all hover:scale-105"
								onClick={onOpenRecycleBin}
								disabled={!onOpenRecycleBin}
							>
								<Icon icon={Trash2} size={14} className="mr-1" />
								打开回收站
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
