import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import type { SettingsPageProps } from '@/features/settings/model/types';
import {
	getSettingsTabs,
} from './settings-tab-constants';
import { ThemeCustomizerCard } from './theme-customizer-card';
import { AiProviderConfigCard } from './ai-provider-config-card';
import { AiChatGlobalPromptCard } from './ai-chat-global-prompt-card';
import { AiChatSettingsCard } from './ai-chat-settings-card';
import { CaptchaSolverConfigCard } from './captcha-solver-config-card';
import { ToolPermissionsCard } from './tool-permissions-card';
import { ResourceManagementCard } from './resource-management-card';
import { GeneralSettingsPlaceholder } from './general-settings-placeholder';
import { RecycleBinRoutePage } from '@/pages/recycle-bin';
import { DevConfigCard } from './dev-config-card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SettingsPage({
	activeTab,
	useCustomColor,
	preset,
	customColor,
	customPresets,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
	onAddCustomPreset,
	onApplyCustomPreset,
	onDeleteCustomPreset,
	resources,
	onRefreshResources,
	onInstallChromium,
	onDownloadResource,
}: SettingsPageProps) {
	const { t } = useTranslation('settings');
	const section = getWorkspaceSections().settings;
	const [pendingKey, setPendingKey] = useState('');
	const activeTabItem =
		getSettingsTabs().find((tab) => tab.id === activeTab) ?? getSettingsTabs()[0];

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
		<div className="flex h-full min-h-0 w-full flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
			<ActiveSectionCard
				label={activeTabItem.label}
				title={section.title}
				description={t(`tabDescriptions.${activeTab}` as const, {
					defaultValue: section.desc,
				})}
			/>

			<ScrollArea className="min-h-0 min-w-0 w-full flex-1">
				<div className="pr-1">
					{activeTab === 'general' && <GeneralSettingsPlaceholder />}

					{activeTab === 'appearance' && (
						<ThemeCustomizerCard
							useCustomColor={useCustomColor}
							preset={preset}
							customColor={customColor}
							customPresets={customPresets}
							onPresetChange={onPresetChange}
							onCustomColorChange={onCustomColorChange}
							onToggleCustomColor={onToggleCustomColor}
							onAddCustomPreset={onAddCustomPreset}
							onApplyCustomPreset={onApplyCustomPreset}
							onDeleteCustomPreset={onDeleteCustomPreset}
						/>
					)}

					{activeTab === 'resources' && (
						<ResourceManagementCard
							chromiumItems={chromiumItems}
							geoItems={geoItems}
							pendingKey={pendingKey}
							onRefreshResources={() => {
								void runAction('refresh-resources', onRefreshResources);
							}}
							onInstallChromium={(resourceId) => {
								void runAction(`install-${resourceId}`, () =>
									onInstallChromium(resourceId),
								);
							}}
							onDownloadResource={(resourceId, label) => {
								void runAction(`download-${resourceId}`, () =>
									onDownloadResource(resourceId, label),
								);
							}}
						/>
					)}

					{activeTab === 'ai' && (
						<div className="space-y-4">
							<AiProviderConfigCard />
							<AiChatSettingsCard />
							<AiChatGlobalPromptCard />
							<CaptchaSolverConfigCard />
							<ToolPermissionsCard />
						</div>
					)}

					{activeTab === 'recycle-bin' && <RecycleBinRoutePage />}

					{import.meta.env.DEV && activeTab === 'dev' && <DevConfigCard />}
				</div>
			</ScrollArea>
		</div>
	);
}
