import {
	Copy,
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
	Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
	Input,
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
	BrowserBgColorMode,
	ExportProfileCookiesPayload,
	ExportProfileCookiesResponse,
	ProfileActionState,
	ProfileItem,
	ProfilePluginSelection,
	ReadProfileCookiesResponse,
	ToolbarLabelMode,
} from '@/entities/profile/model/types';
import { listPluginPackages, readProfilePlugins, updateProfilePlugins } from '@/entities/plugin/api/plugins-api';
import type { PluginPackage } from '@/entities/plugin/model/types';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import { cn } from '@/lib/utils';

import { PlatformMark } from '@/entities/profile/ui/platform-mark';

type QuickEditField = 'visual';

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
		payload: {
			browserBgColorMode?: BrowserBgColorMode;
			browserBgColor?: string | null;
			toolbarLabelMode?: ToolbarLabelMode;
		},
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onDuplicateProfile: (profileId: string) => Promise<void>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onReadProfileCookies: (profileId: string) => Promise<ReadProfileCookiesResponse>;
	onExportProfileCookies: (
		profileId: string,
		payload: ExportProfileCookiesPayload,
	) => Promise<ExportProfileCookiesResponse>;
	onRefreshProfiles: () => Promise<void>;
};

function resolveRunningLabel(running: boolean, actionState?: ProfileActionState, t?: (key: string) => string) {
	if (!t) {
		if (actionState === 'opening') return 'Opening';
		if (actionState === 'closing') return 'Closing';
		if (actionState === 'recovering') return 'Recovering';
		return running ? 'Running' : 'Not Running';
	}
	if (actionState === 'opening') {
		return t('profile:status.opening');
	}
	if (actionState === 'closing') {
		return t('profile:status.closing');
	}
	if (actionState === 'recovering') {
		return t('profile:status.recovering');
	}
	return running ? t('profile:status.running') : t('profile:status.notRunning');
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

function resolveProxyExitIp(proxy?: ProxyItem, t?: (key: string) => string) {
	if (!t) {
		if (!proxy) return 'No Proxy';
		if (proxy.exitIp.trim()) return proxy.exitIp;
		return proxy.checkStatus === 'ok' ? 'Exit IP fetch failed' : 'Exit IP not checked';
	}
	if (!proxy) {
		return t('profile:proxy.notBound');
	}
	if (proxy.exitIp.trim()) {
		return proxy.exitIp;
	}
	return proxy.checkStatus === 'ok' ? t('profile:proxy.exitIpFailed') : t('profile:proxy.exitIpNotChecked');
}

function resolveProxyConnectivity(proxy?: ProxyItem, t?: (key: string) => string): {
	label: string;
	toneClassName: string;
} {
	if (!t) {
		if (!proxy) return { label: 'Not Bound', toneClassName: 'text-muted-foreground' };
		switch (proxy.checkStatus) {
			case 'ok': return { label: 'Available', toneClassName: 'text-emerald-600 dark:text-emerald-400' };
			case 'error': return { label: 'Error', toneClassName: 'text-destructive' };
			case 'unsupported': return { label: 'Not Supported', toneClassName: 'text-amber-600 dark:text-amber-400' };
			default: return { label: 'Not Checked', toneClassName: 'text-muted-foreground' };
		}
	}
	if (!proxy) {
		return { label: t('profile:proxyConnectivity.notBound'), toneClassName: 'text-muted-foreground' };
	}
	switch (proxy.checkStatus) {
		case 'ok':
			return { label: t('profile:proxyConnectivity.ok'), toneClassName: 'text-emerald-600 dark:text-emerald-400' };
		case 'error':
			return { label: t('profile:proxyConnectivity.error'), toneClassName: 'text-destructive' };
		case 'unsupported':
			return { label: t('profile:proxyConnectivity.unsupported'), toneClassName: 'text-amber-600 dark:text-amber-400' };
		default:
			return { label: t('profile:proxyConnectivity.notChecked'), toneClassName: 'text-muted-foreground' };
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
	onDuplicateProfile,
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
}: ProfileListItemProps) {
	const { t } = useTranslation(['profile', 'common']);
	const actionPending = Boolean(actionState);
	const runLabel = resolveRunningLabel(item.running, actionState, t);
	const platformMeta = resolvePlatformMeta(item);
	const currentBg = item.resolvedBrowserBgColor || null;
	const currentToolbarText = item.resolvedToolbarText ?? String(item.numericId);
	const noteNotFilled = t('profile:note.notFilled');
	const noteNone = t('profile:note.none');
	const normalizedNote =
		item.note?.trim() && item.note.trim() !== noteNotFilled ? item.note.trim() : noteNone;
	const groupNotGrouped = t('profile:group.notGrouped');
	const groupLabel = item.group?.trim() || groupNotGrouped;
	const presetNotSet = t('profile:preset.notSet');
	const presetLabel =
		item.settings?.fingerprint?.fingerprintSnapshot?.presetLabel?.trim() ||
		item.settings?.basic?.devicePresetId?.trim() ||
		presetNotSet;
	const browserVersionMeta = resolveBrowserVersionMeta(item, resources);
	const toolbarTextTrimmed = currentToolbarText.trim();
	const showToolbarText = Boolean(toolbarTextTrimmed);
	const proxyFlag = boundProxy ? resolveCountryFlag(boundProxy.country) : null;
	const unknownCountry = t('common:unknownCountry');
	const unknownRegion = t('common:unknownRegion');
	const proxyLocation = boundProxy
		? `${boundProxy.country?.trim() || unknownCountry} / ${boundProxy.region?.trim() || unknownRegion}`
		: t('profile:proxy.notBound');
	const proxyIp = resolveProxyExitIp(boundProxy, t);
	const proxyType = boundProxy ? boundProxy.protocol.toUpperCase() : t('profile:proxy.notBound');
	const proxyConnectivity = resolveProxyConnectivity(boundProxy, t);
	const editConfigDisabled = actionPending || item.running;
	const isVisualEditing = quickEdit?.profileId === item.id && quickEdit.field === 'visual';
	const currentGroup = groups.find((group) => group.name === item.group);
	const inheritedToolbarMode = currentGroup?.toolbarLabelMode ?? 'id_only';
	const inheritedBgColor = currentGroup?.browserBgColor ?? null;
	const initialToolbarLabelMode =
		item.settings?.basic?.toolbarLabelMode ?? (currentGroup ? 'inherit' : inheritedToolbarMode);
	const initialBrowserBgColorMode =
		item.settings?.basic?.browserBgColorMode ??
		(currentGroup ? 'inherit' : currentBg ? 'custom' : 'none');
	const [draftToolbarLabelMode, setDraftToolbarLabelMode] =
		useState<'inherit' | ToolbarLabelMode>(initialToolbarLabelMode);
	const [draftBrowserBgColorMode, setDraftBrowserBgColorMode] =
		useState<BrowserBgColorMode>(initialBrowserBgColorMode);
	const [draftBrowserBgColor, setDraftBrowserBgColor] = useState(currentBg ?? inheritedBgColor ?? '#0F8A73');
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

	useEffect(() => {
		if (!isVisualEditing) {
			return;
		}
		setDraftToolbarLabelMode(initialToolbarLabelMode);
		setDraftBrowserBgColorMode(initialBrowserBgColorMode);
		setDraftBrowserBgColor(currentBg ?? inheritedBgColor ?? '#0F8A73');
	}, [
		currentBg,
		inheritedBgColor,
		initialBrowserBgColorMode,
		initialToolbarLabelMode,
		isVisualEditing,
	]);

	const openSiteExportDialog = async () => {
		setCookieSiteError(null);
		setCookieSiteLoading(true);
		try {
			const result = await onReadProfileCookies(item.id);
			setCookieSiteUrls(result.siteUrls);
			setSelectedCookieSiteUrl(result.siteUrls[0] ?? '');
			setSiteExportDialogOpen(true);
			if (result.siteUrls.length === 0) {
				setCookieSiteError(t('profile:cookies.noSitesToExport'));
			}
		} catch (error) {
			setCookieSiteError(error instanceof Error ? error.message : t('profile:cookies.readSiteFailed'));
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

	const handleSavePlugins = async () => {
		setPluginSaving(true);
		try {
			await updateProfilePlugins(item.id, pluginDraft);
			await onRefreshProfiles();
			toast.success(t('profile:plugins.updated'));
			if (item.running) {
				toast.info(t('profile:plugins.needsRestart'));
			}
			setPluginDialogOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: t('profile:plugins.updateFailed'),
			);
		} finally {
			setPluginSaving(false);
		}
	};

	const handleExportSiteCookie = async () => {
		setCookieSiteExporting(true);
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
					: t('profile:cookies.exportFailed'),
			);
		} finally {
			setCookieSiteExporting(false);
		}
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
							<Badge variant="secondary" className="text-[10px]">
								ID {item.numericId}
							</Badge>
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
							{currentBg && (
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
							)}
							<span className="truncate">{t('profile:basic.note')} {normalizedNote}</span>
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
						<p className="truncate text-[11px] text-muted-foreground">{t('profile:proxy.ip')}: {proxyIp}</p>
						<p className="truncate text-[11px] text-muted-foreground">{t('profile:proxy.type')}: {proxyType}</p>
						<p className={cn('truncate text-[11px] font-medium', proxyConnectivity.toneClassName)}>
							{t('profile:proxy.connectivity')}: {proxyConnectivity.label}
						</p>
					</div>
				</TableCell>

				<TableCell className="w-[140px] align-top">
					<Badge variant={item.running || actionPending ? 'default' : 'secondary'}>
						{runLabel}
					</Badge>
					<p className="mt-1 text-[11px] text-muted-foreground">{t('profile:time.recent')}: {formatProfileTime(item.lastOpenedAt)}</p>
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
									title={item.running ? t('common:showWindow') : t('common:envNotRunning')}
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
											{t('profile:actions.viewDetail')}
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												onQuickEditChange({ profileId: item.id, field: 'visual' });
											}}
										>
											<Icon icon={Palette} size={13} />
											{t('profile:actions.editVisual')}
										</DropdownMenuItem>
										<DropdownMenuSub>
											<DropdownMenuSubTrigger className="cursor-pointer">
												<Icon icon={FolderTree} size={13} />
												{t('profile:actions.setGroup')}
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
													{t('profile:actions.clearGroup')}
												</DropdownMenuItem>
											</DropdownMenuSubContent>
										</DropdownMenuSub>
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
											{t('profile:actions.editConfig')}
										</DropdownMenuItem>
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												setPluginDialogOpen(true);
											}}
										>
											<Icon icon={Puzzle} size={13} />
											{t('profile:actions.pluginManage')}
										</DropdownMenuItem>
										<DropdownMenuItem
											className="cursor-pointer"
											disabled={actionPending}
											onClick={() => {
												void onRunAction(() => onDuplicateProfile(item.id));
											}}
										>
											<Icon icon={Copy} size={13} />
											{t('profile:actions.duplicate')}
										</DropdownMenuItem>
										{!item.running ? (
											<DropdownMenuSub>
												<DropdownMenuSubTrigger className="cursor-pointer">
													<Icon icon={FileDown} size={13} />
													{t('profile:actions.exportCookie')}
												</DropdownMenuSubTrigger>
												<DropdownMenuSubContent className="w-52">
													<DropdownMenuItem
														className="cursor-pointer"
														disabled={actionPending}
														onClick={() => {
															void onRunAction(exportAllCookies);
														}}
													>
														{t('profile:actions.exportAll')}
													</DropdownMenuItem>
													<DropdownMenuItem
														className="cursor-pointer"
														disabled={actionPending}
														onClick={() => {
															void openSiteExportDialog();
														}}
													>
														{t('profile:actions.exportBySite')}
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
											{t('profile:actions.delete')}
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
								{actionState === 'restoring' ? t('profile:actions.recovering') : t('profile:actions.recover')}
							</Button>
						)}
					</div>
				</TableCell>
			</TableRow>

			<Dialog
				open={isVisualEditing}
				onOpenChange={(open) =>
					onQuickEditChange(open ? { profileId: item.id, field: 'visual' } : null)
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('profile:visual.title')}</DialogTitle>
						<DialogDescription>
							{t('profile:visual.description')}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-sm font-medium">{t('profile:visual.toolbarLabel')}</p>
							<Select
								value={draftToolbarLabelMode}
								onValueChange={(value) =>
									setDraftToolbarLabelMode(value as 'inherit' | ToolbarLabelMode)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{currentGroup ? (
										<SelectItem value="inherit">{t('profile:visual.inheritGroup')}</SelectItem>
									) : null}
									<SelectItem value="id_only">{t('profile:visual.idOnly')}</SelectItem>
									<SelectItem value="group_name_and_id">
										{t('profile:visual.groupNameAndId')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">
								{t('profile:visual.backgroundColorLabel')}
							</p>
							<Select
								value={draftBrowserBgColorMode}
								onValueChange={(value) => setDraftBrowserBgColorMode(value as BrowserBgColorMode)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{currentGroup ? (
										<SelectItem value="inherit">{t('profile:visual.inheritGroup')}</SelectItem>
									) : null}
									<SelectItem value="none">
										{t('profile:visual.noBackgroundColor')}
									</SelectItem>
									<SelectItem value="custom">{t('profile:visual.customColor')}</SelectItem>
								</SelectContent>
							</Select>
							{draftBrowserBgColorMode === 'custom' ? (
								<div className="flex items-center gap-2">
									<Input
										type="color"
										value={draftBrowserBgColor}
										onChange={(event) => setDraftBrowserBgColor(event.target.value)}
										className="h-10 w-12 cursor-pointer rounded p-1"
									/>
									<Input
										value={draftBrowserBgColor}
										onChange={(event) => setDraftBrowserBgColor(event.target.value)}
										placeholder="#0F8A73"
									/>
								</div>
							) : null}
						</div>

						<div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
							<div>{t('profile:visual.preview')}</div>
							<div className="mt-2 flex items-center gap-2">
								{(draftBrowserBgColorMode === 'custom' ? draftBrowserBgColor : inheritedBgColor) ? (
									<span
										className="inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium"
										style={{ backgroundColor: draftBrowserBgColorMode === 'custom' ? draftBrowserBgColor : inheritedBgColor ?? undefined }}
									>
										{draftBrowserBgColorMode === 'custom' ? draftBrowserBgColor : inheritedBgColor}
									</span>
								) : null}
								<Badge variant="secondary">
									{(draftToolbarLabelMode === 'inherit'
										? inheritedToolbarMode
										: draftToolbarLabelMode) === 'group_name_and_id' && currentGroup
										? `${currentGroup.name}-${item.numericId}`
										: item.numericId}
								</Badge>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={() => onQuickEditChange(null)}>
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							disabled={actionPending}
							onClick={() => {
								void onRunAction(async () => {
									await onUpdateProfileVisual(item.id, {
										browserBgColorMode: draftBrowserBgColorMode,
										browserBgColor:
											draftBrowserBgColorMode === 'custom' ? draftBrowserBgColor : null,
										toolbarLabelMode:
											draftToolbarLabelMode === 'inherit' ? undefined : draftToolbarLabelMode,
									});
									onQuickEditChange(null);
								});
							}}
						>
							{t('common:save')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={pluginDialogOpen} onOpenChange={setPluginDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t('profile:plugins.title')}</DialogTitle>
						<DialogDescription>
							{t('profile:plugins.desc')}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{pluginPackagesQuery.isLoading || profilePluginsQuery.isLoading ? (
							<p className="text-sm text-muted-foreground">{t('profile:plugins.loading')}</p>
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
															{plugin.description?.trim() || t('profile:plugins.noDescription')}
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
												{t('profile:plugins.enabled')}
											</label>
									</div>
								</div>
							);
						})}
						{!pluginPackagesQuery.isLoading && (pluginPackagesQuery.data?.length ?? 0) === 0 ? (
							<p className="text-sm text-muted-foreground">
								{t('profile:plugins.noPlugins')}
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
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={pluginSaving}
							onClick={() => {
								setPluginSaving(true);
								void handleSavePlugins();
							}}
						>
							{pluginSaving ? (
								<Icon icon={Loader2} size={12} className="animate-spin" />
							) : null}
							{t('profile:plugins.saveConfig')}
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
						<DialogTitle>{t('profile:cookies.exportBySite')}</DialogTitle>
						<DialogDescription>
							{t('profile:basic.cookieHelp')}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">{t('profile:cookies.selectSite')}</p>
							<Select
								value={selectedCookieSiteUrl}
								onValueChange={setSelectedCookieSiteUrl}
								disabled={cookieSiteLoading || cookieSiteUrls.length === 0}
							>
								<SelectTrigger className="cursor-pointer">
									<SelectValue
										placeholder={
											cookieSiteLoading ? t('profile:cookies.reading') : t('profile:cookies.selectSite')
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
							{t('common:cancel')}
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
								void handleExportSiteCookie();
							}}
						>
							{cookieSiteExporting ? (
								<Icon icon={Loader2} size={12} className="animate-spin" />
							) : null}
							{t('common:confirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
