import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useProfileDevicePresetsQuery } from '@/entities/profile/model/use-profile-device-presets-query';
import type { ResourceProgressState } from '@/entities/resource/model/types';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useResourceActions } from '@/features/resource/model/use-resource-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { SETTINGS_RECYCLE_BIN_PATH } from '@/app/workspace-routes';
import { SettingsPage } from '@/features/settings/ui/settings-page';

export function SettingsRoutePage() {
	const { theme, navigation } = useOutletContext<WorkspaceOutletContext>();
	const [resourceProgress, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const resourcesQuery = useResourcesQuery();
	const devicePresetsQuery = useProfileDevicePresetsQuery();
	const resources = resourcesQuery.data ?? [];
	const devicePresets = devicePresetsQuery.data ?? [];
	const { refreshResources, refreshDevicePresets, refreshProfilesAndBindings } = useWorkspaceRefresh();
	const profileActions = useProfileActions({
		setActionState: () => {},
		withProfileActionLock: async (_profileId, action) => action(),
		setResourceProgress,
		refreshProfilesAndBindings,
		refreshGroups: async () => {},
		refreshWindows: async () => {},
		refreshResources,
		refreshDevicePresets,
	});
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
			onActivateChromium={resourceActions.activateChromium}
			onDownloadResource={resourceActions.downloadResource}
			resourceProgress={resourceProgress}
			devicePresets={devicePresets}
			onCreateDevicePreset={profileActions.createDevicePreset}
			onUpdateDevicePreset={profileActions.updateDevicePreset}
			onRefreshDevicePresets={refreshDevicePresets}
			onOpenRecycleBin={() => navigation.onNavigate(SETTINGS_RECYCLE_BIN_PATH)}
		/>
	);
}
