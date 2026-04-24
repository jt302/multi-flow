import { useQuery } from '@tanstack/react-query';

import { getProfileRuntimeDetails } from '@/entities/profile/api/profiles-api';
import type { ProfileRuntimeDetails } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProfileRuntimeDetailsQuery(profileId: string | null, running: boolean) {
	return useQuery<ProfileRuntimeDetails>({
		queryKey: queryKeys.profileRuntimeDetails(profileId),
		queryFn: () => getProfileRuntimeDetails(profileId ?? ''),
		enabled: Boolean(profileId),
		refetchInterval: running ? 5000 : false,
	});
}
