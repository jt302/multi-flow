import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
	Download,
	ExternalLink,
	PackageCheck,
	Puzzle,
	RefreshCcw,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Icon,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import {
	filterProfiles,
	type ProfileListFiltersState,
	type ProfileListLifecycleFilter,
	type ProfileListRunningFilter,
} from '@/entities/profile/lib/profile-list';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { GroupItem } from '@/entities/group/model/types';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import {
	checkPluginUpdate,
	downloadPluginByExtensionId,
	installPluginToProfiles,
	listPluginPackages,
	readPluginDownloadPreference,
	uninstallPluginPackage,
	updatePluginDownloadPreference,
	updatePluginPackage,
	type PluginDownloadProgressEvent,
} from '@/entities/plugin/api/plugins-api';
import type { PluginPackage } from '@/entities/plugin/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import { queryKeys } from '@/shared/config/query-keys';
import { formatBytes } from '@/shared/lib/format';
import { usePluginDownloadStore } from '@/store/plugin-download-store';
import {
	getPluginUpdateActionLabelKey,
	getPluginUpdateCheckToastKey,
	getPluginUpdatePackageToastKey,
	getPluginUpdateStatusLabelKey,
} from '@/features/plugin/model/plugin-update-status';

type PluginsPageProps = {
	profiles: ProfileItem[];
	groups: GroupItem[];
	onRefreshProfiles: () => Promise<void>;
};

const DEFAULT_FILTERS: ProfileListFiltersState = {
	keyword: '',
	groupFilter: 'all',
	runningFilter: 'all',
	lifecycleFilter: 'active',
};

const DIRECT_DOWNLOAD_PROXY_VALUE = 'direct';

