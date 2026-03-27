import { useProfileDevicePresetsQuery } from '@/entities/profile/model/use-profile-device-presets-query';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { DevicePresetsPage } from '@/features/device-presets/ui/device-presets-page';

export function DevicePresetsRoutePage() {
	const devicePresetsQuery = useProfileDevicePresetsQuery();
	const devicePresets = devicePresetsQuery.data ?? [];
	const { refreshDevicePresets, refreshProfilesAndBindings } = useWorkspaceRefresh();

	const profileActions = useProfileActions({
		setActionState: () => {},
		withProfileActionLock: async (_profileId, action) => action(),
		setResourceProgress: () => {},
		refreshProfilesAndBindings,
		refreshGroups: async () => {},
		refreshWindows: async () => {},
		refreshResources: async () => {},
		refreshDevicePresets,
	});

	return (
		<DevicePresetsPage
			devicePresets={devicePresets}
			onCreateDevicePreset={profileActions.createDevicePreset}
			onUpdateDevicePreset={profileActions.updateDevicePreset}
			onDeleteDevicePreset={profileActions.deleteDevicePreset}
			onRefreshDevicePresets={refreshDevicePresets}
		/>
	);
}
