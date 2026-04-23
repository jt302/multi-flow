import { useQuery } from '@tanstack/react-query';

import { getProfileBookmarks } from '@/entities/bookmark/api/bookmark-api';
import type { GetProfileBookmarksResponse } from '@/entities/bookmark/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProfileBookmarksQuery(profileId: string | null) {
	return useQuery<GetProfileBookmarksResponse>({
		queryKey: queryKeys.bookmarks.byProfile(profileId ?? ''),
		queryFn: () => getProfileBookmarks(profileId!),
		enabled: !!profileId,
		staleTime: 5000,
	});
}
