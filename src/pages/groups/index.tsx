import { createSearchParams, useOutletContext } from 'react-router-dom';

import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useGroupActions } from '@/features/group/model/use-group-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { NAV_PATHS } from '@/app/workspace-routes';
import { GroupsPage } from '@/features/group/ui/groups-page';

export function GroupsRoutePage() {
	const { navigation } = useOutletContext<WorkspaceOutletContext>();
	const groupsQuery = useGroupsQuery();
	const { refreshGroups, refreshProfilesAndBindings } = useWorkspaceRefresh();
	const groups = (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active');
	const groupActions = useGroupActions({
		refreshGroups,
		refreshProfiles: refreshProfilesAndBindings,
	});

	return (
		<GroupsPage
			groups={groups}
			onCreateGroup={groupActions.createGroup}
			onUpdateGroup={groupActions.updateGroup}
			onDeleteGroup={groupActions.deleteGroup}
			onOpenGroupProfiles={(groupName) => {
				navigation.onSetProfileNavigationIntent(null);
				navigation.onNavigate(
					`${NAV_PATHS.profiles}?${createSearchParams({ group: groupName }).toString()}`,
				);
			}}
		/>
	);
}
