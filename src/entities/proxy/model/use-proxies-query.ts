import { useQuery } from '@tanstack/react-query';

import { listProxies } from '@/features/console/api/proxy-api';
import type { ProxyItem } from '@/features/console/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProxiesQuery() {
	return useQuery<ProxyItem[]>({
		queryKey: queryKeys.proxies,
		queryFn: listProxies,
	});
}
