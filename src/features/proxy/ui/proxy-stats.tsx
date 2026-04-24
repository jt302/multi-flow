import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type ProxyStatsProps = {
	totalCount: number;
	activeCount: number;
	boundCount: number;
};

export function ProxyStats({ totalCount, activeCount, boundCount }: ProxyStatsProps) {
	const { t } = useTranslation('proxy');

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">{t('stats.totalProxies')}</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{totalCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">
						{t('stats.availableProxies')}
					</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{activeCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">
						{t('stats.boundProfiles')}
					</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{boundCount}</p>
				</CardContent>
			</Card>
		</div>
	);
}
