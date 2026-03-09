import { useQuery } from '@tanstack/react-query';

import { listResources } from '@/features/console/api/resource-api';
import type { ResourceItem } from '@/entities/resource/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useResourcesQuery() {
	return useQuery<ResourceItem[]>({
		queryKey: queryKeys.resources,
		queryFn: listResources,
	});
}
