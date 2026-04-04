import { BarChart3, Globe2, PanelsTopLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	Badge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
} from '@/components/ui';
import { DataSection } from '@/components/common';
import { MetricsGrid } from './metrics-grid';
import { SessionTableCard } from '@/widgets/session-table-card/ui/session-table-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import type { PresetKey } from '@/entities/theme/model/types';

type DashboardPageProps = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
};

export function DashboardPage({
	resolvedMode,
	useCustomColor,
	preset,
}: DashboardPageProps) {
	const { t } = useTranslation('dashboard');
	const section = getWorkspaceSections().dashboard;

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<MetricsGrid
				resolvedMode={resolvedMode}
				useCustomColor={useCustomColor}
				preset={preset}
			/>

			<DataSection title={t('quickView')} contentClassName="p-0">
				<div className="grid gap-3 p-1 md:grid-cols-3">
					<Card className="p-3">
						<CardHeader className="p-0">
							<CardTitle className="flex items-center gap-2 text-sm">
								<Icon icon={BarChart3} size={14} />
								{t('overview.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-2 text-xs text-muted-foreground">
							{t('overview.desc')}
						</CardContent>
					</Card>
					<Card className="p-3">
						<CardHeader className="p-0">
							<CardTitle className="flex items-center gap-2 text-sm">
								<Icon icon={Globe2} size={14} />
								{t('proxyHealth.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-2 text-xs text-muted-foreground">
							{t('proxyHealth.desc')}
						</CardContent>
					</Card>
					<Card className="p-3">
						<CardHeader className="p-0">
							<CardTitle className="flex items-center gap-2 text-sm">
								<Icon icon={PanelsTopLeft} size={14} />
								{t('windowSync.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-2 text-xs text-muted-foreground">
							{t('windowSync.desc')}
							<Badge className="ml-1">
								{t('windowSync.activeSessions', { count: 2 })}
							</Badge>
						</CardContent>
					</Card>
				</div>
			</DataSection>

			<SessionTableCard
				title={section.tableTitle}
				rows={section.rows}
				className="flex-1 min-h-0 flex flex-col"
			/>
		</div>
	);
}
