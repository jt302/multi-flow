import { useQuery } from '@tanstack/react-query';

import { listOpenProfileWindows } from '@/features/console/api/windows-api';
import type { ProfileWindowStateItem } from '@/features/console/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useWindowStatesQuery() {
	return useQuery<ProfileWindowStateItem[]>({
		queryKey: queryKeys.windowStates,
		queryFn: listOpenProfileWindows,
		refetchInterval: 5000,
	});
}
