import { useQuery } from '@tanstack/react-query';

import { listRpaFlows } from '@/entities/rpa/api/rpa-api';
import type { RpaFlowItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaFlowsQuery(includeDeleted = true) {
	return useQuery<RpaFlowItem[]>({
		queryKey: queryKeys.rpaFlows(includeDeleted),
		queryFn: () => listRpaFlows(includeDeleted),
	});
}
