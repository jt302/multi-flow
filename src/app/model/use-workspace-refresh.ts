import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { ProfileItem, ProfileProxyBindingMap } from '@/entities/profile/model/types';
import { listProfileProxyBindings } from '@/entities/proxy/api/proxy-api';
import { queryKeys } from '@/shared/config/query-keys';

async function refetchExactQuery(
	queryClient: ReturnType<typeof useQueryClient>,
	queryKey: readonly unknown[],
) {
	await queryClient.invalidateQueries({ queryKey, exact: true });
	await queryClient.refetchQueries({ queryKey, exact: true, type: 'active' });
}

export function useWorkspaceRefresh() {
	const queryClient = useQueryClient();

	const refreshGroups = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.groups);
	}, [queryClient]);

	const refreshProfiles = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.profiles);
		return queryClient.getQueryData<ProfileItem[]>(queryKeys.profiles) ?? [];
	}, [queryClient]);

	const refreshProxies = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.proxies);
	}, [queryClient]);

	const refreshResources = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.resources);
	}, [queryClient]);

	const refreshDevicePresets = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.devicePresets);
	}, [queryClient]);

	const refreshWindows = useCallback(async () => {
		await Promise.all([
			refetchExactQuery(queryClient, queryKeys.windowStates),
			refetchExactQuery(queryClient, queryKeys.syncTargets),
		]);
	}, [queryClient]);

	const refreshDisplayMonitors = useCallback(async () => {
		await refetchExactQuery(queryClient, queryKeys.displayMonitors);
	}, [queryClient]);

	const refreshWindowsStable = useCallback(async () => {
		await refreshWindows();
		await new Promise((resolve) => window.setTimeout(resolve, 220));
		await refreshWindows();
	}, [refreshWindows]);

	const refreshBindingsByProfileIds = useCallback(
		async (profileIds: string[]) => {
			if (profileIds.length === 0) {
				return {} satisfies ProfileProxyBindingMap;
			}

			const queryKey = queryKeys.profileProxyBindings(profileIds);
			return queryClient.fetchQuery({
				queryKey,
				queryFn: () => listProfileProxyBindings(profileIds),
			});
		},
		[queryClient],
	);

	const refreshBindingsByProfiles = useCallback(
		async (profiles: ProfileItem[]) => {
			const profileIds = profiles
				.filter((item) => item.lifecycle === 'active')
				.map((item) => item.id);
			return refreshBindingsByProfileIds(profileIds);
		},
		[refreshBindingsByProfileIds],
	);

	const refreshProfilesAndBindings = useCallback(async () => {
		const profiles = await refreshProfiles();
		await refreshBindingsByProfiles(profiles);
	}, [refreshBindingsByProfiles, refreshProfiles]);

	return {
		refreshGroups,
		refreshProfiles,
		refreshProxies,
		refreshResources,
		refreshDevicePresets,
		refreshWindows,
		refreshWindowsStable,
		refreshDisplayMonitors,
		refreshBindingsByProfileIds,
		refreshBindingsByProfiles,
		refreshProfilesAndBindings,
	};
}
