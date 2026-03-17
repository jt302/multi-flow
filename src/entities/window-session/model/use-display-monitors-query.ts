import { useQuery } from '@tanstack/react-query';

import { listDisplayMonitors } from '@/entities/window-session/api/windows-api';
import type { DisplayMonitorItem } from '@/entities/window-session/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useDisplayMonitorsQuery() {
	return useQuery<DisplayMonitorItem[]>({
		queryKey: queryKeys.displayMonitors,
		queryFn: listDisplayMonitors,
		staleTime: 60_000,
	});
}
