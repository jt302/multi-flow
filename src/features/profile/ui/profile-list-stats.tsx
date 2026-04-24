import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type ProfileListStatsProps = {
	filteredCount: number;
	totalCount: number;
	activeCount: number;
	runningCount: number;
};

export function ProfileListStats({
	filteredCount,
	totalCount,
	activeCount,
	runningCount,
}: ProfileListStatsProps) {
	const { t } = useTranslation('profile');
	return (
		<div className="grid grid-cols-3 gap-2 sm:gap-3">
			<Card className="min-w-0 gap-3 p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">
						{t('stats.totalProfiles')}
					</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{filteredCount}</p>
					<p className="text-xs text-muted-foreground">{t('stats.total', { count: totalCount })}</p>
				</CardContent>
			</Card>
			<Card className="min-w-0 gap-3 p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">
						{t('stats.activeProfiles')}
					</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{activeCount}</p>
				</CardContent>
			</Card>
			<Card className="min-w-0 gap-3 p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">{t('stats.running')}</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{runningCount}</p>
				</CardContent>
			</Card>
		</div>
	);
}
