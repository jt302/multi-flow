import { useQuery } from '@tanstack/react-query';

import { listAutomationRuns } from '@/entities/automation/api/automation-api';
import type { AutomationRun } from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useAutomationRunsQuery(scriptId: string | null) {
	return useQuery<AutomationRun[]>({
		queryKey: queryKeys.automationRuns(scriptId ?? ''),
		queryFn: () => listAutomationRuns(scriptId ?? ''),
		enabled: scriptId !== null,
	});
}
