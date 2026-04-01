import {
	Eye,
	FileDown,
	Globe,
	Loader2,
	Monitor,
	MoreHorizontal,
	FolderTree,
	Palette,
	Play,
	Puzzle,
	RotateCcw,
	Square,
	Trash2,
	Type,
	Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	Badge,
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Icon,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	TableCell,
	TableRow,
} from '@/components/ui';
import {
	formatProfileTime,
	resolveBrowserVersionMeta,
	resolvePlatformMeta,
} from '@/entities/profile/lib/profile-list';
import type {
	ExportProfileCookiesPayload,
	ExportProfileCookiesResponse,
	ProfileActionState,
	ProfileItem,
	ProfilePluginSelection,
	ReadProfileCookiesResponse,
} from '@/entities/profile/model/types';
import { listPluginPackages, readProfilePlugins, updateProfilePlugins } from '@/entities/plugin/api/plugins-api';
import type { PluginPackage } from '@/entities/plugin/model/types';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import { cn } from '@/lib/utils';

import { PlatformMark } from '@/entities/profile/ui/platform-mark';
import { BackgroundQuickEditForm, ToolbarQuickEditForm } from './profile-list-quick-edit-forms';

type QuickEditField = 'background' | 'toolbar';

type ProfileListItemProps = {
	item: ProfileItem;
	groups: GroupItem[];
	resources: ResourceItem[];
	index: number;
	total: number;
	selected: boolean;
	onSelectedChange: (checked: boolean) => void;
	actionState?: ProfileActionState;
	boundProxy?: ProxyItem;
	quickEdit: { profileId: string; field: QuickEditField } | null;
	onQuickEditChange: (value: { profileId: string; field: QuickEditField } | null) => void;
	onRunAction: (action: () => Promise<void>) => Promise<void>;
	onViewProfile: (profileId: string) => void;
	onCreateClick: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onReadProfileCookies: (profileId: string) => Promise<ReadProfileCookiesResponse>;
	onExportProfileCookies: (
		profileId: string,
		payload: ExportProfileCookiesPayload,
	) => Promise<ExportProfileCookiesResponse>;
	onRefreshProfiles: () => Promise<void>;
};

