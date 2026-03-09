import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useGroupActions } from '@/features/group/model/use-group-actions';
import { useProfileDevicePresetsQuery } from '@/entities/profile/model/use-profile-device-presets-query';
import { useProfileProxyBindingsQuery } from '@/entities/profile/model/use-profile-proxy-bindings-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useProxyActions } from '@/features/proxy/model/use-proxy-actions';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import { useResourceActions } from '@/features/resource/model/use-resource-actions';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';
import type { ResourceProgressState } from '../types';
import type {
	ProfileActionState,
	ProfileItem,
} from '@/entities/profile/model/types';

type UseConsoleStateOptions = {
	onRequireSettings?: () => void;
};

export function useConsoleState(_options: UseConsoleStateOptions = {}) {
	const queryClient = useQueryClient();
	const [isRunning, setIsRunning] = useState(true);
	const [profileActionStates, setProfileActionStates] = useState<Record<string, ProfileActionState>>({});
	const [resourceProgress, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const profileActionLocksRef = useRef<Set<string>>(new Set());
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const prevProfilesRef = useRef<ProfileItem[]>([]);
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

	useEffect(() => {
		profileActionStatesRef.current = profileActionStates;
	}, [profileActionStates]);

	const setActionState = (profileId: string, state: ProfileActionState | null) => {
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
	};

	const withProfileActionLock = async (profileId: string, action: () => Promise<void>) => {
		if (profileActionLocksRef.current.has(profileId)) {
			return;
		}
		profileActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			profileActionLocksRef.current.delete(profileId);
		}
	};

	const withWindowActionLock = async (profileId: string, action: () => Promise<void>) => {
		if (windowActionLocksRef.current.has(profileId)) {
			return;
		}
		windowActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			windowActionLocksRef.current.delete(profileId);
		}
	};

	const refreshGroups = async () => {
		await groupsQuery.refetch();
	};

	const refreshProfiles = async () => {
		const result = await profilesQuery.refetch();
		const items = result.data ?? [];
		const prevMap = new Map(prevProfilesRef.current.map((item) => [item.id, item]));
		for (const item of items) {
			const prev = prevMap.get(item.id);
			const actionState = profileActionStatesRef.current[item.id];
			if (
				prev?.running &&
				!item.running &&
				!actionState &&
				!profileActionLocksRef.current.has(item.id) &&
				item.lifecycle === 'active'
			) {
				setActionState(item.id, 'recovering');
				toast.info(`环境 ${item.name} 已退出，状态已自动回收`);
				window.setTimeout(() => setActionState(item.id, null), 1800);
			}
		}
		prevProfilesRef.current = items;
		return items;
	};

	const refreshProxies = async () => {
		await proxiesQuery.refetch();
	};

	const refreshResources = async () => {
		await resourcesQuery.refetch();
	};

	const refreshDevicePresets = async () => {
		await devicePresetsQuery.refetch();
	};

	const refreshWindows = async () => {
		await windowStatesQuery.refetch();
	};

	const refreshWindowsStable = async () => {
		await refreshWindows();
		await new Promise((resolve) => window.setTimeout(resolve, 220));
		await refreshWindows();
	};

	const refreshBindingsByProfiles = async (sourceProfiles: ProfileItem[]) => {
		const profileIds = sourceProfiles
			.filter((item) => item.lifecycle === 'active')
			.map((item) => item.id);
		if (profileIds.length === 0) {
			return {};
		}
		await queryClient.invalidateQueries({ queryKey: ['profile-proxy-bindings'] });
		const result = await bindingsQuery.refetch();
		return result.data ?? {};
	};

	const refreshProfilesAndBindings = async () => {
		const items = await refreshProfiles();
		await refreshBindingsByProfiles(items);
	};

	useEffect(() => {
		const prevMap = new Map(prevProfilesRef.current.map((item) => [item.id, item]));
		for (const item of profiles) {
			const prev = prevMap.get(item.id);
			const actionState = profileActionStatesRef.current[item.id];
			if (
				prev?.running &&
				!item.running &&
				!actionState &&
				!profileActionLocksRef.current.has(item.id) &&
				item.lifecycle === 'active'
			) {
				setActionState(item.id, 'recovering');
				toast.info(`环境 ${item.name} 已退出，状态已自动回收`);
				window.setTimeout(() => setActionState(item.id, null), 1800);
			}
		}
		prevProfilesRef.current = profiles;
	}, [profiles]);
	const { createGroup, deleteGroup, restoreGroup } = useGroupActions({
		refreshGroups,
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
		deleteProxy,
		restoreProxy,
		bindProfileProxy,
		unbindProfileProxy,
	} = useProxyActions({
		refreshProxies,
		refreshProfilesAndBindings,
	});
	const { installChromium, activateChromium } = useResourceActions({
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
		createDevicePreset,
		updateDevicePreset,
		createProxy,
		deleteProxy,
		restoreProxy,
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
