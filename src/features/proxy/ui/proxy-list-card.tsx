import { Ellipsis, Globe, Link2, LoaderCircle, Pencil, RefreshCw, RotateCcw, Search, Trash2, Upload } from 'lucide-react';

import {
	Badge,
	Button,
	Card,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Icon,
} from '@/components/ui';
import type { ProxyItem } from '@/entities/proxy/model/types';

type ProxyListCardProps = {
	proxies: ProxyItem[];
	pending: boolean;
	selectedProxyIds: string[];
	onSelectAll: (checked: boolean) => void;
	onSelectProxy: (proxyId: string, checked: boolean) => void;
	onOpenCreate: () => void;
	onOpenImport: () => void;
	onOpenBinding: (proxyId: string) => void;
	onOpenEdit: (proxyId: string) => void;
	onOpenBatchEdit: () => void;
	onOpenBatchDelete: () => void;
	onBatchCheck: () => void;
	onRefresh: () => void;
	onCheckProxy: (proxyId: string) => void;
	onRequestDelete: (proxyId: string) => void;
	onRestoreProxy: (proxyId: string) => void;
	boundCounts: Record<string, number>;
	checkingProxyIds: string[];
	batchChecking: boolean;
	refreshing: boolean;
	rowActionDisabled: boolean;
};

function formatProxyAddress(protocol: string, host: string, port: number) {
	return `${protocol}://${host}:${port}`;
}

function resolveProxyDisplayName(item: ProxyItem) {
	const normalizedName = item.name.trim().toLowerCase();
	const generatedPrefixes = ['http', 'https', 'socks5', 'ssh'];
	for (const prefix of generatedPrefixes) {
		if (normalizedName === `${prefix}-${item.host}:${item.port}`.toLowerCase()) {
			return `${item.host}:${item.port}`;
		}
	}
	return item.name;
}

function resolveCountryFlag(countryCode: string) {
	const trimmed = countryCode.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(trimmed)) {
		return null;
	}
	return String.fromCodePoint(
		...trimmed.split('').map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
	);
}

function resolveStatusLabel(item: ProxyItem) {
	switch (item.checkStatus) {
		case 'ok':
			return '';
		case 'error':
			return '检测异常';
		case 'unsupported':
			return '暂不支持';
		default:
			return '未检测';
	}
}