export function PluginsPage({
	profiles,
	groups,
	onRefreshProfiles,
}: PluginsPageProps) {
	const { t } = useTranslation(['plugin', 'common']);
	const section = getWorkspaceSections().plugins;
	const [extensionIdInput, setExtensionIdInput] = useState('');
	const [downloadPending, setDownloadPending] = useState(false);
	const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
	const [installDialogPackage, setInstallDialogPackage] =
		useState<PluginPackage | null>(null);
	const [filters, setFilters] =
		useState<ProfileListFiltersState>(DEFAULT_FILTERS);
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [selectedDownloadProxyId, setSelectedDownloadProxyId] = useState(
		DIRECT_DOWNLOAD_PROXY_VALUE,
	);
	const preferenceHydratedRef = useRef(false);

	const pluginPackagesQuery = useQuery({
		queryKey: queryKeys.pluginPackages,
		queryFn: listPluginPackages,
	});
	const pluginDownloadByExtensionId = usePluginDownloadStore(
		(state) => state.byExtensionId,
	);
	const proxiesQuery = useProxiesQuery();
	const downloadProxyId =
		selectedDownloadProxyId === DIRECT_DOWNLOAD_PROXY_VALUE
			? null
			: selectedDownloadProxyId;
	const activeInputDownload =
		pluginDownloadByExtensionId[extensionIdInput.trim()] ?? null;
	const availableProxies = useMemo(
		() =>
			(proxiesQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[proxiesQuery.data],
	);
	const getPluginIconSrc = (iconPath?: string | null) =>
		iconPath ? convertFileSrc(iconPath) : null;

	const groupOptions = useMemo(() => {
		return Array.from(
			new Set(
				groups
					.filter((item) => item.lifecycle === 'active')
					.map((item) => item.name.trim())
					.filter(Boolean),
			),
		).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
	}, [groups]);

	const filteredProfiles = useMemo(
		() => filterProfiles(profiles, filters),
		[profiles, filters],
	);
	const activeFilteredProfiles = useMemo(
		() => filteredProfiles.filter((item) => item.lifecycle === 'active'),
		[filteredProfiles],
	);
	const refreshAll = async () => {
		await Promise.all([pluginPackagesQuery.refetch(), onRefreshProfiles()]);
	};

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const preference = await readPluginDownloadPreference();
				if (cancelled) {
					return;
				}
				setSelectedDownloadProxyId(
					preference.proxyId?.trim() || DIRECT_DOWNLOAD_PROXY_VALUE,
				);
			} catch (error) {
				if (cancelled) {
					return;
				}
				toast.error(
					error instanceof Error
						? error.message
						: t('toast.readProxyPrefFailed'),
				);
			} finally {
				if (!cancelled) {
					preferenceHydratedRef.current = true;
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleDownloadProxyChange = (value: string) => {
		const previousValue = selectedDownloadProxyId;
		setSelectedDownloadProxyId(value);
		if (!preferenceHydratedRef.current) {
			return;
		}
		void (async () => {
			try {
				const saved = await updatePluginDownloadPreference(
					value === DIRECT_DOWNLOAD_PROXY_VALUE ? null : value,
				);
				setSelectedDownloadProxyId(
					saved.proxyId?.trim() || DIRECT_DOWNLOAD_PROXY_VALUE,
				);
			} catch (error) {
				setSelectedDownloadProxyId(previousValue);
				toast.error(
					error instanceof Error
						? error.message
						: t('toast.saveProxyPrefFailed'),
				);
			}
		})();
	};

	const handleDownload = async () => {
		const extensionId = extensionIdInput.trim();
		if (!extensionId) {
			toast.error(t('toast.enterExtensionId'));
			return;
		}
		setDownloadPending(true);
		try {
			const plugin = await downloadPluginByExtensionId(
				extensionId,
				downloadProxyId,
			);
			await refreshAll();
			setExtensionIdInput('');
			toast.success(t('toast.downloaded', { name: plugin.name }));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.downloadFailed'),
			);
		} finally {
			setDownloadPending(false);
		}
	};

	const runPackageAction = async (
		packageId: string,
		action: () => Promise<unknown>,
		successText: string,
	) => {
		setBusyPackageId(packageId);
		try {
			await action();
			await refreshAll();
			toast.success(successText);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.operationFailed'),
			);
		} finally {
			setBusyPackageId(null);
		}
	};

	const openPluginStore = async (plugin: PluginPackage) => {
		if (!plugin.storeUrl?.trim()) {
			toast.error(t('toast.noStoreUrl'));
			return;
		}
		try {
			await openUrl(plugin.storeUrl);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.openStoreFailed'),
			);
		}
	};

	const installToTargets = async (packageId: string, profileIds: string[]) => {
		if (profileIds.length === 0) {
			toast.error(t('toast.selectAtLeastOne'));
			return;
		}
		const runningTargetCount = profiles.filter(
			(item) => profileIds.includes(item.id) && item.running,
		).length;
		setBusyPackageId(packageId);
		try {
			const result = await installPluginToProfiles({ packageId, profileIds });
			await refreshAll();
			toast.success(t('toast.installed', { count: result.successCount }));
			if (runningTargetCount > 0) {
				toast.info(t('toast.restartNotice'));
			}
			setInstallDialogPackage(null);
			setSelectedProfileIds([]);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.installFailed'),
			);
		} finally {
			setBusyPackageId(null);
		}
	};

	const handleCheckUpdate = async (plugin: PluginPackage) => {
		setBusyPackageId(plugin.packageId);
		try {
			const updatedPlugin = await checkPluginUpdate(
				plugin.packageId,
				downloadProxyId,
			);
			await refreshAll();
			const toastText = t(
				getPluginUpdateCheckToastKey(updatedPlugin.updateStatus),
				{
					version:
						updatedPlugin.latestVersion ??
						t('library.latestVersionUnknown'),
				},
			);
			if (updatedPlugin.updateStatus === 'error') {
				toast.warning(toastText);
			} else {
				toast.success(toastText);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.operationFailed'),
			);
		} finally {
			setBusyPackageId(null);
		}
	};

	const handleUpdatePlugin = async (plugin: PluginPackage) => {
		setBusyPackageId(plugin.packageId);
		try {
			const updatedPlugin = await updatePluginPackage(
				plugin.packageId,
				downloadProxyId,
			);
			await refreshAll();
			const toastText = t(
				getPluginUpdatePackageToastKey(updatedPlugin.updateStatus),
				{
					version: updatedPlugin.version,
					latestVersion:
						updatedPlugin.latestVersion ??
						t('library.latestVersionUnknown'),
				},
			);
			if (
				updatedPlugin.updateStatus === 'error' ||
				updatedPlugin.updateStatus === 'unknown' ||
				updatedPlugin.updateStatus === 'update_available'
			) {
				toast.warning(toastText);
			} else {
				toast.success(toastText);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('toast.operationFailed'),
			);
		} finally {
			setBusyPackageId(null);
		}
	};

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label={t('plugin:label')}
				title={section.title}
				description={section.desc}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">{t('downloadCrx.title')}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="flex flex-col gap-3 md:flex-row">
						<Input
							value={extensionIdInput}
							onChange={(event) => setExtensionIdInput(event.target.value)}
							placeholder={t('downloadCrx.placeholder')}
						/>
						<Select
							value={selectedDownloadProxyId}
							onValueChange={handleDownloadProxyChange}
						>
							<SelectTrigger className="w-full cursor-pointer md:min-w-[220px] md:w-auto">
								<SelectValue placeholder={t('downloadCrx.proxyNone')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={DIRECT_DOWNLOAD_PROXY_VALUE}>
									{t('downloadCrx.proxyNone')}
								</SelectItem>
								{availableProxies.map((proxy) => (
									<SelectItem key={proxy.id} value={proxy.id}>
										{t('downloadCrx.proxySelected', { name: proxy.name })}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							className="w-full cursor-pointer md:w-auto"
							onClick={() => void handleDownload()}
							disabled={downloadPending || Boolean(activeInputDownload)}
						>
							<Icon icon={Download} size={14} />
							{downloadPending || activeInputDownload
								? t('downloadCrx.downloading')
								: t('downloadCrx.download')}
						</Button>
					</div>
					{activeInputDownload ? (
						<PluginProgressBlock
							percent={activeInputDownload.percent}
							downloadedBytes={activeInputDownload.downloadedBytes}
							totalBytes={activeInputDownload.totalBytes}
							stage={activeInputDownload.stage}
						/>
					) : null}
					<p className="text-xs text-muted-foreground">
						{t('downloadCrx.proxyHint')}
					</p>
				</CardContent>
			</Card>

			<Card className="flex-1 min-h-0 overflow-hidden flex flex-col">
				<CardHeader>
					<CardTitle className="text-sm">{t('library.title')}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 flex-1 min-h-0 overflow-y-auto">
					{pluginPackagesQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">
							{t('library.loading')}
						</p>
					) : null}
					{pluginPackagesQuery.error instanceof Error ? (
						<p className="text-sm text-destructive">
							{pluginPackagesQuery.error.message}
						</p>
					) : null}
					{(pluginPackagesQuery.data ?? []).map((plugin) => (
						<PluginPackageCard
							key={plugin.packageId}
							plugin={plugin}
							progress={pluginDownloadByExtensionId[plugin.extensionId] ?? null}
							busyPackageId={busyPackageId}
							getPluginIconSrc={getPluginIconSrc}
							onOpenPluginStore={openPluginStore}
							onCheckUpdate={handleCheckUpdate}
							onUpdatePlugin={handleUpdatePlugin}
							onInstallToProfiles={() => {
								setInstallDialogPackage(plugin);
								setSelectedProfileIds([]);
								setFilters(DEFAULT_FILTERS);
							}}
							onInstallToAll={() =>
								void installToTargets(
									plugin.packageId,
									profiles
										.filter((item) => item.lifecycle === 'active')
										.map((item) => item.id),
								)
							}
							onUninstall={() =>
								void runPackageAction(
									plugin.packageId,
									() => uninstallPluginPackage(plugin.packageId),
									t('library.pluginUninstalled'),
								)
							}
						/>
					))}
					{!pluginPackagesQuery.isLoading &&
					(pluginPackagesQuery.data?.length ?? 0) === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t('library.empty')}
						</p>
					) : null}
				</CardContent>
			</Card>

			<Dialog
				open={Boolean(installDialogPackage)}
				onOpenChange={(open) => {
					if (!open) {
						setInstallDialogPackage(null);
						setSelectedProfileIds([]);
					}
				}}
			>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>{t('install.title')}</DialogTitle>
						<DialogDescription>{t('install.desc')}</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2 md:grid-cols-4">
						<Input
							value={filters.keyword}
							onChange={(event) =>
								setFilters((prev) => ({ ...prev, keyword: event.target.value }))
							}
							placeholder={t('install.searchPlaceholder')}
						/>
						<Select
							value={filters.groupFilter}
							onValueChange={(value) =>
								setFilters((prev) => ({ ...prev, groupFilter: value }))
							}
						>
							<SelectTrigger className="cursor-pointer">
								<SelectValue placeholder={t('install.allGroups')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t('install.allGroups')}</SelectItem>
								{groupOptions.map((groupName) => (
									<SelectItem key={groupName} value={groupName}>
										{groupName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={filters.runningFilter}
							onValueChange={(value) =>
								setFilters((prev) => ({
									...prev,
									runningFilter: value as ProfileListRunningFilter,
								}))
							}
						>
							<SelectTrigger className="cursor-pointer">
								<SelectValue placeholder={t('install.allStatus')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t('install.allStatus')}</SelectItem>
								<SelectItem value="running">
									{t('install.onlyRunning')}
								</SelectItem>
								<SelectItem value="stopped">
									{t('install.onlyStopped')}
								</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={filters.lifecycleFilter}
							onValueChange={(value) =>
								setFilters((prev) => ({
									...prev,
									lifecycleFilter: value as ProfileListLifecycleFilter,
								}))
							}
						>
							<SelectTrigger className="cursor-pointer">
								<SelectValue placeholder={t('install.availableProfiles')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">
									{t('install.availableProfiles')}
								</SelectItem>
								<SelectItem value="deleted">{t('install.archived')}</SelectItem>
								<SelectItem value="all">{t('install.allLifecycle')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
						<p>
							{t('install.filterSummary', {
								filtered: activeFilteredProfiles.length,
								selected: selectedProfileIds.length,
							})}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="cursor-pointer"
							onClick={() =>
								setSelectedProfileIds(
									activeFilteredProfiles.map((item) => item.id),
								)
							}
						>
							{t('install.selectFiltered')}
						</Button>
					</div>
					<div className="max-h-[360px] space-y-2 overflow-y-auto">
						{activeFilteredProfiles.map((profile) => {
							const checked = selectedProfileIds.includes(profile.id);
							const selectId = `plugin-install-profile-${profile.id}`;
							return (
								<label
									htmlFor={selectId}
									key={profile.id}
									className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-3 text-sm"
								>
									<Checkbox
										id={selectId}
										checked={checked}
										className="mt-0.5 cursor-pointer"
										onCheckedChange={(next) => {
											setSelectedProfileIds((prev) => {
												if (next === true) {
													return Array.from(new Set([...prev, profile.id]));
												}
												return prev.filter((item) => item !== profile.id);
											});
										}}
									/>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-foreground">
												{profile.name}
											</p>
											<Badge variant="outline">
												{profile.running
													? t('install.running')
													: t('install.notRunning')}
											</Badge>
											<Badge variant="secondary">{profile.group}</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{profile.note}
										</p>
									</div>
								</label>
							);
						})}
						{activeFilteredProfiles.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								{t('install.emptyFilter')}
							</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setInstallDialogPackage(null)}
						>
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={
								!installDialogPackage || selectedProfileIds.length === 0
							}
							onClick={() => {
								if (!installDialogPackage) {
									return;
								}
								void installToTargets(
									installDialogPackage.packageId,
									selectedProfileIds,
								);
							}}
						>
							{t('install.confirmInstall')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

type PluginProgressBlockProps = {
	stage: string;
	percent: number | null;
	downloadedBytes: number;
	totalBytes: number | null;
};

function PluginProgressBlock({
	stage,
	percent,
	downloadedBytes,
	totalBytes,
}: PluginProgressBlockProps) {
	const { t } = useTranslation(['plugin']);
	const stageLabel =
		stage === 'download'
			? t('toast.downloadProgress')
			: stage === 'process'
				? t('toast.downloadProcessing')
				: t('toast.downloadStarting');

	return (
		<div className="mt-2 space-y-1">
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span>{stageLabel}</span>
				<span>{percent === null ? '--' : `${Math.floor(percent)}%`}</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
				<div
					className="h-full bg-primary transition-all"
					style={{
						width: `${Math.max(3, Math.min(100, percent ?? 0))}%`,
					}}
				/>
			</div>
			<p className="text-[11px] text-muted-foreground">
				{formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
			</p>
		</div>
	);
}

type PluginPackageCardProps = {
	plugin: PluginPackage;
	progress: PluginDownloadProgressEvent | null;
	busyPackageId: string | null;
	getPluginIconSrc: (iconPath?: string | null) => string | null;
	onOpenPluginStore: (plugin: PluginPackage) => void;
	onCheckUpdate: (plugin: PluginPackage) => void;
	onUpdatePlugin: (plugin: PluginPackage) => void;
	onInstallToProfiles: () => void;
	onInstallToAll: () => void;
	onUninstall: () => void;
};

function PluginPackageCard({
	plugin,
	progress,
	busyPackageId,
	getPluginIconSrc,
	onOpenPluginStore,
	onCheckUpdate,
	onUpdatePlugin,
	onInstallToProfiles,
	onInstallToAll,
	onUninstall,
}: PluginPackageCardProps) {
	const { t } = useTranslation(['plugin']);
	const iconSrc = getPluginIconSrc(plugin.iconPath);
	const busy = busyPackageId === plugin.packageId || Boolean(progress);

	return (
		<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/80">
						{iconSrc ? (
							<img
								src={iconSrc}
								alt={t('library.iconAlt', { name: plugin.name })}
								className="h-full w-full object-cover"
							/>
						) : (
							<Icon
								icon={Puzzle}
								size={20}
								className="text-muted-foreground"
							/>
						)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium text-foreground">{plugin.name}</p>
							<Badge variant="outline">v{plugin.version}</Badge>
							<Badge variant="secondary">{plugin.extensionId}</Badge>
							<Badge variant="outline">{plugin.sourceType}</Badge>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{plugin.description?.trim() || t('library.noDescription')}
						</p>
						<p className="mt-2 text-[11px] text-muted-foreground">
							{t('library.crxPath', { path: plugin.crxPath })}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('library.updateStatus', {
								status: t(getPluginUpdateStatusLabelKey(plugin.updateStatus)),
								version:
									plugin.latestVersion ?? t('library.latestVersionUnknown'),
							})}
						</p>
						{progress ? (
							<PluginProgressBlock
								stage={progress.stage}
								percent={progress.percent}
								downloadedBytes={progress.downloadedBytes}
								totalBytes={progress.totalBytes}
							/>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={!plugin.storeUrl?.trim()}
						onClick={() => onOpenPluginStore(plugin)}
					>
						<Icon icon={ExternalLink} size={12} />
						{t('library.openInStore')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={busy}
						onClick={() => onCheckUpdate(plugin)}
					>
						<Icon icon={RefreshCcw} size={12} />
						{t('library.checkUpdate')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={busy}
						onClick={() => onUpdatePlugin(plugin)}
					>
						<Icon icon={PackageCheck} size={12} />
						{progress
							? t('downloadCrx.downloading')
							: t(getPluginUpdateActionLabelKey(plugin.updateStatus))}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={busy}
						onClick={onInstallToProfiles}
					>
						<Icon icon={Puzzle} size={12} />
						{t('library.installToProfiles')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						disabled={busy}
						onClick={onInstallToAll}
					>
						{t('library.installToAll')}
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						className="cursor-pointer"
						disabled={busy}
						onClick={onUninstall}
					>
						<Icon icon={Trash2} size={12} />
						{t('library.uninstall')}
					</Button>
				</div>
			</div>
		</div>
	);
}
