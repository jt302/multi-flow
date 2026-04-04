import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import type { SettingsPageProps } from '@/features/settings/model/types';
import {
	getSettingsTabs,
	DEFAULT_SETTINGS_TAB,
	type SettingsTabId,
} from './settings-tab-constants';
import { ThemeCustomizerCard } from './theme-customizer-card';
import { AiProviderConfigCard } from './ai-provider-config-card';
import { CaptchaSolverConfigCard } from './captcha-solver-config-card';
import { ResourceManagementCard } from './resource-management-card';
import { GeneralSettingsPlaceholder } from './general-settings-placeholder';
import { RecycleBinRoutePage } from '@/pages/recycle-bin';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
	onDownloadResource,
	resourceProgress,
}: SettingsPageProps) {
	const { t } = useTranslation('settings');
	const section = getWorkspaceSections().settings;
	const settingsTabs = getSettingsTabs();
	const [pendingKey, setPendingKey] = useState('');
	const [activeTab, setActiveTabRaw] = useState<SettingsTabId>(() => {
		const saved = localStorage.getItem('mf_settings_tab');
		return settingsTabs.some((t) => t.id === saved)
			? (saved as SettingsTabId)
			: DEFAULT_SETTINGS_TAB;
	});
	const setActiveTab = (tab: SettingsTabId) => {
		setActiveTabRaw(tab);
		localStorage.setItem('mf_settings_tab', tab);
	};

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
				label={t('general.title')}
				title={section.title}
				description={section.desc}
			/>

			<div className="grid grid-cols-[11rem_1fr] gap-4 flex-1 min-h-0">
				{/* 左侧 Tab 导航 */}
				<nav className="flex flex-col self-start h-fit rounded-xl border border-border/40 bg-card/60 backdrop-blur-md p-2 gap-0.5">
					{settingsTabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer',
								activeTab === tab.id
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
							)}
						>
							<Icon icon={tab.icon} size={15} />
							{tab.label}
						</button>
					))}
				</nav>

				{/* 右侧内容区 */}
				<ScrollArea className="min-h-0 min-w-0 w-full">
					<div className="pr-1">
						{activeTab === 'general' && <GeneralSettingsPlaceholder />}

						{activeTab === 'appearance' && (
							<ThemeCustomizerCard
								useCustomColor={useCustomColor}
								preset={preset}
								customColor={customColor}
								onPresetChange={onPresetChange}
								onCustomColorChange={onCustomColorChange}
								onToggleCustomColor={onToggleCustomColor}
							/>
						)}

						{activeTab === 'resources' && (
							<ResourceManagementCard
								chromiumItems={chromiumItems}
								geoItems={geoItems}
								pendingKey={pendingKey}
								resourceProgress={resourceProgress}
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
								<CaptchaSolverConfigCard />
							</div>
						)}

						{activeTab === 'recycle-bin' && <RecycleBinRoutePage />}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
