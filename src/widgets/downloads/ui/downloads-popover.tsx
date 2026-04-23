import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { useChromiumRuntimeStore, type DownloadItem } from '@/store/chromium-runtime-store';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { cn } from '@/lib/utils';

function DownloadRow({ item, profileName }: { item: DownloadItem; profileName?: string }) {
	const { t } = useTranslation('chromium');
	const percent =
		item.totalBytes > 0 ? Math.round((item.bytesSoFar / item.totalBytes) * 100) : 0;

	return (
		<li className="space-y-1 px-3 py-2 border-b border-border/30 last:border-0">
			<div className="flex items-center justify-between gap-2 min-w-0">
				<span className="truncate text-xs font-medium" title={item.filename || item.url}>
					{item.filename || item.url}
				</span>
				<span
					className={cn(
						'shrink-0 text-[10px] font-medium',
						item.state === 'complete' && 'text-green-600',
						item.state === 'interrupted' && 'text-destructive',
						item.state === 'in_progress' && 'text-muted-foreground',
					)}
				>
					{item.state === 'in_progress'
						? `${percent}%`
						: item.state === 'complete'
							? t('downloads.stateComplete')
							: t('downloads.stateInterrupted')}
				</span>
			</div>

			{item.state === 'in_progress' && (
				<div className="h-1 w-full rounded-full bg-muted overflow-hidden">
					<div
						className="h-full rounded-full bg-primary transition-all duration-300"
						style={{ width: `${percent}%` }}
					/>
				</div>
			)}

			{item.error && (
				<p className="text-[10px] text-destructive truncate">{item.error}</p>
			)}

			{profileName && (
				<p className="text-[10px] text-muted-foreground">
					{t('downloads.profileLabel')}: {profileName}
				</p>
			)}
		</li>
	);
}

export function DownloadsPopover() {
	const { t } = useTranslation('chromium');
	const downloads = useChromiumRuntimeStore((s) => s.downloads);
	const clearCompleted = useChromiumRuntimeStore((s) => s.clearCompleted);
	const profilesQuery = useProfilesQuery({ refetchInterval: false });

	const profileMap = Object.fromEntries(
		(profilesQuery.data ?? []).map((p) => [p.id, p.name]),
	);

	const items = Object.values(downloads).sort((a, b) => b.updatedAt - a.updatedAt);
	const activeCount = items.filter((i) => i.state === 'in_progress').length;
	const hasCompleted = items.some((i) => i.state !== 'in_progress');

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="secondary"
					className="relative min-w-0 flex-1 justify-start bg-background/50 dark:bg-background/50 shadow-sm border border-border/40 transition-all duration-300 hover:scale-[1.02] sm:w-auto sm:flex-none sm:justify-center cursor-pointer"
				>
					<Download data-icon="inline-start" className="text-muted-foreground" />
					{t('downloads.title')}
					{activeCount > 0 && (
						<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
							{activeCount > 9 ? '9+' : activeCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
				<div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
					<p className="text-xs font-semibold">{t('downloads.title')}</p>
					{hasCompleted && (
						<button
							type="button"
							className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
							onClick={clearCompleted}
						>
							{t('downloads.clearCompleted')}
						</button>
					)}
				</div>
				{items.length === 0 ? (
					<p className="px-3 py-4 text-xs text-muted-foreground text-center">
						{t('downloads.empty')}
					</p>
				) : (
					<ul className="max-h-72 overflow-y-auto">
						{items.map((item) => (
							<DownloadRow
								key={`${item.profileId}:${item.downloadId}`}
								item={item}
								profileName={profileMap[item.profileId]}
							/>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
