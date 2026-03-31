import { Download, RefreshCw } from 'lucide-react';

import { Badge, Button, Card, CardTitle, Icon } from '@/components/ui';
import type {
	ResourceItem,
	ResourceProgressState,
} from '@/entities/resource/model/types';
import { formatBytes } from '@/shared/lib/format';

type ResourceManagementCardProps = {
	chromiumItems: ResourceItem[];
	geoItems: ResourceItem[];
	pendingKey: string;
	resourceProgress: ResourceProgressState | null;
	onRefreshResources: () => void;
	onInstallChromium: (resourceId: string) => void;
	onDownloadResource: (resourceId: string, label?: string) => void;
};

export function ResourceManagementCard({
	chromiumItems,
	geoItems,
	pendingKey,
	resourceProgress,
	onRefreshResources,
	onInstallChromium,
	onDownloadResource,
}: ResourceManagementCardProps) {
	return (
		<Card className="p-4">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div>
					<CardTitle className="text-sm">Chromium 版本</CardTitle>
					<p className="mt-1 text-xs text-muted-foreground">
						资源下载、安装和激活仍然集中在设置页处理。
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
						<div
							key={item.id}
							className="rounded-xl border border-border/70 bg-background/70 p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										Chromium {item.version}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{item.platform}
									</p>
								</div>
								<div className="flex items-center gap-1">
									{item.installed ? (
										<Badge variant="outline">已安装</Badge>
									) : (
										<Badge variant="secondary">未安装</Badge>
									)}
								</div>
							</div>
							<div className="mt-2 flex items-center gap-2">
								{!item.installed && (
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
										<span>
											{resourceProgress.percent === null
												? '--'
												: `${Math.floor(resourceProgress.percent)}%`}
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
										<div
											className={`h-full transition-all ${resourceProgress.stage === 'error' ? 'bg-destructive' : 'bg-primary'}`}
											style={{
												width: `${Math.max(3, Math.min(100, resourceProgress.percent ?? 0))}%`,
											}}
										/>
									</div>
									<p className="text-[11px] text-muted-foreground">
										{formatBytes(resourceProgress.downloadedBytes)} /{' '}
										{formatBytes(resourceProgress.totalBytes)}
									</p>
								</div>
							) : null}
						</div>
					))
				)}
				{geoItems.map((item) => (
					<div
						key={item.id}
						className="rounded-xl border border-border/70 bg-background/70 p-3"
					>
						<div className="flex items-center justify-between gap-2">
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									GEO 数据库 {item.fileName}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{item.localPath || '未下载到本地'}
								</p>
							</div>
							<div className="flex items-center gap-1">
								{item.installed ? (
									<Badge variant="outline">已下载</Badge>
								) : (
									<Badge variant="secondary">未下载</Badge>
								)}
							</div>
						</div>
						<p className="mt-2 text-[11px] text-muted-foreground">
							用于代理出口画像、自动语言/时区建议和环境地理位置联动。
						</p>
						<div className="mt-2 flex items-center gap-2">
							<Button
								type="button"
								size="sm"
								variant={item.installed ? 'outline' : 'default'}
								disabled={Boolean(pendingKey)}
								onClick={() => onDownloadResource(item.id, 'GEO 数据库')}
							>
								<Icon icon={Download} size={12} />
								{item.installed ? '重新下载' : '下载 GEO 库'}
							</Button>
						</div>
						{resourceProgress?.resourceId === item.id ? (
							<div className="mt-2 space-y-1">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground">
									<span>
										{resourceProgress.stage === 'error'
											? '失败'
											: resourceProgress.stage === 'done'
												? '已完成'
												: '下载中'}
									</span>
									<span>
										{resourceProgress.percent === null
											? '--'
											: `${Math.floor(resourceProgress.percent)}%`}
									</span>
								</div>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
									<div
										className={`h-full transition-all ${resourceProgress.stage === 'error' ? 'bg-destructive' : 'bg-primary'}`}
										style={{
											width: `${Math.max(3, Math.min(100, resourceProgress.percent ?? 0))}%`,
										}}
									/>
								</div>
								<p className="text-[11px] text-muted-foreground">
									{formatBytes(resourceProgress.downloadedBytes)} /{' '}
									{formatBytes(resourceProgress.totalBytes)}
								</p>
							</div>
						) : null}
					</div>
				))}
			</div>
		</Card>
	);
}