function resolveRunningLabel(running: boolean, actionState?: ProfileActionState) {
	if (actionState === 'opening') {
		return '启动中';
	}
	if (actionState === 'closing') {
		return '关闭中';
	}
	if (actionState === 'recovering') {
		return '异常回收中';
	}
	return running ? '运行中' : '未运行';
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

function resolveProxyExitIp(proxy?: ProxyItem) {
	if (!proxy) {
		return '未绑定代理';
	}
	if (proxy.exitIp.trim()) {
		return proxy.exitIp;
	}
	return proxy.checkStatus === 'ok' ? '出口 IP 获取失败' : '未检测出口 IP';
}

function resolveProxyConnectivity(proxy?: ProxyItem): {
	label: string;
	toneClassName: string;
} {
	if (!proxy) {
		return { label: '未绑定', toneClassName: 'text-muted-foreground' };
	}
	switch (proxy.checkStatus) {
		case 'ok':
			return { label: '可用', toneClassName: 'text-emerald-600 dark:text-emerald-400' };
		case 'error':
			return { label: '异常', toneClassName: 'text-destructive' };
		case 'unsupported':
			return { label: '暂不支持', toneClassName: 'text-amber-600 dark:text-amber-400' };
		default:
			return { label: '未检测', toneClassName: 'text-muted-foreground' };
	}
}

function sanitizeCookieExportLabel(value: string) {
	const normalized = value
		.trim()
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
	return normalized || 'profile';
}

async function selectCookieExportPath(profileName: string, scope: string) {
	const profileLabel = sanitizeCookieExportLabel(profileName);
	const scopeLabel = sanitizeCookieExportLabel(scope);
	const selected = await save({
		defaultPath: `${profileLabel}-cookies-${scopeLabel}.json`,
		filters: [{ name: 'JSON', extensions: ['json'] }],
	});
	if (!selected) {
		return null;
	}
	return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export function ProfileListItem({
	item,
	groups,
	resources,
	index,
	total,
	selected,
	onSelectedChange,
	actionState,
	boundProxy,
	quickEdit,
	onQuickEditChange,
	onRunAction,
	onViewProfile,
	onCreateClick,
	onUpdateProfileVisual,
	onOpenProfile,
	onCloseProfile,
	onSetProfileGroup,
	onFocusProfileWindow,
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
}: ProfileListItemProps) {
	const actionPending = Boolean(actionState);
	const runLabel = resolveRunningLabel(item.running, actionState);
	const platformMeta = resolvePlatformMeta(item);
	const currentBg = item.settings?.basic?.browserBgColor ?? '#0F8A73';
	const currentToolbarText = item.settings?.basic?.toolbarText ?? item.name;
	const normalizedNote =
		item.note?.trim() && item.note.trim() !== '未填写备注' ? item.note.trim() : '无备注';
	const groupLabel = item.group?.trim() || '未分组';
	const presetLabel =
		item.settings?.fingerprint?.fingerprintSnapshot?.presetLabel?.trim() ||
		item.settings?.basic?.devicePresetId?.trim() ||
		'未设置预设';
	const browserVersionMeta = resolveBrowserVersionMeta(item, resources);
	const toolbarTextTrimmed = currentToolbarText.trim();
	const showToolbarText = Boolean(toolbarTextTrimmed) && toolbarTextTrimmed !== item.name.trim();
	const proxyFlag = boundProxy ? resolveCountryFlag(boundProxy.country) : null;
	const proxyLocation = boundProxy
		? `${boundProxy.country?.trim() || '未知国家'} / ${boundProxy.region?.trim() || '未知地区'}`
		: '未绑定代理';
	const proxyIp = resolveProxyExitIp(boundProxy);
	const proxyType = boundProxy ? boundProxy.protocol.toUpperCase() : '未绑定';
	const proxyConnectivity = resolveProxyConnectivity(boundProxy);
	const editConfigDisabled = actionPending || item.running;
	const isBgEditing = quickEdit?.profileId === item.id && quickEdit.field === 'background';
	const isToolbarEditing = quickEdit?.profileId === item.id && quickEdit.field === 'toolbar';
	const [siteExportDialogOpen, setSiteExportDialogOpen] = useState(false);
	const [cookieSiteUrls, setCookieSiteUrls] = useState<string[]>([]);
	const [selectedCookieSiteUrl, setSelectedCookieSiteUrl] = useState('');
	const [cookieSiteLoading, setCookieSiteLoading] = useState(false);
	const [cookieSiteExporting, setCookieSiteExporting] = useState(false);
	const [cookieSiteError, setCookieSiteError] = useState<string | null>(null);
	const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
	const [pluginDraft, setPluginDraft] = useState<ProfilePluginSelection[]>([]);
	const [pluginSaving, setPluginSaving] = useState(false);
	const pluginPackagesQuery = useQuery<PluginPackage[]>({
		queryKey: ['plugin-packages'],
		queryFn: listPluginPackages,
		enabled: pluginDialogOpen,
	});
	const profilePluginsQuery = useQuery({
		queryKey: ['profile-plugins', item.id, pluginDialogOpen],
		queryFn: () => readProfilePlugins(item.id),
		enabled: pluginDialogOpen,
	});

	useEffect(() => {
		if (!pluginDialogOpen || !profilePluginsQuery.data) {
			return;
		}
		setPluginDraft(profilePluginsQuery.data);
	}, [pluginDialogOpen, profilePluginsQuery.data]);

	const openSiteExportDialog = async () => {
		setCookieSiteError(null);
		setCookieSiteLoading(true);
		try {
			const result = await onReadProfileCookies(item.id);
			setCookieSiteUrls(result.siteUrls);
			setSelectedCookieSiteUrl(result.siteUrls[0] ?? '');
			setSiteExportDialogOpen(true);
			if (result.siteUrls.length === 0) {
				setCookieSiteError('当前环境没有可导出的站点 Cookie。');
			}
		} catch (error) {
			setCookieSiteError(error instanceof Error ? error.message : '读取 Cookie 站点失败');
			setCookieSiteUrls([]);
			setSelectedCookieSiteUrl('');
			setSiteExportDialogOpen(true);
		} finally {
			setCookieSiteLoading(false);
		}
	};

	const exportAllCookies = async () => {
		const exportPath = await selectCookieExportPath(item.name, 'all');
		if (!exportPath) {
			return;
		}
		await onExportProfileCookies(item.id, {
			mode: 'all',
			exportPath,
		});
	};

	return (
		<>
			<TableRow className={cn('group relative transition-all duration-300 hover:bg-muted/30 hover:shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]', index === total - 1 && 'border-b-0')}>
				<TableCell className="w-[86px] align-top">
					<div className="grid grid-cols-[1rem_2.25rem] items-center justify-center gap-2 pt-1">
						<Checkbox
							checked={selected}
							disabled={item.lifecycle !== 'active'}
							onCheckedChange={(checked) => onSelectedChange(checked === true)}
						/>
						<PlatformMark meta={platformMeta} size="sm" />
					</div>
				</TableCell>

				<TableCell className="align-top">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-medium">{item.name}</p>
							<Badge variant="outline" className="max-w-[140px] truncate text-[10px]">
								{groupLabel}
							</Badge>
							{showToolbarText ? (
								<Badge variant="secondary" className="max-w-[160px] truncate text-[10px]">
									{toolbarTextTrimmed}
								</Badge>
							) : null}
						</div>
						<p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
							<span
								className="inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium"
								style={{
									backgroundColor: `color-mix(in oklab, ${currentBg} 18%, transparent)`,
									borderColor: `color-mix(in oklab, ${currentBg} 36%, var(--border))`,
									color: `color-mix(in oklab, ${currentBg} 62%, var(--foreground))`,
								}}
							>
								{currentBg}
							</span>
							<span className="truncate">备注 {normalizedNote}</span>
						</p>
					</div>
				</TableCell>

				<TableCell className="align-top">
					<p className="truncate text-xs text-muted-foreground">{normalizedNote}</p>
					<p className="mt-1 truncate text-[11px] text-muted-foreground">
						{browserVersionMeta.versionLabel} · {browserVersionMeta.resourceLabel}
					</p>
				</TableCell>

				<TableCell className="align-top">
					<p className="truncate text-xs">{presetLabel}</p>
					<p className="truncate text-[11px] text-muted-foreground">{platformMeta.label}</p>
				</TableCell>

				<TableCell className="align-top">
					<div className="space-y-1">
						<p className="flex items-center gap-2 text-xs font-medium">
							{proxyFlag ? (
								<span className="text-base leading-none">{proxyFlag}</span>
							) : (
								<Icon icon={Globe} size={14} className="text-muted-foreground" />
							)}
							<span className="truncate">{proxyLocation}</span>
						</p>
						<p className="truncate text-[11px] text-muted-foreground">IP: {proxyIp}</p>
						<p className="truncate text-[11px] text-muted-foreground">代理类型: {proxyType}</p>
						<p className={cn('truncate text-[11px] font-medium', proxyConnectivity.toneClassName)}>
							连通性: {proxyConnectivity.label}
						</p>
					</div>
				</TableCell>

				<TableCell className="w-[140px] align-top">
					<Badge variant={item.running || actionPending ? 'default' : 'secondary'}>
						{runLabel}
					</Badge>
					<p className="mt-1 text-[11px] text-muted-foreground">最近: {formatProfileTime(item.lastOpenedAt)}</p>
				</TableCell>

				<TableCell className="w-[130px] align-top text-right">
					<div className="flex justify-end gap-1 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
						{item.lifecycle === 'active' ? (
							<>
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									className={cn(
										item.running
											? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
											: 'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300',
									)}
									disabled={actionPending}
									onClick={() => {
										void onRunAction(item.running ? () => onCloseProfile(item.id) : () => onOpenProfile(item.id));
									}}
								>
									{actionPending ? (
										<Icon icon={Loader2} size={13} className="animate-spin" />
									) : (
										<Icon icon={item.running ? Square : Play} size={13} />
									)}
								</Button>

								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									className={cn(
										item.running
											? 'text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300'
											: 'text-muted-foreground/60',
									)}
									title={item.running ? '显示浏览器窗口' : '环境未运行'}
									disabled={actionPending || !item.running}
									onClick={() => {
										void onRunAction(() => onFocusProfileWindow(item.id));
									}}
								>
									<Icon icon={Monitor} size={13} />
								</Button>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											size="icon-sm"
											variant="ghost"
											disabled={actionPending}
										>
											<Icon icon={MoreHorizontal} size={13} />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuItem className="cursor-pointer" onClick={() => onViewProfile(item.id)}>
											<Icon icon={Eye} size={13} />
											查看详情
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												onQuickEditChange({ profileId: item.id, field: 'background' });
											}}
										>
											<Icon icon={Palette} size={13} />
											修改背景色
										</DropdownMenuItem>
										<DropdownMenuSub>
											<DropdownMenuSubTrigger className="cursor-pointer">
												<Icon icon={FolderTree} size={13} />
												设置分组
											</DropdownMenuSubTrigger>
											<DropdownMenuSubContent className="w-48">
												{groups.map((group) => (
													<DropdownMenuItem
														key={`group-${group.id}`}
														className="cursor-pointer"
														onClick={() => {
															void onRunAction(() => onSetProfileGroup(item.id, group.name));
														}}
													>
														{group.name}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="cursor-pointer"
													onClick={() => {
														void onRunAction(() => onSetProfileGroup(item.id));
													}}
												>
													清空分组
												</DropdownMenuItem>
											</DropdownMenuSubContent>
										</DropdownMenuSub>
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												onQuickEditChange({ profileId: item.id, field: 'toolbar' });
											}}
										>
											<Icon icon={Type} size={13} />
											修改工具栏文本
										</DropdownMenuItem>
										<DropdownMenuItem
											className="cursor-pointer"
											disabled={editConfigDisabled}
											onClick={() => {
												if (editConfigDisabled) {
													return;
												}
												onCreateClick(item.id);
											}}
										>
											<Icon icon={Wrench} size={13} />
											修改环境配置
										</DropdownMenuItem>
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												setPluginDialogOpen(true);
											}}
										>
											<Icon icon={Puzzle} size={13} />
											插件管理
										</DropdownMenuItem>
										{!item.running ? (
											<DropdownMenuSub>
												<DropdownMenuSubTrigger className="cursor-pointer">
													<Icon icon={FileDown} size={13} />
													导出 Cookie
												</DropdownMenuSubTrigger>
												<DropdownMenuSubContent className="w-52">
													<DropdownMenuItem
														className="cursor-pointer"
														disabled={actionPending}
														onClick={() => {
															void onRunAction(exportAllCookies);
														}}
													>
														导出整个 profile
													</DropdownMenuItem>
													<DropdownMenuItem
														className="cursor-pointer"
														disabled={actionPending}
														onClick={() => {
															void openSiteExportDialog();
														}}
													>
														按站点导出
													</DropdownMenuItem>
												</DropdownMenuSubContent>
											</DropdownMenuSub>
										) : null}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer text-destructive focus:text-destructive"
											disabled={actionPending}
											onClick={() => {
												void onRunAction(() => onDeleteProfile(item.id));
											}}
										>
											<Icon icon={Trash2} size={13} />
											删除环境
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						) : (
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={actionPending}
								onClick={() => {
									void onRunAction(() => onRestoreProfile(item.id));
								}}
							>
								{actionState === 'restoring' ? (
									<Icon icon={Loader2} size={12} className="animate-spin" />
								) : (
									<Icon icon={RotateCcw} size={12} />
								)}
								{actionState === 'restoring' ? '恢复中' : '恢复'}
							</Button>
						)}
					</div>
				</TableCell>
			</TableRow>

			<Dialog open={isBgEditing} onOpenChange={(open) => onQuickEditChange(open ? { profileId: item.id, field: 'background' } : null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>修改浏览器背景色</DialogTitle>
						<DialogDescription>
							设置后会同步更新该环境的背景色。点击“重置背景色”会移除背景色参数，恢复默认表现。
						</DialogDescription>
					</DialogHeader>
					<BackgroundQuickEditForm
						initialColor={currentBg}
						disabled={actionPending}
						onCancel={() => onQuickEditChange(null)}
						onReset={async () => {
							await onRunAction(async () => {
								await onUpdateProfileVisual(item.id, {
									browserBgColor: '',
								});
								onQuickEditChange(null);
							});
						}}
						onSubmit={async (color) => {
							await onRunAction(async () => {
								await onUpdateProfileVisual(item.id, {
									browserBgColor: color,
								});
								onQuickEditChange(null);
							});
						}}
					/>
					<DialogFooter />
				</DialogContent>
			</Dialog>

			{isToolbarEditing ? (
				<TableRow className="bg-muted/15">
					<TableCell colSpan={7}>
						<div className="rounded-lg border border-border/70 bg-background/70 p-2">
							<p className="mb-2 text-xs text-muted-foreground">修改工具栏文本（留空将回退为环境名称）</p>
							<ToolbarQuickEditForm
								initialToolbarText={currentToolbarText}
								disabled={actionPending}
								onCancel={() => onQuickEditChange(null)}
								onSubmit={async (toolbarText) => {
									await onRunAction(async () => {
										await onUpdateProfileVisual(item.id, {
											toolbarText: toolbarText.trim() ? toolbarText.trim() : undefined,
										});
										onQuickEditChange(null);
									});
								}}
							/>
						</div>
					</TableCell>
				</TableRow>
			) : null}

			<Dialog open={pluginDialogOpen} onOpenChange={setPluginDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>环境插件管理</DialogTitle>
						<DialogDescription>
							为当前环境选择要安装的已下载插件。运行中的环境保存后需要重启才会生效。
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{pluginPackagesQuery.isLoading || profilePluginsQuery.isLoading ? (
							<p className="text-sm text-muted-foreground">正在读取插件配置...</p>
						) : null}
						{pluginPackagesQuery.error instanceof Error ? (
							<p className="text-sm text-destructive">
								{pluginPackagesQuery.error.message}
							</p>
						) : null}
						{profilePluginsQuery.error instanceof Error ? (
							<p className="text-sm text-destructive">
								{profilePluginsQuery.error.message}
							</p>
						) : null}
							{(pluginPackagesQuery.data ?? []).map((plugin) => {
								const selected =
									pluginDraft.find((entry) => entry.packageId === plugin.packageId) ??
									null;
								const installId = `profile-plugin-install-${item.id}-${plugin.packageId}`;
								const enabledId = `profile-plugin-enabled-${item.id}-${plugin.packageId}`;
								return (
								<div
									key={plugin.packageId}
									className="rounded-lg border border-border/60 px-3 py-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
											<label
												htmlFor={installId}
												className="flex min-w-0 flex-1 items-start gap-3 text-sm"
											>
												<Checkbox
													id={installId}
													checked={Boolean(selected)}
												className="mt-0.5 cursor-pointer"
												onCheckedChange={(checked) => {
													setPluginDraft((prev) => {
														if (checked !== true) {
															return prev.filter(
																(entry) =>
																	entry.packageId !== plugin.packageId,
															);
														}
														return [
															...prev.filter(
																(entry) =>
																	entry.packageId !== plugin.packageId,
															),
															{ packageId: plugin.packageId, enabled: true },
														];
													});
												}}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-medium text-foreground">
														{plugin.name}
													</p>
													<Badge variant="outline">v{plugin.version}</Badge>
												</div>
												<p className="mt-1 text-xs text-muted-foreground">
													{plugin.description?.trim() || '暂无描述'}
												</p>
											</div>
										</label>
											<label
												htmlFor={enabledId}
												className="flex items-center gap-2 text-xs text-muted-foreground"
											>
												<Checkbox
													id={enabledId}
													checked={selected?.enabled ?? false}
												disabled={!selected}
												className="cursor-pointer"
												onCheckedChange={(checked) => {
													setPluginDraft((prev) =>
														prev.map((entry) =>
															entry.packageId === plugin.packageId
																? {
																		...entry,
																		enabled: checked === true,
																	}
																: entry,
														),
													);
												}}
											/>
											启用
										</label>
									</div>
								</div>
							);
						})}
						{!pluginPackagesQuery.isLoading && (pluginPackagesQuery.data?.length ?? 0) === 0 ? (
							<p className="text-sm text-muted-foreground">
								当前还没有已下载插件，请先到插件页下载。
							</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setPluginDialogOpen(false)}
						>
							取消
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={pluginSaving}
							onClick={() => {
								setPluginSaving(true);
								void (async () => {
									try {
										await updateProfilePlugins(item.id, pluginDraft);
										await onRefreshProfiles();
										toast.success('环境插件已更新');
										if (item.running) {
											toast.info('当前环境正在运行，重启后插件变更才会生效');
										}
										setPluginDialogOpen(false);
									} catch (error) {
										toast.error(
											error instanceof Error
												? error.message
												: '更新环境插件失败',
										);
									} finally {
										setPluginSaving(false);
									}
								})();
							}}
						>
							{pluginSaving ? (
								<Icon icon={Loader2} size={12} className="animate-spin" />
							) : null}
							保存插件配置
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={siteExportDialogOpen}
				onOpenChange={(open) => {
					setSiteExportDialogOpen(open);
					if (!open) {
						setCookieSiteError(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>按站点导出 Cookie</DialogTitle>
						<DialogDescription>
							从当前环境本地 Cookie 文件中选择一个站点导出。
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">站点</p>
							<Select
								value={selectedCookieSiteUrl}
								onValueChange={setSelectedCookieSiteUrl}
								disabled={cookieSiteLoading || cookieSiteUrls.length === 0}
							>
								<SelectTrigger className="cursor-pointer">
									<SelectValue
										placeholder={
											cookieSiteLoading ? '读取中...' : '选择站点'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{cookieSiteUrls.map((siteUrl) => (
										<SelectItem key={siteUrl} value={siteUrl}>
											{siteUrl}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{cookieSiteError ? (
							<p className="text-xs text-destructive">{cookieSiteError}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setSiteExportDialogOpen(false)}
						>
							取消
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={
								cookieSiteLoading ||
								cookieSiteExporting ||
								!selectedCookieSiteUrl
							}
							onClick={() => {
								setCookieSiteExporting(true);
								void (async () => {
									try {
										const exportPath = await selectCookieExportPath(
											item.name,
											selectedCookieSiteUrl,
										);
										if (!exportPath) {
											return;
										}
										await onExportProfileCookies(item.id, {
											mode: 'site',
											url: selectedCookieSiteUrl,
											exportPath,
										});
										setSiteExportDialogOpen(false);
									} catch (error) {
										setCookieSiteError(
											error instanceof Error
												? error.message
												: '按站点导出 Cookie 失败',
										);
									} finally {
										setCookieSiteExporting(false);
									}
								})();
							}}
						>
							{cookieSiteExporting ? (
								<Icon icon={Loader2} size={12} className="animate-spin" />
							) : null}
							确认导出
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
