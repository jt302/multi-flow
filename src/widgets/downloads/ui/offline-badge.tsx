import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import { useChromiumRuntimeStore } from '@/store/chromium-runtime-store';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';

export function OfflineBadge() {
	const { t } = useTranslation('chromium');
	const offlineProfileIds = useChromiumRuntimeStore((s) => s.offlineProfileIds);
	const profilesQuery = useProfilesQuery({ refetchInterval: false });

	if (offlineProfileIds.size === 0) return null;

	const offlineNames = (profilesQuery.data ?? [])
		.filter((p) => offlineProfileIds.has(p.id))
		.map((p) => p.name)
		.join('、');

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex shrink-0 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive cursor-default">
					<WifiOff className="size-3.5" />
					<span className="hidden sm:inline">{t('offline.badge')}</span>
					{offlineProfileIds.size > 1 && (
						<span className="font-semibold">{offlineProfileIds.size}</span>
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{t('offline.tooltip', { profiles: offlineNames || [...offlineProfileIds].join(', ') })}
			</TooltipContent>
		</Tooltip>
	);
}
