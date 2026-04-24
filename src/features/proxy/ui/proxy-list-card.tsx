import type { TFunction } from 'i18next';
import {
	Ellipsis,
	Globe,
	Link2,
	LoaderCircle,
	Pencil,
	RefreshCw,
	RotateCcw,
	Search,
	Trash2,
	Upload,
} from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GoogleIcon from '@/assets/icon/google.svg?react';
import YouTubeIcon from '@/assets/icon/youtube.svg?react';

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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { useIsMobile } from '@/hooks/use-mobile';

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

type ProxyRowProps = {
	item: ProxyItem;
	selected: boolean;
	isChecking: boolean;
	pending: boolean;
	rowActionDisabled: boolean;
	boundCount: number;
	locale: string;
	t: TFunction;
	onSelectProxy: (proxyId: string, checked: boolean) => void;
	onOpenBinding: (proxyId: string) => void;
	onOpenEdit: (proxyId: string) => void;
	onCheckProxy: (proxyId: string) => void;
	onRequestDelete: (proxyId: string) => void;
	onRestoreProxy: (proxyId: string) => void;
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

function resolveStatusLabel(item: ProxyItem, t: TFunction) {
	switch (item.checkStatus) {
		case 'ok':
			return '';
		case 'error':
			return t('common:detectAbnormal');
		case 'unsupported':
			return t('common:notSupported');
		default:
			return t('common:notDetected');
	}
}

function formatTimestamp(input: number | null, t: TFunction, locale: string) {
	if (!input) return t('common:notDetected');
	return new Date(input * 1000).toLocaleString(locale, {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatExpiry(input: number | null, t: TFunction, locale: string) {
	if (!input) return t('common:notSet');
	const now = Date.now();
	const target = input * 1000;
	if (target <= now) return t('common:expired');
	return new Date(target).toLocaleString(locale, {
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

const TARGET_SITES = [
	{ site: 'google.com', label: 'Google', IconComponent: GoogleIcon },
	{ site: 'youtube.com', label: 'YouTube', IconComponent: YouTubeIcon },
] as const;

function findTargetSiteCheck(item: ProxyItem, site: string) {
	return item.targetSiteChecks.find((entry) => entry.site.trim().toLowerCase() === site);
}

function resolveTargetSiteSummary(item: ProxyItem, t: TFunction) {
	const statuses = TARGET_SITES.map(({ site }) => findTargetSiteCheck(item, site));
	if (statuses.every((status) => !status)) {
		return t('common:notDetected');
	}
	const reachableCount = statuses.filter((status) => status?.reachable).length;
	return `${reachableCount}/${TARGET_SITES.length} ${t('common:reachable')}`;
}

function useProxyRowState({
	item,
	locale,
	t,
	onSelectProxy,
	onCheckProxy,
	onOpenEdit,
	onOpenBinding,
	onRequestDelete,
	onRestoreProxy,
}: Pick<
	ProxyRowProps,
	| 'item'
	| 'locale'
	| 't'
	| 'onSelectProxy'
	| 'onCheckProxy'
	| 'onOpenEdit'
	| 'onOpenBinding'
	| 'onRequestDelete'
	| 'onRestoreProxy'
>) {
	const latencyMs = useMemo(() => resolveLatency(item), [item]);
	const latencyTone = useMemo(() => resolveLatencyTone(item, latencyMs), [item, latencyMs]);
	const countryFlag = useMemo(() => resolveCountryFlag(item.country), [item.country]);
	const exitIpLabel =
		item.exitIp ||
		(item.checkStatus === 'ok' ? t('common:exitIpFetchFailed') : t('common:exitIpNotDetected'));
	const statusLabel = resolveStatusLabel(item, t);
	const displayName = resolveProxyDisplayName(item);
	const address = formatProxyAddress(item.protocol, item.host, item.port);
	const recentCheckLabel = formatTimestamp(item.lastCheckedAt, t, locale);
	const targetSummary = resolveTargetSiteSummary(item, t);
	const fallbackHealth =
		item.checkStatus === 'ok'
			? t('common:latencyPending')
			: item.checkMessage || `${t('common:expired')} ${formatExpiry(item.expiresAt, t, locale)}`;

	const handleSelect = useCallback(
		(checked: boolean | 'indeterminate') => {
			onSelectProxy(item.id, checked === true);
		},
		[item.id, onSelectProxy],
	);
	const handleCheck = useCallback(() => onCheckProxy(item.id), [item.id, onCheckProxy]);
	const handleEdit = useCallback(() => onOpenEdit(item.id), [item.id, onOpenEdit]);
	const handleBinding = useCallback(() => onOpenBinding(item.id), [item.id, onOpenBinding]);
	const handleDelete = useCallback(() => onRequestDelete(item.id), [item.id, onRequestDelete]);
	const handleRestore = useCallback(() => onRestoreProxy(item.id), [item.id, onRestoreProxy]);

	return {
		address,
		countryFlag,
		displayName,
		exitIpLabel,
		fallbackHealth,
		handleBinding,
		handleCheck,
		handleDelete,
		handleEdit,
		handleRestore,
		handleSelect,
		latencyMs,
		latencyTone,
		recentCheckLabel,
		statusLabel,
		targetSummary,
	};
}

const ProxyMobileListItem = memo(function ProxyMobileListItem({
	item,
	selected,
	isChecking,
	pending,
	rowActionDisabled,
	boundCount,
	locale,
	t,
	onSelectProxy,
	onOpenBinding,
	onOpenEdit,
	onCheckProxy,
	onRequestDelete,
	onRestoreProxy,
}: ProxyRowProps) {
	const row = useProxyRowState({
		item,
		locale,
		t,
		onSelectProxy,
		onCheckProxy,
		onOpenEdit,
		onOpenBinding,
		onRequestDelete,
		onRestoreProxy,
	});

	return (
		<div className="rounded-xl border border-border/70 bg-background/75 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-2">
					<Checkbox
						checked={selected}
						disabled={item.lifecycle !== 'active' || pending || isChecking}
						onCheckedChange={row.handleSelect}
					/>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-medium">{row.displayName}</p>
							<Badge variant="outline" className="text-[10px] uppercase">
								{item.protocol}
							</Badge>
							<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>
								{item.lifecycle === 'active' ? t('common:active') : t('common:archived')}
							</Badge>
						</div>
						<p className="mt-1 truncate text-xs text-muted-foreground">{row.address}</p>
						<p className="mt-1 truncate text-[11px] text-muted-foreground">
							{item.provider || t('common:providerNotSet')} ·{' '}
							{t('common:itemBoundCount', { count: boundCount })}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{item.lifecycle === 'active' ? (
						<>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								disabled={pending || rowActionDisabled || isChecking}
								onClick={row.handleCheck}
							>
								<Icon
									icon={isChecking ? LoaderCircle : Search}
									size={13}
									className={isChecking ? 'animate-spin' : ''}
								/>
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										size="icon-sm"
										variant="ghost"
										disabled={pending || rowActionDisabled || isChecking}
									>
										<Icon icon={Ellipsis} size={14} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-44">
									<DropdownMenuItem className="cursor-pointer" onClick={row.handleEdit}>
										<Icon icon={Pencil} size={13} />
										{t('common:editItem', { item: t('common:proxy') })}
									</DropdownMenuItem>
									<DropdownMenuItem className="cursor-pointer" onClick={row.handleBinding}>
										<Icon icon={Link2} size={13} />
										{t('common:bind')}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="cursor-pointer text-destructive focus:text-destructive"
										onClick={row.handleDelete}
									>
										<Icon icon={Trash2} size={13} />
										{t('common:deleteItem', { item: t('common:proxy') })}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					) : (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={pending || rowActionDisabled}
							onClick={row.handleRestore}
						>
							<Icon icon={RotateCcw} size={12} />
							{t('common:restore')}
						</Button>
					)}
				</div>
			</div>

			<div className="mt-3 grid gap-2 sm:grid-cols-2">
				<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<p className="text-[11px] text-muted-foreground">{t('common:geo')}</p>
					<p className="mt-1 text-sm font-medium">
						{row.countryFlag ? `${row.countryFlag} ` : ''}
						{item.country || t('common:unknownCountry')}
					</p>
					<p className="text-[11px] text-muted-foreground">
						{item.region || t('common:unknownRegion')} / {item.city || t('common:unknownCity')}
					</p>
				</div>
				<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<p className="text-[11px] text-muted-foreground">{t('common:exit')}</p>
					<p className="mt-1 text-sm font-medium break-all">{row.exitIpLabel}</p>
					<p className="text-[11px] text-muted-foreground">
						{t('common:recentCheck')} {row.recentCheckLabel}
					</p>
				</div>
				<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<p className="text-[11px] text-muted-foreground">{t('common:siteReachability')}</p>
					<p className="mt-1 text-sm font-medium">{row.targetSummary}</p>
				</div>
				<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<p className="text-[11px] text-muted-foreground">{t('common:health')}</p>
					<p className={`mt-1 text-sm font-medium ${row.latencyTone}`}>
						{row.latencyMs !== null
							? t('common:latencyMs', { ms: row.latencyMs })
							: row.fallbackHealth}
					</p>
					{row.statusLabel ? (
						<p className="text-[11px] text-muted-foreground">{row.statusLabel}</p>
					) : null}
				</div>
			</div>
		</div>
	);
});

const ProxyTableRow = memo(function ProxyTableRow({
	item,
	selected,
	isChecking,
	pending,
	rowActionDisabled,
	boundCount,
	locale,
	t,
	onSelectProxy,
	onOpenBinding,
	onOpenEdit,
	onCheckProxy,
	onRequestDelete,
	onRestoreProxy,
}: ProxyRowProps) {
	const row = useProxyRowState({
		item,
		locale,
		t,
		onSelectProxy,
		onCheckProxy,
		onOpenEdit,
		onOpenBinding,
		onRequestDelete,
		onRestoreProxy,
	});

	return (
		<TableRow>
			<TableCell>
				<div className="flex justify-center">
					<Checkbox
						checked={selected}
						disabled={item.lifecycle !== 'active' || pending || isChecking}
						onCheckedChange={row.handleSelect}
					/>
				</div>
			</TableCell>
			<TableCell>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium">{row.displayName}</p>
						<Badge variant="outline" className="text-[10px] uppercase">
							{item.protocol}
						</Badge>
					</div>
					<p className="truncate text-xs text-muted-foreground">{row.address}</p>
					<p className="truncate text-[11px] text-muted-foreground">
						{item.provider || t('common:providerNotSet')} ·{' '}
						{t('common:itemBoundCount', { count: boundCount })}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<div className="min-w-0">
					<p className="flex items-center gap-2 font-medium">
						{row.countryFlag ? (
							<span className="text-base leading-none">{row.countryFlag}</span>
						) : (
							<Icon icon={Globe} size={14} className="text-muted-foreground" />
						)}
						<span className="truncate">{item.country || t('common:unknownCountry')}</span>
					</p>
					<p className="truncate text-[11px] text-muted-foreground">
						{item.region || t('common:unknownRegion')} / {item.city || t('common:unknownCity')}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<p className="truncate font-medium">{row.exitIpLabel}</p>
				<p className="truncate text-[11px] text-muted-foreground">
					{t('common:recentCheck')} {row.recentCheckLabel}
				</p>
			</TableCell>
			<TableCell>
				<p className="truncate text-[11px] text-muted-foreground">{row.targetSummary}</p>
				<div className="mt-1 flex flex-col gap-1">
					{TARGET_SITES.map(({ site, label, IconComponent }) => {
						const target = findTargetSiteCheck(item, site);
						const itemStatusLabel = !target
							? t('common:notDetected')
							: target.reachable
								? t('common:reachable')
								: t('common:unreachable');
						const statusClass = !target
							? 'text-muted-foreground'
							: target.reachable
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-destructive';
						const tip = target?.error
							? `${label}: ${target.error}`
							: target?.statusCode
								? `${label}: HTTP ${target.statusCode}`
								: label;
						return (
							<p
								key={`${item.id}-${site}`}
								className="flex items-center gap-1 text-[11px]"
								title={tip}
							>
								<IconComponent className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate text-muted-foreground">{label}</span>
								<span className={`truncate font-medium ${statusClass}`}>{itemStatusLabel}</span>
							</p>
						);
					})}
				</div>
			</TableCell>
			<TableCell className="w-[140px] align-top whitespace-normal">
				<div className="flex flex-col gap-1">
					<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>
						{item.lifecycle === 'active' ? t('common:active') : t('common:archived')}
					</Badge>
					{row.statusLabel ? (
						<p className="text-[11px] text-muted-foreground">{row.statusLabel}</p>
					) : null}
					{row.latencyMs === null && item.checkStatus !== 'ok' && item.checkMessage ? (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<p className={`truncate text-[11px] font-medium ${row.latencyTone}`}>
										{item.checkMessage}
									</p>
								</TooltipTrigger>
								<TooltipContent className="max-w-64 break-words">
									<p>{item.checkMessage}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					) : (
						<p className={`truncate text-[11px] font-medium ${row.latencyTone}`}>
							{row.latencyMs !== null
								? t('common:latencyMs', { ms: row.latencyMs })
								: row.fallbackHealth}
						</p>
					)}
				</div>
			</TableCell>
			<TableCell className="w-[92px] align-top text-right">
				<div className="flex justify-end gap-1">
					{item.lifecycle === 'active' ? (
						<>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								disabled={pending || rowActionDisabled || isChecking}
								onClick={row.handleCheck}
							>
								<Icon
									icon={isChecking ? LoaderCircle : Search}
									size={13}
									className={isChecking ? 'animate-spin' : ''}
								/>
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										size="icon-sm"
										variant="ghost"
										disabled={pending || rowActionDisabled || isChecking}
									>
										<Icon icon={Ellipsis} size={14} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-44">
									<DropdownMenuItem className="cursor-pointer" onClick={row.handleEdit}>
										<Icon icon={Pencil} size={13} />
										{t('common:editItem', { item: t('common:proxy') })}
									</DropdownMenuItem>
									<DropdownMenuItem className="cursor-pointer" onClick={row.handleBinding}>
										<Icon icon={Link2} size={13} />
										{t('common:bind')}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="cursor-pointer text-destructive focus:text-destructive"
										onClick={row.handleDelete}
									>
										<Icon icon={Trash2} size={13} />
										{t('common:deleteItem', { item: t('common:proxy') })}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					) : (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={pending || rowActionDisabled}
							onClick={row.handleRestore}
						>
							<Icon icon={RotateCcw} size={12} />
							{t('common:restore')}
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
});

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
	const { t, i18n } = useTranslation();
	const isMobile = useIsMobile();
	const locale = i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US';
	const selectedProxyIdSet = useMemo(() => new Set(selectedProxyIds), [selectedProxyIds]);
	const checkingProxyIdSet = useMemo(() => new Set(checkingProxyIds), [checkingProxyIds]);
	const activeProxyIds = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'active').map((item) => item.id),
		[proxies],
	);
	const selectedActiveCount = useMemo(
		() => activeProxyIds.filter((id) => selectedProxyIdSet.has(id)).length,
		[activeProxyIds, selectedProxyIdSet],
	);
	const allActiveSelected =
		activeProxyIds.length > 0 && selectedActiveCount === activeProxyIds.length;
	const indeterminate = selectedActiveCount > 0 && !allActiveSelected;

	return (
		<Card className="p-3">
			<div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
				<div>
					<h2 className="text-sm font-semibold">{t('common:proxyList')}</h2>
					<p className="text-xs text-muted-foreground">
						{t('common:selectedActiveCount', { count: selectedActiveCount })}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="default"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || batchChecking || rowActionDisabled}
						onClick={onOpenCreate}
					>
						<Icon icon={Pencil} size={12} />
						{t('common:createItem', { item: t('common:proxy') })}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || batchChecking || rowActionDisabled}
						onClick={onOpenImport}
					>
						<Icon icon={Upload} size={12} />
						{t('common:batchImport')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || batchChecking || selectedActiveCount === 0}
						onClick={onBatchCheck}
					>
						<Icon
							icon={batchChecking ? LoaderCircle : Search}
							size={12}
							className={batchChecking ? 'animate-spin' : ''}
						/>
						{t('common:batchCheck')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || batchChecking || rowActionDisabled || selectedActiveCount === 0}
						onClick={onOpenBatchEdit}
					>
						<Icon icon={Pencil} size={12} />
						{t('common:batchEdit')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || batchChecking || rowActionDisabled || selectedActiveCount === 0}
						onClick={onOpenBatchDelete}
					>
						<Icon icon={Trash2} size={12} />
						{t('common:batchDelete')}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="w-full sm:w-auto"
						disabled={pending || refreshing || batchChecking}
						onClick={onRefresh}
					>
						<Icon
							icon={refreshing ? LoaderCircle : RefreshCw}
							size={12}
							className={refreshing ? 'animate-spin' : ''}
						/>
						{t('common:refresh')}
					</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border border-border/70">
				{proxies.length === 0 ? (
					<div className="px-4 py-10 text-center text-sm text-muted-foreground">
						{t('common:noProxyAddFirst')}
					</div>
				) : isMobile ? (
					<div className="space-y-2 p-2">
						{proxies.map((item) => (
							<ProxyMobileListItem
								key={item.id}
								item={item}
								selected={selectedProxyIdSet.has(item.id)}
								isChecking={checkingProxyIdSet.has(item.id)}
								pending={pending}
								rowActionDisabled={rowActionDisabled}
								boundCount={boundCounts[item.id] ?? 0}
								locale={locale}
								t={t}
								onSelectProxy={onSelectProxy}
								onOpenBinding={onOpenBinding}
								onOpenEdit={onOpenEdit}
								onCheckProxy={onCheckProxy}
								onRequestDelete={onRequestDelete}
								onRestoreProxy={onRestoreProxy}
							/>
						))}
					</div>
				) : (
					<Table className="table-fixed">
						<colgroup>
							<col className="w-[48px]" />
							<col className="w-[34%]" />
							<col className="w-[16%]" />
							<col className="w-[16%]" />
							<col className="w-[18%]" />
							<col className="w-[140px]" />
							<col className="w-[92px]" />
						</colgroup>
						<TableHeader>
							<TableRow className="bg-muted/20 hover:bg-muted/20">
								<TableHead className="w-[48px]">
									<div className="flex justify-center">
										<Checkbox
											checked={allActiveSelected ? true : indeterminate ? 'indeterminate' : false}
											disabled={activeProxyIds.length === 0 || pending}
											onCheckedChange={(checked) => onSelectAll(checked === true)}
										/>
									</div>
								</TableHead>
								<TableHead>{t('common:proxy')}</TableHead>
								<TableHead>{t('common:geo')}</TableHead>
								<TableHead>{t('common:exit')}</TableHead>
								<TableHead>{t('common:siteReachability')}</TableHead>
								<TableHead className="w-[140px]">{t('common:health')}</TableHead>
								<TableHead className="w-[92px] text-right">{t('common:actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{proxies.map((item) => (
								<ProxyTableRow
									key={item.id}
									item={item}
									selected={selectedProxyIdSet.has(item.id)}
									isChecking={checkingProxyIdSet.has(item.id)}
									pending={pending}
									rowActionDisabled={rowActionDisabled}
									boundCount={boundCounts[item.id] ?? 0}
									locale={locale}
									t={t}
									onSelectProxy={onSelectProxy}
									onOpenBinding={onOpenBinding}
									onOpenEdit={onOpenEdit}
									onCheckProxy={onCheckProxy}
									onRequestDelete={onRequestDelete}
									onRestoreProxy={onRestoreProxy}
								/>
							))}
						</TableBody>
					</Table>
				)}
			</div>
		</Card>
	);
}
