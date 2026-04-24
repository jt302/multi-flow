import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
	getDefaultAiConfigId,
	setDefaultAiConfigId,
} from '@/entities/automation/api/automation-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useDefaultAiConfigQuery() {
	return useQuery<string | null>({
		queryKey: queryKeys.defaultAiConfig,
		queryFn: getDefaultAiConfigId,
	});
}

export function useSetDefaultAiConfigMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (configId: string | null) => setDefaultAiConfigId(configId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.defaultAiConfig });
		},
	});
}
