import { useCallback, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { buildSyncTargetItems } from '@/entities/window-session/model/build-sync-target-items';
import { useDisplayMonitorsQuery } from '@/entities/window-session/model/use-display-monitors-query';
import { useSyncTargetsQuery } from '@/entities/window-session/model/use-sync-targets-query';
import { useWindowSyncActions } from '@/features/window-session/model/use-window-sync-actions';
import { WindowsPage } from '@/features/window-session/ui/windows-page';
import { useSyncManagerStore } from '@/store/sync-manager-store';

export function WindowsRoutePage() {
	const { navigation: _ } = useOutletContext<WorkspaceOutletContext>();
	const profilesQuery = useProfilesQuery();
	const localTargetsQuery = useSyncTargetsQuery();
	useDisplayMonitorsQuery(); // preload for browser-control
	const profiles = profilesQuery.data ?? [];
	const localTargets = localTargetsQuery.data?.items ?? [];
	const { refreshWindows, refreshWindowsStable, refreshProfilesAndBindings } =
		useWorkspaceRefresh();
	const syncConnectionStatus = useSyncManagerStore((state) => state.connectionStatus);
	const sidecarPort = useSyncManagerStore((state) => state.sidecarPort);
	const sessionPayload = useSyncManagerStore((state) => state.sessionPayload);
	const recentWarnings = useSyncManagerStore((state) => state.recentWarnings);
	const syncLastError = useSyncManagerStore((state) => state.lastError);
	const syncInstances = useSyncManagerStore((state) => state.instances);
	const ensureSyncConnected = useSyncManagerStore((state) => state.ensureConnected);
	const syncLocalTargets = useSyncManagerStore((state) => state.syncLocalTargets);

	const syncActions = useWindowSyncActions({
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});

	const windowStates = useMemo(
		() => buildSyncTargetItems(localTargets, syncInstances, sessionPayload),
		[localTargets, sessionPayload, syncInstances],
	);

	useEffect(() => {
		void ensureSyncConnected();
	}, [ensureSyncConnected]);

	useEffect(() => {
		void syncLocalTargets(localTargets);
	}, [localTargets, syncLocalTargets]);

	const refreshSyncAwareWindows = useCallback(async () => {
		await refreshWindows();
		await syncLocalTargets(localTargets);
	}, [localTargets, refreshWindows, syncLocalTargets]);

	return (
		<WindowsPage
			profiles={profiles}
			windowStates={windowStates}
			syncConnectionStatus={syncConnectionStatus}
			sidecarPort={sidecarPort}
			sessionPayload={sessionPayload}
			recentWarnings={recentWarnings}
			syncLastError={syncLastError}
			onRefreshWindows={refreshSyncAwareWindows}
			onStartSync={syncActions.startSync}
			onStopSync={syncActions.stopSync}
			onRestartSync={syncActions.restartSync}
		/>
	);
}
