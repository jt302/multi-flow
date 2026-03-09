import { useQuery } from '@tanstack/react-query';

import { listRpaRuns } from '@/entities/rpa/api/rpa-api';
import type { RpaRunItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaRunsQuery() {
	return useQuery<RpaRunItem[]>({
		queryKey: queryKeys.rpaRuns,
		queryFn: () => listRpaRuns(50),
		refetchInterval: 5000,
	});
}
