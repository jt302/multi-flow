import { useQuery } from '@tanstack/react-query';

import { listProfiles } from '@/entities/profile/api/profiles-api';
import type { ProfileItem } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

type UseProfilesQueryOptions<TData> = {
	enabled?: boolean;
	refetchInterval?: number | false;
	select?: (data: ProfileItem[]) => TData;
};

export function useProfilesQuery<TData = ProfileItem[]>(
	options: UseProfilesQueryOptions<TData> = {},
) {
	const {
		enabled = true,
		refetchInterval = 5000,
		select,
	} = options;

	return useQuery<ProfileItem[], Error, TData>({
		queryKey: queryKeys.profiles,
		queryFn: listProfiles,
		enabled,
		refetchInterval,
		select,
	});
}
