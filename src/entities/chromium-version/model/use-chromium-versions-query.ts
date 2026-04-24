import { useQuery } from '@tanstack/react-query';
import { tauriInvoke } from '@/shared/api/tauri-invoke';
import { queryKeys } from '@/shared/config/query-keys';
import type { ChromiumVersionEntry } from './types';

export function useChromiumVersionsQuery(platform: string) {
	return useQuery({
		queryKey: queryKeys.chromiumVersions.byPlatform(platform),
		queryFn: () =>
			tauriInvoke<ChromiumVersionEntry[]>('list_chromium_versions_for_platform', { platform }),
		staleTime: Infinity,
		enabled: Boolean(platform),
	});
}
