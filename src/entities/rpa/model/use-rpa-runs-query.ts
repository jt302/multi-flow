import { useQuery } from '@tanstack/react-query';

import { listRpaRuns } from '@/entities/rpa/api/rpa-api';
import type { ListRpaRunsFilters, RpaRunItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaRunsQuery(filters: ListRpaRunsFilters = {}) {
	return useQuery<RpaRunItem[]>({
		queryKey: queryKeys.rpaRuns(filters),
		queryFn: () => listRpaRuns(filters),
		refetchInterval: 5000,
	});
}
