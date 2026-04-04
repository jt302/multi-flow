import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import type { BatchProfileActionResponse, ProfileItem } from '@/entities/profile/model/types';

type ProfileBatchOpenResultCardProps = {
	result: BatchProfileActionResponse;
	profiles: ProfileItem[];
	onRetryFailed: (profileIds: string[]) => void;
	onClose: () => void;
};

export function ProfileBatchOpenResultCard({
	result,
	profiles,
	onRetryFailed,
	onClose,
}: ProfileBatchOpenResultCardProps) {
	const { t } = useTranslation('profile');
	const failedItems = result.items.filter((item) => !item.ok);

	if (failedItems.length === 0) {
		return null;
	}

	return (
		<div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-medium">{t('list:batchOpenFailedTitle')}</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('list:batchOpenFailedDesc', { success: result.successCount, failed: result.failedCount })}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						onClick={() => onRetryFailed(failedItems.map((item) => item.profileId))}
					>
						{t('list:retryFailed')}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						onClick={onClose}
					>
						{t('list:close')}
					</Button>
				</div>
			</div>
			<div className="mt-3 space-y-2">
				{failedItems.map((item) => {
					const profile = profiles.find((profileItem) => profileItem.id === item.profileId);
					return (
						<div
							key={item.profileId}
							className="rounded-lg border border-border/70 bg-background/80 px-3 py-2"
						>
							<p className="text-sm font-medium">{profile?.name || item.profileId}</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">{item.message}</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
