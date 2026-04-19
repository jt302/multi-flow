import { useQuery } from '@tanstack/react-query';

import { countProfilesByDevicePreset } from '@/entities/profile/api/profiles-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useDevicePresetRefCountQuery(presetId: string | null | undefined) {
	return useQuery<number>({
		queryKey: queryKeys.devicePresetRefCount(presetId ?? ''),
		queryFn: () => countProfilesByDevicePreset(presetId!),
		enabled: !!presetId,
		staleTime: 30_000,
	});
}
