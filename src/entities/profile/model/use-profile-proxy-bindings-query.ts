import { useQuery } from '@tanstack/react-query';

import { listProfileProxyBindings } from '@/features/console/api/proxy-api';
import type { ProfileProxyBindingMap } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProfileProxyBindingsQuery(profileIds: string[]) {
	return useQuery<ProfileProxyBindingMap>({
		queryKey: queryKeys.profileProxyBindings(profileIds),
		queryFn: async () => {
			if (profileIds.length === 0) {
				return {};
			}
			return listProfileProxyBindings(profileIds);
		},
		enabled: true,
	});
}
