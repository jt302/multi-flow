import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

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
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
} from '@/components/ui';
import { useRpaFlowsQuery } from '@/entities/rpa/model/use-rpa-flows-query';
import { useRpaActions } from '@/features/ai/model/use-rpa-actions';
import {
	countDeletedRecycleBinItems,
	getDeletedRpaFlows,
} from '@/features/recycle-bin/model/rpa-recycle-bin';

import type { RecycleBinPageProps } from '@/features/recycle-bin/model-types';

function formatDeletedAt(ts: number | null | undefined): string {
	if (!ts) {
		return '未知时间';
	}
	const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
	if (diff < 60) return '刚刚';
	if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
	return `${Math.floor(diff / 86400)} 天前`;
}

type PurgeTarget = {
	kind: 'profile' | 'proxy' | 'group' | 'rpa';
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
	return (
		<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">{item.name}</p>
				<p className="truncate text-xs text-muted-foreground">
					{item.id} · 删除于 {formatDeletedAt(item.deletedAt)}
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="cursor-pointer"
					disabled={pending}
					onClick={onRestore}
				>
					<Icon icon={RotateCcw} size={12} />
					恢复
				</Button>
				<Button
					type="button"
					size="sm"
					variant="destructive"
					className="cursor-pointer"
					disabled={pending}
					onClick={onPurge}
				>
					<Icon icon={Trash2} size={12} />
					彻底删除
				</Button>
			</div>
		</div>
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
	const rpaFlowsQuery = useRpaFlowsQuery(true);
	const rpaActions = useRpaActions();

	const deletedProfiles = useMemo(() => profiles.filter((item) => item.lifecycle === 'deleted'), [profiles]);
	const deletedProxies = useMemo(() => proxies.filter((item) => item.lifecycle === 'deleted'), [proxies]);
	const deletedGroups = useMemo(() => groups.filter((item) => item.lifecycle === 'deleted'), [groups]);
	const deletedRpaFlows = useMemo(
		() => getDeletedRpaFlows(rpaFlowsQuery.data ?? []),
		[rpaFlowsQuery.data],
	);
	const totalDeleted = countDeletedRecycleBinItems({
		profiles,
		proxies,
		groups,
		rpaFlows: rpaFlowsQuery.data ?? [],
	});

	const runAction = async (action: () => Promise<void>) => {
		if (pending) return;
		setPending(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : '回收站操作失败');
		} finally {
			setPending(false);
		}
	};

	const renderEmpty = (
		<div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
			当前回收站为空
		</div>
	);

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
			case 'rpa':
				await rpaActions.purgeFlow(purgeTarget.id);
				return;
		}
	};

	return (
		<div className="space-y-3">
			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">回收站</CardTitle>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer"
							onClick={() => {
								void runAction(onRefreshAll);
							}}
						>
							<Icon icon={RefreshCw} size={12} />
							刷新
						</Button>
					</div>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
						<div className="flex items-center gap-2">
							<Icon icon={Trash2} size={12} />
							<span className="text-muted-foreground">已归档项目</span>
							<Badge>{totalDeleted}</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">环境</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					{deletedProfiles.length === 0
						? renderEmpty
						: deletedProfiles.map((item) => (
								<DeletedItemRow
									key={item.id}
									item={item}
									pending={pending}
									onRestore={() => {
										void runAction(() => onRestoreProfile(item.id));
									}}
									onPurge={() => setPurgeTarget({ kind: 'profile', id: item.id, name: item.name })}
								/>
						  ))}
				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">代理</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					{deletedProxies.length === 0
						? renderEmpty
						: deletedProxies.map((item) => (
								<DeletedItemRow
									key={item.id}
									item={item}
									pending={pending}
									onRestore={() => {
										void runAction(() => onRestoreProxy(item.id));
									}}
									onPurge={() => setPurgeTarget({ kind: 'proxy', id: item.id, name: item.name })}
								/>
						  ))}
				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">分组</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					{deletedGroups.length === 0
						? renderEmpty
						: deletedGroups.map((item) => (
								<DeletedItemRow
									key={item.id}
									item={item}
									pending={pending}
									onRestore={() => {
										void runAction(() => onRestoreGroup(item.id));
									}}
									onPurge={() => setPurgeTarget({ kind: 'group', id: item.id, name: item.name })}
								/>
						  ))}
					{error ? <p className="text-xs text-destructive">{error}</p> : null}
				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">RPA 流程</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					{deletedRpaFlows.length === 0
						? renderEmpty
						: deletedRpaFlows.map((item) => (
								<DeletedItemRow
									key={item.id}
									item={item}
									pending={pending}
									onRestore={() => {
										void runAction(() => rpaActions.restoreFlow(item.id));
									}}
									onPurge={() => setPurgeTarget({ kind: 'rpa', id: item.id, name: item.name })}
								/>
						  ))}
					{rpaFlowsQuery.error ? (
						<p className="text-xs text-destructive">加载 RPA 回收站失败</p>
					) : null}
				</CardContent>
			</Card>

			<AlertDialog open={Boolean(purgeTarget)} onOpenChange={(open) => !open && setPurgeTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认彻底删除</AlertDialogTitle>
						<AlertDialogDescription>
							{purgeTarget?.name || '该项目'} 将被彻底删除且不能恢复，请确认这不是误操作。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending}>
								取消
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								variant="destructive"
								className="cursor-pointer"
								disabled={pending || !purgeTarget}
								onClick={() => {
									if (!purgeTarget) {
										return;
									}
									void runAction(async () => {
										await runPurge();
										setPurgeTarget(null);
									});
								}}
							>
								彻底删除
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
