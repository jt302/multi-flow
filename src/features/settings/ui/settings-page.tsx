import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkspaceSection } from '@/app/model/workspace-sections';
import { PageLoadingState } from '@/components/common';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SettingsPageProps } from '@/features/settings/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getSettingsTabs } from './settings-tab-constants';

const GeneralSettingsPlaceholder = lazy(() =>
	import('./general-settings-placeholder').then((module) => ({
		default: module.GeneralSettingsPlaceholder,
	})),
);
const ThemeCustomizerCard = lazy(() =>
	import('./theme-customizer-card').then((module) => ({
		default: module.ThemeCustomizerCard,
	})),
);
const ResourceManagementCard = lazy(() =>
	import('./resource-management-card').then((module) => ({
		default: module.ResourceManagementCard,
	})),
);
const AiSettingsPanel = lazy(() =>
	import('./ai-settings-panel').then((module) => ({
		default: module.AiSettingsPanel,
	})),
);
const RecycleBinRoutePage = lazy(() =>
	import('@/pages/recycle-bin').then((module) => ({
		default: module.RecycleBinRoutePage,
	})),
);
const DevConfigCard = lazy(() =>
	import('./dev-config-card').then((module) => ({
		default: module.DevConfigCard,
	})),
);

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
	const { t } = useTranslation(['settings', 'common']);
	const section = getWorkspaceSection('settings');
	const [pendingKey, setPendingKey] = useState('');
	const settingsTabs = useMemo(() => getSettingsTabs(), []);
	const activeTabItem = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];

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
					<Suspense fallback={<PageLoadingState label={t('common:loading')} />}>
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
								onInstallChromium={(resourceId, options) => {
									const actionKey = options?.force
										? `redownload-${resourceId}`
										: `install-${resourceId}`;
									void runAction(actionKey, () => onInstallChromium(resourceId, options));
								}}
								onDownloadResource={(resourceId, label) => {
									void runAction(`download-${resourceId}`, () =>
										onDownloadResource(resourceId, label),
									);
								}}
							/>
						)}

						{activeTab === 'ai' && <AiSettingsPanel />}

						{activeTab === 'recycle-bin' && <RecycleBinRoutePage />}

						{import.meta.env.DEV && activeTab === 'dev' && <DevConfigCard />}
					</Suspense>
				</div>
			</ScrollArea>
		</div>
	);
}
