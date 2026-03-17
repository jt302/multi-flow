import { useQuery } from '@tanstack/react-query';

import { listSyncTargets } from '@/entities/window-session/api/windows-api';
import type { ListSyncTargetsResponse } from '@/entities/window-session/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useSyncTargetsQuery() {
	return useQuery<ListSyncTargetsResponse>({
		queryKey: queryKeys.syncTargets,
		queryFn: listSyncTargets,
		refetchInterval: 5000,
	});
}
