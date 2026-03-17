import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useDisplayMonitorsQuery } from '@/entities/window-session/model/use-display-monitors-query';
import { useSyncTargetsQuery } from '@/entities/window-session/model/use-sync-targets-query';
import type {
	LocalSyncTargetItem,
	SyncManagerInstanceInfo,
	SyncSessionPayload,
	SyncTargetItem,
} from '@/entities/window-session/model/types';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWindowSyncActions } from '@/features/window-session/model/use-window-sync-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { NAV_PATHS } from '@/app/workspace-routes';
import { WindowsPage } from '@/features/window-session/ui/windows-page';
import { useSyncManagerStore } from '@/store/sync-manager-store';

function isProbeReady(instance?: SyncManagerInstanceInfo | null) {
	return instance?.status === 'online';
}

function buildSyncTargetItems(
	localTargets: LocalSyncTargetItem[],
	instances: Record<string, SyncManagerInstanceInfo>,
	sessionPayload: SyncSessionPayload | null,
): SyncTargetItem[] {
	const session = sessionPayload?.session;
	const slaveIds = new Set(session?.slaveIds ?? []);
	return localTargets.map((target) => {
		const instance = instances[target.profileId];
		return {
			...target,
			syncRole:
				session?.masterId === target.profileId
					? 'master'
					: slaveIds.has(target.profileId)
						? 'slave'
						: 'none',
			instanceStatus: instance?.status ?? 'unknown',
			platform: instance?.platform ?? null,
			wsStatusVerified: instance?.wsStatusVerified ?? false,
			lastProbeError: instance?.lastProbeError ?? null,
			lastDropReason: instance?.lastDropReason ?? null,
			boundBrowserId: instance?.boundBrowserId ?? null,
			boundWindowToken: instance?.boundWindowToken ?? null,
			coordinateMode: instance?.coordinateMode ?? null,
			activeBrowser: instance?.activeBrowser ?? null,
			isProbeReady: isProbeReady(instance),
		};
	});
}

export function WindowsRoutePage() {
	const { navigation } = useOutletContext<WorkspaceOutletContext>();
	const profilesQuery = useProfilesQuery();
	const localTargetsQuery = useSyncTargetsQuery();
	const displayMonitorsQuery = useDisplayMonitorsQuery();
	const profiles = profilesQuery.data ?? [];
	const localTargets = localTargetsQuery.data?.items ?? [];
	const displayMonitors = displayMonitorsQuery.data ?? [];
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const { refreshWindows, refreshWindowsStable, refreshProfilesAndBindings } = useWorkspaceRefresh();
	const syncConnectionStatus = useSyncManagerStore((state) => state.connectionStatus);
	const sidecarPort = useSyncManagerStore((state) => state.sidecarPort);
	const sessionPayload = useSyncManagerStore((state) => state.sessionPayload);
	const recentWarnings = useSyncManagerStore((state) => state.recentWarnings);
	const syncLastError = useSyncManagerStore((state) => state.lastError);
	const syncInstances = useSyncManagerStore((state) => state.instances);
	const ensureSyncConnected = useSyncManagerStore((state) => state.ensureConnected);
	const syncLocalTargets = useSyncManagerStore((state) => state.syncLocalTargets);
	const withWindowActionLock = useCallback(async (profileId: string, action: () => Promise<void>) => {
		if (windowActionLocksRef.current.has(profileId)) {
			return;
		}
		windowActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			windowActionLocksRef.current.delete(profileId);
		}
	}, []);
	const windowActions = useWindowActions({
		withWindowActionLock,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});
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
			displayMonitors={displayMonitors}
			syncConnectionStatus={syncConnectionStatus}
			sidecarPort={sidecarPort}
			sessionPayload={sessionPayload}
			recentWarnings={recentWarnings}
			syncLastError={syncLastError}
			onRefreshWindows={refreshSyncAwareWindows}
			onViewProfile={(profileId) => {
				navigation.onSetProfileNavigationIntent({ profileId, view: 'detail' });
				navigation.onNavigate(NAV_PATHS.profiles);
			}}
			onStartSync={syncActions.startSync}
			onStopSync={syncActions.stopSync}
			onRestartSync={syncActions.restartSync}
			onBroadcastSyncText={syncActions.sendSyncText}
			onBatchRestoreWindows={syncActions.restoreWindows}
			onBatchSetWindowBounds={syncActions.applyUniformBounds}
			onArrangeWindows={syncActions.arrangeWindows}
			onOpenTab={windowActions.openTab}
			onCloseTab={windowActions.closeTab}
			onCloseInactiveTabs={windowActions.closeInactiveTabs}
			onActivateTab={windowActions.activateTab}
			onActivateTabByIndex={windowActions.activateTabByIndex}
			onOpenWindow={windowActions.openWindow}
			onCloseWindow={windowActions.closeWindow}
			onFocusWindow={windowActions.focusWindow}
			onSetWindowBounds={windowActions.setWindowBounds}
			onBatchOpenTabs={windowActions.batchOpenTabs}
			onBatchCloseTabs={windowActions.batchCloseTabs}
			onBatchCloseInactiveTabs={windowActions.batchCloseInactiveTabs}
			onBatchOpenWindows={windowActions.batchOpenWindows}
			onBatchFocusWindows={windowActions.batchFocusWindows}
		/>
	);
}
