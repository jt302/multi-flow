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
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';
import { useGroupsQuery } from '@/entities/group/model/use-groups-query';

export function DashboardPage() {
	const { t } = useTranslation('dashboard');
	const { data: profiles = [] } = useProfilesQuery();
	const { data: proxies = [] } = useProxiesQuery();
	const { data: windowStates = [] } = useWindowStatesQuery();
	const { data: groups = [] } = useGroupsQuery();

	const activeProfiles = profiles.filter((p) => p.lifecycle === 'active');
	const activeGroups = groups.filter((g) => g.lifecycle === 'active');
	const activeProxies = proxies.filter((p) => p.lifecycle === 'active');
	const proxyErrorCount = activeProxies.filter((p) => p.checkStatus === 'error').length;
	const proxyUnchecked = activeProxies.filter((p) => !p.checkStatus || p.checkStatus === '').length;

	// 从真实数据构建运行中会话行
	const sessionRows = windowStates.map((ws) => {
		const profile = profiles.find((p) => p.id === ws.profileId);
		return {
			name: profile?.name ?? ws.profileId,
			group: profile?.group ?? '',
			totalWindows: ws.totalWindows,
			totalTabs: ws.totalTabs,
			profileId: ws.profileId,
		};
	});

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<MetricsGrid />

			<DataSection title={t('quickView')} contentClassName="p-0">
				<div className="grid gap-3 p-1 md:grid-cols-3">
					<Card className="p-3">
						<CardHeader className="p-0">
							<CardTitle className="flex items-center gap-2 text-sm">
								<Icon icon={BarChart3} size={14} />
								{t('overview.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-2 text-xs text-muted-foreground space-y-1">
							<p>{t('overview.profilesByGroup', { groups: activeGroups.length, profiles: activeProfiles.length })}</p>
							{activeGroups.slice(0, 3).map((g) => (
								<p key={g.id} className="pl-2">• {g.name}: {g.profileCount}</p>
							))}
							{activeGroups.length > 3 && <p className="pl-2 text-muted-foreground/60">…</p>}
						</CardContent>
					</Card>
					<Card className="p-3">
						<CardHeader className="p-0">
							<CardTitle className="flex items-center gap-2 text-sm">
								<Icon icon={Globe2} size={14} />
								{t('proxyHealth.title')}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0 pt-2 text-xs text-muted-foreground space-y-1">
							<p>{t('proxyHealth.summary', { total: activeProxies.length, error: proxyErrorCount, unchecked: proxyUnchecked })}</p>
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
								{t('windowSync.activeSessions', { count: windowStates.length })}
							</Badge>
						</CardContent>
					</Card>
				</div>
			</DataSection>

			{/* 运行中会话表格 */}
			<Card className="flex-1 min-h-0 flex flex-col min-w-0 p-3">
				<div className="mb-2 px-1">
					<h2 className="text-sm font-semibold">{t('sessionsTable.title')}</h2>
				</div>
				<div className="overflow-hidden overflow-y-auto rounded-xl border border-border/70 flex-1 min-h-0">
					{sessionRows.length === 0 ? (
						<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
							{t('sessionsTable.empty')}
						</div>
					) : (
						sessionRows.map((row, index) => (
							<div
								key={row.profileId}
								className={`grid grid-cols-[minmax(0,1fr)_80px_80px] items-center gap-3 px-3 py-3 text-sm ${index < sessionRows.length - 1 ? 'border-b border-border/70' : ''}`}
							>
								<div className="min-w-0">
									<p className="truncate font-medium">{row.name}</p>
									<p className="truncate text-xs text-muted-foreground">{row.group}</p>
								</div>
								<p className="text-xs text-muted-foreground">{t('sessionsTable.windows', { count: row.totalWindows })}</p>
								<p className="text-xs text-muted-foreground">{t('sessionsTable.tabs', { count: row.totalTabs })}</p>
							</div>
						))
					)}
				</div>
			</Card>
		</div>
	);
}
