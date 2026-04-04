import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui';
import { useTranslation } from 'react-i18next';

import type { MetricsGridProps } from '@/app/model/workspace-types';

export function MetricsGrid({
	resolvedMode,
	useCustomColor,
	preset,
}: MetricsGridProps) {
	const { t } = useTranslation('dashboard');
	return (
		<div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.runningProfiles')}
					</CardDescription>
					<CardTitle className="text-3xl">24</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">
						{t('metrics.newToday', { count: 3 })}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.proxyAvailability')}
					</CardDescription>
					<CardTitle className="text-3xl">98.4%</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">
						{t('metrics.lastHour')}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.paused')}
					</CardDescription>
					<CardTitle className="text-3xl">2</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">
						{t('metrics.needManual')}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">
						{t('metrics.currentTheme')}
					</CardDescription>
					<CardTitle className="text-lg capitalize">{resolvedMode}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">
						{useCustomColor
							? t('metrics.customColor')
							: t('metrics.preset', { preset })}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
