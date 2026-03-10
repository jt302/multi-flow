import { useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { NAV_PATHS } from '@/app/workspace-routes';
import { WindowsPage } from '@/features/window-session/ui/windows-page';

export function WindowsRoutePage() {
	const { navigation } = useOutletContext<WorkspaceOutletContext>();
	const profilesQuery = useProfilesQuery();
	const windowStatesQuery = useWindowStatesQuery();
	const profiles = profilesQuery.data ?? [];
	const windowStates = windowStatesQuery.data ?? [];
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const { refreshWindows, refreshWindowsStable, refreshProfilesAndBindings } = useWorkspaceRefresh();
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

	return (
		<WindowsPage
			profiles={profiles}
			windowStates={windowStates}
			onRefreshWindows={refreshWindows}
			onViewProfile={(profileId) => {
				navigation.onSetProfileNavigationIntent({ profileId, view: 'detail' });
				navigation.onNavigate(NAV_PATHS.profiles);
			}}
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
