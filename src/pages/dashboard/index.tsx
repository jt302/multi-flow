import { useOutletContext } from 'react-router-dom';

import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { DashboardPage } from '@/features/dashboard/ui/dashboard-page';

export function DashboardRoutePage() {
	const { theme } = useOutletContext<WorkspaceOutletContext>();

	return (
		<DashboardPage
			resolvedMode={theme.resolvedMode}
			useCustomColor={theme.useCustomColor}
			preset={theme.preset}
		/>
	);
}

