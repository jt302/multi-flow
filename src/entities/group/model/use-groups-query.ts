import { useQuery } from '@tanstack/react-query';

import { listGroups } from '@/features/console/api/groups-api';
import type { GroupItem } from '@/features/console/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useGroupsQuery() {
	return useQuery<GroupItem[]>({
		queryKey: queryKeys.groups,
		queryFn: () => listGroups(true),
	});
}
