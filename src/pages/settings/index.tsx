import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import type { ResourceProgressState } from '@/entities/resource/model/types';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useResourceActions } from '@/features/resource/model/use-resource-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { SettingsPage } from '@/features/settings/ui/settings-page';

export function SettingsRoutePage() {
	const { theme } = useOutletContext<WorkspaceOutletContext>();
	const [resourceProgress, setResourceProgress] =
		useState<ResourceProgressState | null>(null);
	const resourcesQuery = useResourcesQuery();
	const resources = resourcesQuery.data ?? [];
	const { refreshResources } = useWorkspaceRefresh();
	const resourceActions = useResourceActions({
		setResourceProgress,
		refreshResources,
	});

	return (
		<SettingsPage
			useCustomColor={theme.useCustomColor}
			preset={theme.preset}
			customColor={theme.customColor}
			onPresetChange={theme.onPresetChange}
			onCustomColorChange={theme.onCustomColorChange}
			onToggleCustomColor={theme.onToggleCustomColor}
			resources={resources}
			onRefreshResources={refreshResources}
			onInstallChromium={resourceActions.installChromium}
			onDownloadResource={resourceActions.downloadResource}
			resourceProgress={resourceProgress}
		/>
	);
}
