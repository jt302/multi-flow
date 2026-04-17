import { useLocation, useOutletContext } from 'react-router-dom';

import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useResourceActions } from '@/features/resource/model/use-resource-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { SettingsPage } from '@/features/settings/ui/settings-page';
import { resolveSettingsTab } from '@/features/settings/ui/settings-tab-constants';

export function SettingsRoutePage() {
	const { theme } = useOutletContext<WorkspaceOutletContext>();
	const location = useLocation();
	const resourcesQuery = useResourcesQuery();
	const resources = resourcesQuery.data ?? [];
	const { refreshResources } = useWorkspaceRefresh();
	const resourceActions = useResourceActions({ refreshResources });
	const activeTab = resolveSettingsTab(location.pathname);

	return (
		<SettingsPage
			activeTab={activeTab.id}
			useCustomColor={theme.useCustomColor}
			preset={theme.preset}
			customColor={theme.customColor}
			customPresets={theme.customPresets}
			onPresetChange={theme.onPresetChange}
			onCustomColorChange={theme.onCustomColorChange}
			onToggleCustomColor={theme.onToggleCustomColor}
			onAddCustomPreset={theme.onAddCustomPreset}
			onApplyCustomPreset={theme.onApplyCustomPreset}
			onDeleteCustomPreset={theme.onDeleteCustomPreset}
			resources={resources}
			onRefreshResources={refreshResources}
			onInstallChromium={resourceActions.installChromium}
			onDownloadResource={resourceActions.downloadResource}
		/>
	);
}
