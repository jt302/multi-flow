import { useMemo } from 'react';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { PluginsPage } from '@/features/plugin/ui/plugins-page';

export function PluginsRoutePage() {
	const profilesQuery = useProfilesQuery();
	const groupsQuery = useGroupsQuery();
	const { refreshProfilesAndBindings, refreshGroups } = useWorkspaceRefresh();

	const profiles = profilesQuery.data ?? [];
	const groups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[groupsQuery.data],
	);

	return (
		<PluginsPage
			profiles={profiles}
			groups={groups}
			onRefreshProfiles={async () => {
				await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			}}
		/>
	);
}
