import { useQuery } from '@tanstack/react-query';

import { listProfileDevicePresets } from '@/entities/profile/api/profiles-api';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useProfileDevicePresetsQuery() {
	return useQuery<ProfileDevicePresetItem[]>({
		queryKey: queryKeys.devicePresets,
		queryFn: () => listProfileDevicePresets(),
	});
}
