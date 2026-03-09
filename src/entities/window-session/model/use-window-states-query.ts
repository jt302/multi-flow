import { useQuery } from '@tanstack/react-query';

import { listOpenProfileWindows } from '@/entities/window-session/api/windows-api';
import type { ProfileWindowStateItem } from '@/entities/window-session/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useWindowStatesQuery() {
	return useQuery<ProfileWindowStateItem[]>({
		queryKey: queryKeys.windowStates,
		queryFn: listOpenProfileWindows,
		refetchInterval: 5000,
	});
}
