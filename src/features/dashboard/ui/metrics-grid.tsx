import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { useAutomationScriptsQuery } from '@/entities/automation/model/use-automation-scripts-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';

export function MetricsGrid() {
	const { t } = useTranslation('dashboard');
	const { data: profiles = [] } = useProfilesQuery();
	const { data: proxies = [] } = useProxiesQuery();
	const { data: scripts = [] } = useAutomationScriptsQuery();
	const { data: windowStates = [] } = useWindowStatesQuery();

	const activeProfiles = profiles.filter((p) => p.lifecycle === 'active');
	const runningCount = activeProfiles.filter((p) => p.running).length;
	const totalCount = activeProfiles.length;

	const activeProxies = proxies.filter((p) => p.lifecycle === 'active');
	const proxiesOk = activeProxies.filter((p) => p.checkStatus === 'ok').length;
	const proxyTotal = activeProxies.length;
	const proxyRate = proxyTotal > 0 ? ((proxiesOk / proxyTotal) * 100).toFixed(1) : '—';

	const activeSyncSessions = windowStates.length;

	return (
		<div className="mb-4 grid grid-cols-4 gap-3">
			<Card className="min-w-0 gap-2 py-4">
				<CardHeader className="gap-1 px-4 pb-1">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.runningProfiles')}
					</CardDescription>
					<CardTitle className="text-3xl">{runningCount}</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pt-0">
					<p className="text-xs text-muted-foreground">
						{t('metrics.totalProfiles', { count: totalCount })}
					</p>
				</CardContent>
			</Card>
			<Card className="min-w-0 gap-2 py-4">
				<CardHeader className="gap-1 px-4 pb-1">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.proxyAvailability')}
					</CardDescription>
					<CardTitle className="text-3xl">{proxyRate}%</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pt-0">
					<p className="text-xs text-muted-foreground">
						{t('metrics.proxyOkCount', { ok: proxiesOk, total: proxyTotal })}
					</p>
				</CardContent>
			</Card>
			<Card className="min-w-0 gap-2 py-4">
				<CardHeader className="gap-1 px-4 pb-1">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.syncSessions')}
					</CardDescription>
					<CardTitle className="text-3xl">{activeSyncSessions}</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pt-0">
					<p className="text-xs text-muted-foreground">{t('metrics.runningWindows')}</p>
				</CardContent>
			</Card>
			<Card className="min-w-0 gap-2 py-4">
				<CardHeader className="gap-1 px-4 pb-1">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.automationScripts')}
					</CardDescription>
					<CardTitle className="text-3xl">{scripts.length}</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pt-0">
					<p className="text-xs text-muted-foreground">{t('metrics.totalScripts')}</p>
				</CardContent>
			</Card>
		</div>
	);
}
