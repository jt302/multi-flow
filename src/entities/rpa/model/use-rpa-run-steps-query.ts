import { useQuery } from '@tanstack/react-query';

import { listRpaRunSteps } from '@/entities/rpa/api/rpa-api';
import type { RpaRunStepItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaRunStepsQuery(instanceId: string | null) {
	return useQuery<RpaRunStepItem[]>({
		queryKey: queryKeys.rpaRunSteps(instanceId),
		queryFn: () => (instanceId ? listRpaRunSteps(instanceId) : Promise.resolve([])),
		enabled: Boolean(instanceId),
		refetchInterval: 5000,
	});
}
