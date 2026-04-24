import { useQuery } from '@tanstack/react-query';

import { listProxies } from '@/entities/proxy/api/proxy-api';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { queryKeys } from '@/shared/config/query-keys';

type UseProxiesQueryOptions<TData> = {
	enabled?: boolean;
	select?: (data: ProxyItem[]) => TData;
};

export function useProxiesQuery<TData = ProxyItem[]>(options: UseProxiesQueryOptions<TData> = {}) {
	const { enabled = true, select } = options;

	return useQuery<ProxyItem[], Error, TData>({
		queryKey: queryKeys.proxies,
		queryFn: listProxies,
		enabled,
		select,
	});
}
