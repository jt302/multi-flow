import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

import { Badge, Button, Card, Icon } from '@/components/ui';
import type { ProxyItem } from '@/entities/proxy/model/types';

type ProxyListCardProps = {
	proxies: ProxyItem[];
	pending: boolean;
	onRefresh: () => void;
	onDeleteProxy: (proxyId: string) => void;
	onRestoreProxy: (proxyId: string) => void;
};

function formatProxyAddress(protocol: string, host: string, port: number) {
	return `${protocol}://${host}:${port}`;
}

export function ProxyListCard({
	proxies,
	pending,
	onRefresh,
	onDeleteProxy,
	onRestoreProxy,
}: ProxyListCardProps) {
	return (
		<Card className="p-3">
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-sm font-semibold">代理列表</h2>
				<Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
					<Icon icon={RefreshCw} size={12} />
					刷新
				</Button>
			</div>

			<div className="overflow-hidden rounded-xl border border-border/70">
				{proxies.length === 0 ? (
					<div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无代理，请先新增。</div>
				) : (
					proxies.map((item, index) => (
						<div
							key={item.id}
							className={`grid grid-cols-[minmax(0,1fr)_96px_132px] items-center gap-3 px-3 py-3 text-sm ${
								index < proxies.length - 1 ? 'border-b border-border/70' : ''
							}`}
						>
							<div className="min-w-0">
								<p className="truncate font-medium">{item.name}</p>
								<p className="truncate text-xs text-muted-foreground">
									{formatProxyAddress(item.protocol, item.host, item.port)}
								</p>
								<p className="truncate text-[11px] text-muted-foreground">
									{item.country || '未知国家'} · {item.provider || '未填写供应商'}
								</p>
							</div>
							<div>
								<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>
									{item.lifecycle === 'active' ? '可用' : '已归档'}
								</Badge>
							</div>
							<div className="flex justify-end gap-1">
								{item.lifecycle === 'active' ? (
									<Button
										type="button"
										size="icon"
										variant="ghost"
										className="h-8 w-8"
										disabled={pending}
										onClick={() => onDeleteProxy(item.id)}
									>
										<Icon icon={Trash2} size={13} />
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={pending}
										onClick={() => onRestoreProxy(item.id)}
									>
										<Icon icon={RotateCcw} size={12} />
										恢复
									</Button>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</Card>
	);
}
