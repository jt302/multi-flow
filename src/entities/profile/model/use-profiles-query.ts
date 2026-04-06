import { useQuery } from '@tanstack/react-query';

import { listProfiles } from '@/entities/profile/api/profiles-api';
import type { ProfileItem } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

type UseProfilesQueryOptions = {
	enabled?: boolean;
	refetchInterval?: number | false;
};

export function useProfilesQuery(options: UseProfilesQueryOptions = {}) {
	const {
		enabled = true,
		refetchInterval = 5000,
	} = options;

	return useQuery<ProfileItem[]>({
		queryKey: queryKeys.profiles,
		queryFn: listProfiles,
		enabled,
		refetchInterval,
	});
}
