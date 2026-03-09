import { Download, RefreshCw } from 'lucide-react';

import { Badge, Button, Card, CardTitle, Icon } from '@/components/ui';
import type { ResourceItem, ResourceProgressState } from '@/entities/resource/model/types';

type ResourceManagementCardProps = {
	chromiumItems: ResourceItem[];
	pendingKey: string;
	resourceProgress: ResourceProgressState | null;
	onRefreshResources: () => void;
	onInstallChromium: (resourceId: string) => void;
	onActivateChromium: (version: string) => void;
	formatBytes: (input: number | null) => string;
};

export function ResourceManagementCard({
	chromiumItems,
	pendingKey,
	resourceProgress,
	onRefreshResources,
	onInstallChromium,
	onActivateChromium,
	formatBytes,
}: ResourceManagementCardProps) {
	return (
		<Card className="p-4">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div>
					<CardTitle className="text-sm">Chromium 版本</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">资源下载、安装和激活仍然集中在设置页处理。</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onRefreshResources}
					disabled={Boolean(pendingKey)}
				>
					<Icon icon={RefreshCw} size={12} />
					刷新
				</Button>
			</div>
			<div className="space-y-2">
				{chromiumItems.length === 0 ? (
					<p className="rounded-xl border border-border/70 bg-background/70 px-3 py-6 text-center text-sm text-muted-foreground">
						未发现可用 Chromium 资源
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
									{item.active ? <Badge>当前</Badge> : null}
									{item.installed ? <Badge variant="outline">已安装</Badge> : <Badge variant="secondary">未安装</Badge>}
								</div>
							</div>
							<div className="mt-2 flex items-center gap-2">
								{item.installed ? (
									<Button
										type="button"
										size="sm"
										variant={item.active ? 'secondary' : 'outline'}
										disabled={Boolean(pendingKey) || item.active}
										onClick={() => onActivateChromium(item.version)}
									>
										切换到此版本
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										disabled={Boolean(pendingKey)}
										onClick={() => onInstallChromium(item.id)}
									>
										<Icon icon={Download} size={12} />
										下载并激活
									</Button>
								)}
							</div>
							{resourceProgress?.resourceId === item.id ? (
								<div className="mt-2 space-y-1">
									<div className="flex items-center justify-between text-[11px] text-muted-foreground">
										<span>
											{resourceProgress.stage === 'download'
												? '下载中'
												: resourceProgress.stage === 'install'
													? '安装中'
													: resourceProgress.stage === 'done'
														? '已完成'
														: resourceProgress.stage === 'error'
															? '失败'
															: '处理中'}
										</span>
										<span>{resourceProgress.percent === null ? '--' : `${Math.floor(resourceProgress.percent)}%`}</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
										<div
											className={`h-full transition-all ${resourceProgress.stage === 'error' ? 'bg-destructive' : 'bg-primary'}`}
											style={{ width: `${Math.max(3, Math.min(100, resourceProgress.percent ?? 0))}%` }}
										/>
									</div>
									<p className="text-[11px] text-muted-foreground">
										{formatBytes(resourceProgress.downloadedBytes)} / {formatBytes(resourceProgress.totalBytes)}
									</p>
								</div>
							) : null}
						</div>
					))
				)}
			</div>
		</Card>
	);
}
