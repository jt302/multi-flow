import { useQuery } from '@tanstack/react-query';

import { listProfiles } from '@/entities/profile/api/profiles-api';
import type { ProfileItem } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProfilesQuery() {
	return useQuery<ProfileItem[]>({
		queryKey: queryKeys.profiles,
		queryFn: listProfiles,
		refetchInterval: 5000,
	});
}
