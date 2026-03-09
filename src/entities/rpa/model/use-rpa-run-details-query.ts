import { useQuery } from '@tanstack/react-query';

import { getRpaRunDetails } from '@/entities/rpa/api/rpa-api';
import type { RpaRunDetailsItem } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaRunDetailsQuery(runId: string | null) {
	return useQuery<RpaRunDetailsItem | null>({
		queryKey: queryKeys.rpaRunDetails(runId),
		queryFn: () => (runId ? getRpaRunDetails(runId) : Promise.resolve(null)),
		enabled: Boolean(runId),
		refetchInterval: 5000,
	});
}
