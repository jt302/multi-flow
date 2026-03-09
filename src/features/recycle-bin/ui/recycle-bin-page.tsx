import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';

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

export function RecycleBinPage({
	profiles,
	proxies,
	groups,
	onRestoreProfile,
	onRestoreProxy,
	onRestoreGroup,
	onRefreshAll,
}: RecycleBinPageProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const deletedProfiles = useMemo(() => profiles.filter((item) => item.lifecycle === 'deleted'), [profiles]);
	const deletedProxies = useMemo(() => proxies.filter((item) => item.lifecycle === 'deleted'), [proxies]);
	const deletedGroups = useMemo(() => groups.filter((item) => item.lifecycle === 'deleted'), [groups]);
	const totalDeleted = deletedProfiles.length + deletedProxies.length + deletedGroups.length;

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
								<div key={item.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{item.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{item.id} · 删除于 {formatDeletedAt(item.deletedAt)}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="cursor-pointer"
										disabled={pending}
										onClick={() => {
											void runAction(() => onRestoreProfile(item.id));
										}}
									>
										<Icon icon={RotateCcw} size={12} />
										恢复
									</Button>
								</div>
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
								<div key={item.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{item.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{item.id} · 删除于 {formatDeletedAt(item.deletedAt)}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="cursor-pointer"
										disabled={pending}
										onClick={() => {
											void runAction(() => onRestoreProxy(item.id));
										}}
									>
										<Icon icon={RotateCcw} size={12} />
										恢复
									</Button>
								</div>
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
								<div key={item.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{item.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{item.id} · 删除于 {formatDeletedAt(item.deletedAt)}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="cursor-pointer"
										disabled={pending}
										onClick={() => {
											void runAction(() => onRestoreGroup(item.id));
										}}
									>
										<Icon icon={RotateCcw} size={12} />
										恢复
									</Button>
								</div>
						  ))}
					{error ? <p className="text-xs text-destructive">{error}</p> : null}
				</CardContent>
			</Card>
		</div>
	);
}

