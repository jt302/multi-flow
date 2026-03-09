import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useGroupActions } from '@/features/group/model/use-group-actions';
import { useProfileRunningRecovery } from '@/features/profile/model/use-profile-running-recovery';
import { useProfileDevicePresetsQuery } from '@/entities/profile/model/use-profile-device-presets-query';
import { useProfileProxyBindingsQuery } from '@/entities/profile/model/use-profile-proxy-bindings-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useProxyActions } from '@/features/proxy/model/use-proxy-actions';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import type { ResourceProgressState } from '@/entities/resource/model/types';
import { useResourceActions } from '@/features/resource/model/use-resource-actions';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';
import { useConsoleRefresh } from './use-console-refresh';
import type { ProfileActionState } from '@/entities/profile/model/types';

export function useConsoleState() {
	const [isRunning, setIsRunning] = useState(true);
	const [profileActionStates, setProfileActionStates] = useState<Record<string, ProfileActionState>>({});
	const [resourceProgress, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const profileActionLocksRef = useRef<Set<string>>(new Set());
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const profileActionStatesRef = useRef<Record<string, ProfileActionState>>({});

	const groupsQuery = useGroupsQuery();
	const profilesQuery = useProfilesQuery();
	const proxiesQuery = useProxiesQuery();
	const resourcesQuery = useResourcesQuery();
	const devicePresetsQuery = useProfileDevicePresetsQuery();
	const windowStatesQuery = useWindowStatesQuery();
	const activeProfileIds = useMemo(
		() =>
			(profilesQuery.data ?? [])
				.filter((item) => item.lifecycle === 'active')
				.map((item) => item.id),
		[profilesQuery.data],
	);
	const bindingsQuery = useProfileProxyBindingsQuery(activeProfileIds);

	const groups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[groupsQuery.data],
	);
	const deletedGroups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'deleted'),
		[groupsQuery.data],
	);
	const profiles = profilesQuery.data ?? [];
	const proxies = proxiesQuery.data ?? [];
	const resources = resourcesQuery.data ?? [];
	const devicePresets = devicePresetsQuery.data ?? [];
	const windowStates = windowStatesQuery.data ?? [];
	const profileProxyBindings = bindingsQuery.data ?? {};
	const {
		refreshGroups,
		refreshProxies,
		refreshResources,
		refreshDevicePresets,
		refreshWindows,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	} = useConsoleRefresh();

	useEffect(() => {
		profileActionStatesRef.current = profileActionStates;
	}, [profileActionStates]);

	const setActionState = useCallback((profileId: string, state: ProfileActionState | null) => {
		setProfileActionStates((prev) => {
			if (state === null) {
				if (!(profileId in prev)) {
					return prev;
				}
				const next = { ...prev };
				delete next[profileId];
				return next;
			}
			return { ...prev, [profileId]: state };
		});
	}, []);

	const withProfileActionLock = useCallback(async (profileId: string, action: () => Promise<void>) => {
		if (profileActionLocksRef.current.has(profileId)) {
			return;
		}
		profileActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			profileActionLocksRef.current.delete(profileId);
		}
	}, []);

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
	useProfileRunningRecovery({
		profiles,
		profileActionStatesRef,
		profileActionLocksRef,
		setActionState,
	});
	const { createGroup, updateGroup, deleteGroup, restoreGroup } = useGroupActions({
		refreshGroups,
		refreshProfiles: refreshProfilesAndBindings,
	});
	const {
		createProfile,
		createDevicePreset,
		updateDevicePreset,
		updateProfile,
		updateProfileVisual,
		openProfile,
		closeProfile,
		deleteProfile,
		restoreProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		setProfileGroup,
		batchSetProfileGroup,
	} = useProfileActions({
		setActionState,
		withProfileActionLock,
		setResourceProgress,
		refreshProfilesAndBindings,
		refreshGroups,
		refreshWindows,
		refreshResources,
		refreshDevicePresets,
	});
	const {
		createProxy,
		updateProxy,
		deleteProxy,
		batchDeleteProxies,
		restoreProxy,
		batchUpdateProxies,
		importProxies,
		checkProxy,
		batchCheckProxies,
		bindProfileProxy,
		unbindProfileProxy,
	} = useProxyActions({
		refreshProxies,
		refreshProfilesAndBindings,
	});
	const { installChromium, activateChromium, downloadResource } = useResourceActions({
		setResourceProgress,
		refreshResources,
	});
	const {
		openTab,
		closeTab,
		closeInactiveTabs,
		activateTab,
		activateTabByIndex,
		openWindow,
		closeWindow,
		focusWindow,
		setWindowBounds,
		batchOpenTabs,
		batchCloseTabs,
		batchCloseInactiveTabs,
		batchOpenWindows,
		batchFocusWindows,
	} = useWindowActions({
		withWindowActionLock,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});

	return {
		isRunning,
		setIsRunning,
		groups,
		deletedGroups,
		profiles,
		profileActionStates,
		proxies,
		profileProxyBindings,
		resources,
		resourceProgress,
		devicePresets,
		windowStates,
		createGroup,
		updateGroup,
		deleteGroup,
		restoreGroup,
		createProfile,
		updateProfile,
		updateProfileVisual,
		openProfile,
		closeProfile,
		deleteProfile,
		restoreProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		setProfileGroup,
		batchSetProfileGroup,
		createDevicePreset,
		updateDevicePreset,
		createProxy,
		updateProxy,
		deleteProxy,
		batchDeleteProxies,
		restoreProxy,
		batchUpdateProxies,
		importProxies,
		checkProxy,
		batchCheckProxies,
		bindProfileProxy,
		unbindProfileProxy,
		refreshProfiles: refreshProfilesAndBindings,
		refreshGroups,
		refreshProxies,
		refreshResources,
		refreshDevicePresets,
		refreshWindows,
		installChromium,
		activateChromium,
		downloadResource,
		openTab,
		closeTab,
		closeInactiveTabs,
		activateTab,
		activateTabByIndex,
		openWindow,
		closeWindow,
		focusWindow,
		setWindowBounds,
		batchOpenTabs,
		batchCloseTabs,
		batchCloseInactiveTabs,
		batchOpenWindows,
		batchFocusWindows,
	};
}
