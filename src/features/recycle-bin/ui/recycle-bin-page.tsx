import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Icon, TableCell, TableRow } from '@/components/ui';
import {
	ConfirmActionDialog,
	DataSection,
	PageHeader,
} from '@/components/common';
import { countDeletedRecycleBinItems } from '@/features/recycle-bin/model/recycle-bin-counts';

import type { RecycleBinPageProps } from '@/features/recycle-bin/model-types';
import { RecycleBinSection } from './recycle-bin-section';

function formatDeletedAt(
	ts: number | null | undefined,
	t: (key: string, opts?: Record<string, unknown>) => string,
): string {
	if (!ts) {
		return t('common:unknownTime');
	}
	const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
	if (diff < 60) return t('common:justNow');
	if (diff < 3600)
		return t('common:minutesAgo', { count: Math.floor(diff / 60) });
	if (diff < 86400)
		return t('common:hoursAgo', { count: Math.floor(diff / 3600) });
	return t('common:daysAgo', { count: Math.floor(diff / 86400) });
}

type PurgeTarget = {
	kind: 'profile' | 'proxy' | 'group';
	id: string;
	name: string;
};

type DeletedItem = {
	id: string;
	name: string;
	deletedAt?: number | null;
};

function DeletedItemRow({
	item,
	pending,
	onRestore,
	onPurge,
}: {
	item: DeletedItem;
	pending: boolean;
	onRestore: () => void;
	onPurge: () => void;
}) {
	const { t } = useTranslation(['recycle', 'common']);
	return (
		<TableRow>
			<TableCell>
				<p className="truncate text-sm font-medium">{item.name}</p>
			</TableCell>
			<TableCell className="w-[280px]">
				<p className="truncate text-xs text-muted-foreground">
					{item.id} ·{' '}
					{t('deletedAt', { time: formatDeletedAt(item.deletedAt, t) })}
				</p>
			</TableCell>
			<TableCell className="w-[220px] text-right">
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={pending}
						onClick={onRestore}
					>
						<Icon icon={RotateCcw} size={12} />
						{t('restore')}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="destructive"
						disabled={pending}
						onClick={onPurge}
					>
						<Icon icon={Trash2} size={12} />
						{t('permanentDelete')}
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}

export function RecycleBinPage({
	profiles,
	proxies,
	groups,
	onRestoreProfile,
	onPurgeProfile,
	onRestoreProxy,
	onPurgeProxy,
	onRestoreGroup,
	onPurgeGroup,
	onRefreshAll,
}: RecycleBinPageProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);
	const { t } = useTranslation(['recycle', 'common']);

	const deletedProfiles = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'deleted'),
		[profiles],
	);
	const deletedProxies = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'deleted'),
		[proxies],
	);
	const deletedGroups = useMemo(
		() => groups.filter((item) => item.lifecycle === 'deleted'),
		[groups],
	);
	const totalDeleted = countDeletedRecycleBinItems({
		profiles,
		proxies,
		groups,
	});

	const runAction = async (action: () => Promise<void>) => {
		if (pending) return;
		setPending(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('operationFailed'));
		} finally {
			setPending(false);
		}
	};

	const runPurge = async () => {
		if (!purgeTarget) return;
		switch (purgeTarget.kind) {
			case 'profile':
				await onPurgeProfile(purgeTarget.id);
				return;
			case 'proxy':
				await onPurgeProxy(purgeTarget.id);
				return;
			case 'group':
				await onPurgeGroup(purgeTarget.id);
				return;
		}
	};

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<PageHeader label="settings" title={t('title')} description={t('desc')} />

			<DataSection
				title={t('stats')}
				actions={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							void runAction(onRefreshAll);
						}}
					>
						<Icon icon={RefreshCw} size={12} />
						{t('common:refresh')}
					</Button>
				}
			>
				<div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
					<div className="flex items-center gap-2">
						<Icon icon={Trash2} size={12} />
						<span className="text-muted-foreground">{t('archivedItems')}</span>
						<Badge>{totalDeleted}</Badge>
					</div>
				</div>
			</DataSection>

			<RecycleBinSection title={t('profiles')} items={deletedProfiles}>
				{(item) => (
					<DeletedItemRow
						key={item.id}
						item={item}
						pending={pending}
						onRestore={() => {
							void runAction(() => onRestoreProfile(item.id));
						}}
						onPurge={() =>
							setPurgeTarget({ kind: 'profile', id: item.id, name: item.name })
						}
					/>
				)}
			</RecycleBinSection>

			<RecycleBinSection title={t('proxies')} items={deletedProxies}>
				{(item) => (
					<DeletedItemRow
						key={item.id}
						item={item}
						pending={pending}
						onRestore={() => {
							void runAction(() => onRestoreProxy(item.id));
						}}
						onPurge={() =>
							setPurgeTarget({ kind: 'proxy', id: item.id, name: item.name })
						}
					/>
				)}
			</RecycleBinSection>

			<RecycleBinSection
				title={t('groups')}
				items={deletedGroups}
				footer={
					error ? <p className="text-xs text-destructive">{error}</p> : null
				}
			>
				{(item) => (
					<DeletedItemRow
						key={item.id}
						item={item}
						pending={pending}
						onRestore={() => {
							void runAction(() => onRestoreGroup(item.id));
						}}
						onPurge={() =>
							setPurgeTarget({ kind: 'group', id: item.id, name: item.name })
						}
					/>
				)}
			</RecycleBinSection>

			<ConfirmActionDialog
				open={Boolean(purgeTarget)}
				title={t('confirmDelete')}
				description={t('confirmDeleteDesc', { name: purgeTarget?.name || '' })}
				confirmText={t('permanentDelete')}
				pending={pending}
				onOpenChange={(open) => {
					if (!open) {
						setPurgeTarget(null);
					}
				}}
				onConfirm={() => {
					if (!purgeTarget) {
						return;
					}
					void runAction(async () => {
						await runPurge();
						setPurgeTarget(null);
					});
				}}
			/>
		</div>
	);
}
