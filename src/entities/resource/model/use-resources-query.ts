import { useQuery } from '@tanstack/react-query';

import { listResources } from '@/entities/resource/api/resource-api';
import type { ResourceItem } from '@/entities/resource/model/types';
import { queryKeys } from '@/shared/config/query-keys';

type UseResourcesQueryOptions = {
	enabled?: boolean;
};

export function useResourcesQuery(options: UseResourcesQueryOptions = {}) {
	const { enabled = true } = options;

	return useQuery<ResourceItem[]>({
		queryKey: queryKeys.resources,
		queryFn: listResources,
		enabled,
	});
}
