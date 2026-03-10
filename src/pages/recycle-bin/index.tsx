import { useState } from 'react';

import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import type { ResourceProgressState } from '@/entities/resource/model/types';
import { useGroupActions } from '@/features/group/model/use-group-actions';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useProxyActions } from '@/features/proxy/model/use-proxy-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { RecycleBinPage } from '@/features/recycle-bin/ui/recycle-bin-page';

export function RecycleBinRoutePage() {
	const profilesQuery = useProfilesQuery();
	const proxiesQuery = useProxiesQuery();
	const groupsQuery = useGroupsQuery();
	const [, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const profiles = profilesQuery.data ?? [];
	const proxies = proxiesQuery.data ?? [];
	const groups = (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'deleted');
	const { refreshProfilesAndBindings, refreshProxies, refreshGroups, refreshWindows } = useWorkspaceRefresh();
	const profileActions = useProfileActions({
		setActionState: () => {},
		withProfileActionLock: async (_profileId, action) => action(),
		setResourceProgress,
		refreshProfilesAndBindings,
		refreshGroups,
		refreshWindows,
		refreshResources: async () => {},
		refreshDevicePresets: async () => {},
	});
	const proxyActions = useProxyActions({
		refreshProxies,
		refreshProfilesAndBindings,
	});
	const groupActions = useGroupActions({
		refreshGroups,
		refreshProfiles: refreshProfilesAndBindings,
	});

	return (
		<RecycleBinPage
			profiles={profiles}
			proxies={proxies}
			groups={groups}
			onRestoreProfile={profileActions.restoreProfile}
			onPurgeProfile={profileActions.purgeProfile}
			onRestoreProxy={proxyActions.restoreProxy}
			onPurgeProxy={proxyActions.purgeProxy}
			onRestoreGroup={groupActions.restoreGroup}
			onPurgeGroup={groupActions.purgeGroup}
			onRefreshAll={async () => {
				await Promise.all([
					refreshProfilesAndBindings(),
					refreshProxies(),
					refreshGroups(),
					refreshWindows(),
				]);
			}}
		/>
	);
}