function formatTimestamp(input: number | null) {
	if (!input) return '未检测';
	return new Date(input * 1000).toLocaleString('zh-CN', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatExpiry(input: number | null) {
	if (!input) return '未设置';
	const now = Date.now();
	const target = input * 1000;
	if (target <= now) return '已过期';
	return new Date(target).toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function resolveLatency(item: ProxyItem) {
	const match = item.checkMessage.match(/(\d+)\s*ms/i);
	if (!match) return null;
	const value = Number.parseInt(match[1], 10);
	return Number.isFinite(value) ? value : null;
}

function resolveLatencyTone(item: ProxyItem, latencyMs: number | null) {
	if (item.checkStatus !== 'ok' || latencyMs === null) {
		return 'text-destructive';
	}
	if (latencyMs <= 300) {
		return 'text-emerald-600 dark:text-emerald-400';
	}
	if (latencyMs <= 1000) {
		return 'text-amber-600 dark:text-amber-400';
	}
	return 'text-destructive';
}

export function ProxyListCard({
	proxies,
	pending,
	selectedProxyIds,
	onSelectAll,
	onSelectProxy,
	onOpenCreate,
	onOpenImport,
	onOpenBinding,
	onOpenEdit,
	onOpenBatchEdit,
	onOpenBatchDelete,
	onBatchCheck,
	onRefresh,
	onCheckProxy,
	onRequestDelete,
	onRestoreProxy,
	boundCounts,
	checkingProxyIds,
	batchChecking,
	refreshing,
	rowActionDisabled,
}: ProxyListCardProps) {
	const activeProxyIds = proxies.filter((item) => item.lifecycle === 'active').map((item) => item.id);
	const selectedActiveCount = activeProxyIds.filter((id) => selectedProxyIds.includes(id)).length;
	const allActiveSelected = activeProxyIds.length > 0 && selectedActiveCount === activeProxyIds.length;
	const indeterminate = selectedActiveCount > 0 && !allActiveSelected;

	return (
		<Card className="p-3">
			<div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
				<div>
					<h2 className="text-sm font-semibold">代理列表</h2>
					<p className="text-xs text-muted-foreground">已选 {selectedActiveCount} 个活跃代理</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" variant="default" size="sm" className="cursor-pointer" disabled={pending || batchChecking || rowActionDisabled} onClick={onOpenCreate}><Icon icon={Pencil} size={12} />新增代理</Button>
					<Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={pending || batchChecking || rowActionDisabled} onClick={onOpenImport}><Icon icon={Upload} size={12} />批量导入</Button>
					<Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={pending || batchChecking || selectedActiveCount === 0} onClick={onBatchCheck}><Icon icon={batchChecking ? LoaderCircle : Search} size={12} className={batchChecking ? 'animate-spin' : ''} />批量检测</Button>
					<Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={pending || batchChecking || rowActionDisabled || selectedActiveCount === 0} onClick={onOpenBatchEdit}><Icon icon={Pencil} size={12} />批量修改</Button>
					<Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={pending || batchChecking || rowActionDisabled || selectedActiveCount === 0} onClick={onOpenBatchDelete}><Icon icon={Trash2} size={12} />批量删除</Button>
					<Button type="button" variant="ghost" size="sm" className="cursor-pointer" disabled={pending || refreshing || batchChecking} onClick={onRefresh}><Icon icon={refreshing ? LoaderCircle : RefreshCw} size={12} className={refreshing ? 'animate-spin' : ''} />刷新</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-border/70">
				{proxies.length === 0 ? (
					<div className="px-4 py-10 text-center text-sm text-muted-foreground">暂无代理，请先新增。</div>
				) : (
					<>
						<div className="grid grid-cols-[48px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px] items-center gap-3 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
							<div className="flex justify-center"><Checkbox checked={allActiveSelected ? true : indeterminate ? 'indeterminate' : false} className="cursor-pointer" disabled={activeProxyIds.length === 0 || pending} onCheckedChange={(checked) => onSelectAll(checked === true)} /></div>
							<div>代理</div>
							<div>GEO</div>
							<div>出口</div>
							<div>健康</div>
							<div className="text-right">操作</div>
						</div>
						{proxies.map((item, index) => (
							<div key={item.id} className={`grid grid-cols-[48px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px] items-center gap-3 px-3 py-3 text-sm ${index < proxies.length - 1 ? 'border-b border-border/70' : ''}`}>
								<div className="flex justify-center"><Checkbox checked={selectedProxyIds.includes(item.id)} disabled={item.lifecycle !== 'active' || pending || checkingProxyIds.includes(item.id)} className="cursor-pointer" onCheckedChange={(checked) => onSelectProxy(item.id, checked === true)} /></div>
								{(() => {
									const latencyMs = resolveLatency(item);
									const latencyTone = resolveLatencyTone(item, latencyMs);
									const isChecking = checkingProxyIds.includes(item.id);
									const exitIpLabel =
										item.exitIp ||
										(item.checkStatus === 'ok'
											? '出口 IP 获取失败'
											: '未检测出口 IP');
									const statusLabel = resolveStatusLabel(item);
									return (
										<>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<p className="truncate font-medium">{resolveProxyDisplayName(item)}</p>
										<Badge variant="outline" className="text-[10px] uppercase">{item.protocol}</Badge>
									</div>
									<p className="truncate text-xs text-muted-foreground">{formatProxyAddress(item.protocol, item.host, item.port)}</p>
									<p className="truncate text-[11px] text-muted-foreground">{item.provider || '未填写供应商'} · 绑定 {boundCounts[item.id] ?? 0} 个环境</p>
								</div>
								<div className="min-w-0 space-y-1">
									<p className="flex items-center gap-2 font-medium">
										{resolveCountryFlag(item.country) ? (
											<span className="text-base leading-none">{resolveCountryFlag(item.country)}</span>
										) : (
											<Icon icon={Globe} size={14} className="text-muted-foreground" />
										)}
										<span className="truncate">{item.country || '未知国家'}</span>
									</p>
									<p className="truncate text-[11px] text-muted-foreground">{item.region || '未知区域'} / {item.city || '未知城市'}</p>
								</div>
								<div className="min-w-0 space-y-1">
									<p className="truncate font-medium">{exitIpLabel}</p>
									<p className="truncate text-[11px] text-muted-foreground">最近检测 {formatTimestamp(item.lastCheckedAt)}</p>
								</div>
								<div className="space-y-1 min-w-0">
									<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>{item.lifecycle === 'active' ? '可用' : '已归档'}</Badge>
									{statusLabel ? <p className="text-[11px] text-muted-foreground">{statusLabel}</p> : null}
									<p className={`truncate text-[11px] font-medium ${latencyTone}`}>
										{latencyMs !== null ? `${latencyMs} ms` : item.checkStatus === 'ok' ? '延迟待回填' : item.checkMessage || `过期时间 ${formatExpiry(item.expiresAt)}`}
									</p>
								</div>
								<div className="flex justify-end gap-1">
									{item.lifecycle === 'active' ? (
										<>
											<Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" disabled={pending || rowActionDisabled || isChecking} onClick={() => onCheckProxy(item.id)}><Icon icon={isChecking ? LoaderCircle : Search} size={13} className={isChecking ? 'animate-spin' : ''} /></Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" disabled={pending || rowActionDisabled || isChecking}>
														<Icon icon={Ellipsis} size={14} />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-44">
													<DropdownMenuItem className="cursor-pointer" onClick={() => onOpenEdit(item.id)}>
														<Icon icon={Pencil} size={13} />
														编辑代理
													</DropdownMenuItem>
													<DropdownMenuItem className="cursor-pointer" onClick={() => onOpenBinding(item.id)}>
														<Icon icon={Link2} size={13} />
														环境绑定
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="cursor-pointer text-destructive focus:text-destructive"
														onClick={() => onRequestDelete(item.id)}
													>
														<Icon icon={Trash2} size={13} />
														删除代理
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</>
									) : (
										<Button type="button" size="sm" variant="outline" className="cursor-pointer" disabled={pending || rowActionDisabled} onClick={() => onRestoreProxy(item.id)}><Icon icon={RotateCcw} size={12} />恢复</Button>
									)}
								</div>
										</>
									);
								})()}
							</div>
						))}
					</>
				)}
			</div>
		</Card>
	);
}
