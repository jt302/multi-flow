import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	CardTitle,
	Icon,
} from '@/components/ui';
import type { ResourceItem } from '@/entities/resource/model/types';
import { formatBytes } from '@/shared/lib/format';
import { useResourceDownloadProgress } from '@/store/resource-download-store';

type ResourceManagementCardProps = {
	chromiumItems: ResourceItem[];
	geoItems: ResourceItem[];
	pendingKey: string;
	onRefreshResources: () => void;
	onInstallChromium: (resourceId: string, options?: { force?: boolean }) => void;
	onDownloadResource: (resourceId: string, label?: string) => void;
};

function ResourceProgressBlock({
	resourceId,
	mode,
}: {
	resourceId: string;
	mode: 'chromium' | 'geo';
}) {
	const { t } = useTranslation(['settings', 'common']);
	const progress = useResourceDownloadProgress(resourceId);
	if (!progress) return null;

	const stageLabel =
		progress.stage === 'download'
			? t('settings:resource.downloading')
			: progress.stage === 'install'
				? t('settings:resource.installing')
				: progress.stage === 'done'
					? t('settings:resource.done')
					: progress.stage === 'error'
						? t('settings:resource.error')
						: mode === 'geo'
							? t('settings:resource.downloading')
							: t('settings:resource.processing');

	return (
		<div className="mt-2 space-y-1">
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span>{stageLabel}</span>
				<span>{progress.percent === null ? '--' : `${Math.floor(progress.percent)}%`}</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
				<div
					className={`h-full transition-all ${progress.stage === 'error' ? 'bg-destructive' : 'bg-primary'}`}
					style={{
						width: `${Math.max(3, Math.min(100, progress.percent ?? 0))}%`,
					}}
				/>
			</div>
			<p className="text-[11px] text-muted-foreground">
				{formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
			</p>
		</div>
	);
}

export function ResourceManagementCard({
	chromiumItems,
	geoItems,
	pendingKey,
	onRefreshResources,
	onInstallChromium,
	onDownloadResource,
}: ResourceManagementCardProps) {
	const { t } = useTranslation(['settings', 'common']);
	const [redownloadTarget, setRedownloadTarget] = useState<ResourceItem | null>(null);
	return (
		<Card className="p-4">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div>
					<CardTitle className="text-sm">{t('settings:resource.chromiumVersions')}</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">
						{t('settings:resource.resourceDesc')}
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onRefreshResources}
					disabled={Boolean(pendingKey)}
				>
					<Icon icon={RefreshCw} size={12} />
					{t('common:refresh')}
				</Button>
			</div>
			<div className="space-y-2">
				{chromiumItems.length === 0 ? (
					<p className="rounded-xl border border-border/70 bg-background/70 px-3 py-6 text-center text-sm text-muted-foreground">
						{t('settings:resource.noResources')}
					</p>
				) : (
					chromiumItems.map((item) => (
						<div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">Chromium {item.version}</p>
									<p className="truncate text-xs text-muted-foreground">{item.platform}</p>
								</div>
								<div className="flex items-center gap-1">
									{item.installed ? (
										<Badge variant="outline">{t('settings:resource.installed')}</Badge>
									) : (
										<Badge variant="secondary">{t('settings:resource.notInstalled')}</Badge>
									)}
								</div>
							</div>
							<div className="mt-2 flex items-center gap-2">
								{item.installed ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={Boolean(pendingKey)}
										onClick={() => setRedownloadTarget(item)}
									>
										<Icon icon={RotateCw} size={12} />
										{t('settings:resource.redownload')}
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										disabled={Boolean(pendingKey)}
										onClick={() => onInstallChromium(item.id)}
									>
										<Icon icon={Download} size={12} />
										{t('settings:resource.downloadAndActivate')}
									</Button>
								)}
							</div>
							<ResourceProgressBlock resourceId={item.id} mode="chromium" />
						</div>
					))
				)}
				{geoItems.map((item) => (
					<div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
						<div className="flex items-center justify-between gap-2">
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{t('settings:resource.geoDbTitle', { name: item.fileName })}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{item.localPath || t('settings:resource.notDownloadedLocal')}
								</p>
							</div>
							<div className="flex items-center gap-1">
								{item.installed ? (
									<Badge variant="outline">{t('settings:resource.downloaded')}</Badge>
								) : (
									<Badge variant="secondary">{t('common:notDownloaded')}</Badge>
								)}
							</div>
						</div>
						<p className="mt-2 text-[11px] text-muted-foreground">
							{t('settings:resource.geoDbDesc')}
						</p>
						<div className="mt-2 flex items-center gap-2">
							<Button
								type="button"
								size="sm"
								variant={item.installed ? 'outline' : 'default'}
								disabled={Boolean(pendingKey)}
								onClick={() =>
									onDownloadResource(
										item.id,
										t('settings:resource.geoDbTitle', { name: '' }).trim(),
									)
								}
							>
								<Icon icon={Download} size={12} />
								{item.installed
									? t('settings:resource.redownload')
									: t('settings:resource.downloadGeoDb')}
							</Button>
						</div>
						<ResourceProgressBlock resourceId={item.id} mode="geo" />
					</div>
				))}
			</div>
			<AlertDialog
				open={redownloadTarget !== null}
				onOpenChange={(open) => {
					if (!open) setRedownloadTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings:resource.redownloadConfirmTitle')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('settings:resource.redownloadConfirmDesc', {
								version: redownloadTarget?.version ?? '',
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button type="button" variant="ghost" className="cursor-pointer">
								{t('common:cancel')}
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								className="cursor-pointer"
								onClick={() => {
									const target = redownloadTarget;
									setRedownloadTarget(null);
									if (target) onInstallChromium(target.id, { force: true });
								}}
							>
								<Icon icon={RotateCw} size={12} />
								{t('settings:resource.redownload')}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
