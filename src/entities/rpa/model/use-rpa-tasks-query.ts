import { useQuery } from '@tanstack/react-query';

import { listRpaTasks } from '@/entities/rpa/api/rpa-api';
import type { RpaTaskItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaTasksQuery(includeDeleted = false) {
	return useQuery<RpaTaskItem[]>({
		queryKey: queryKeys.rpaTasks(includeDeleted),
		queryFn: () => listRpaTasks(includeDeleted),
		refetchInterval: 5000,
	});
}
