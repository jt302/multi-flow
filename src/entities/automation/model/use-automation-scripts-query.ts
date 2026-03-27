import { useQuery } from '@tanstack/react-query';

import { listAutomationScripts } from '@/entities/automation/api/automation-api';
import type { AutomationScript } from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useAutomationScriptsQuery() {
	return useQuery<AutomationScript[]>({
		queryKey: queryKeys.automationScripts,
		queryFn: listAutomationScripts,
	});
}
