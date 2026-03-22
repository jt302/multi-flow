import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Download, ExternalLink, PackageCheck, Puzzle, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { filterProfiles, type ProfileListFiltersState, type ProfileListLifecycleFilter, type ProfileListRunningFilter } from '@/entities/profile/lib/profile-list';
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
} from '@/entities/plugin/api/plugins-api';
import type { PluginPackage } from '@/entities/plugin/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';

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

export function PluginsPage({ profiles, groups, onRefreshProfiles }: PluginsPageProps) {
	const section = WORKSPACE_SECTIONS.plugins;
	const [extensionIdInput, setExtensionIdInput] = useState('');
	const [downloadPending, setDownloadPending] = useState(false);
	const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
	const [installDialogPackage, setInstallDialogPackage] = useState<PluginPackage | null>(null);
	const [filters, setFilters] = useState<ProfileListFiltersState>(DEFAULT_FILTERS);
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [selectedDownloadProxyId, setSelectedDownloadProxyId] = useState(
		DIRECT_DOWNLOAD_PROXY_VALUE,
	);
	const preferenceHydratedRef = useRef(false);

	const pluginPackagesQuery = useQuery({
		queryKey: ['plugin-packages'],
		queryFn: listPluginPackages,
	});
	const proxiesQuery = useProxiesQuery();
	const downloadProxyId =
		selectedDownloadProxyId === DIRECT_DOWNLOAD_PROXY_VALUE
			? null
			: selectedDownloadProxyId;
	const availableProxies = useMemo(
		() => (proxiesQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
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

	const filteredProfiles = useMemo(() => filterProfiles(profiles, filters), [profiles, filters]);
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
					error instanceof Error ? error.message : '读取插件下载代理偏好失败',
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
					error instanceof Error ? error.message : '保存插件下载代理偏好失败',
				);
			}
		})();
	};

	const handleDownload = async () => {
		const extensionId = extensionIdInput.trim();
		if (!extensionId) {
			toast.error('请输入扩展 ID');
			return;
		}
		setDownloadPending(true);
		try {
			const plugin = await downloadPluginByExtensionId(extensionId, downloadProxyId);
			await refreshAll();
			setExtensionIdInput('');
			toast.success(`插件已下载：${plugin.name}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '下载插件失败');
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
			toast.error(error instanceof Error ? error.message : '插件操作失败');
		} finally {
			setBusyPackageId(null);
		}
	};

	const openPluginStore = async (plugin: PluginPackage) => {
		if (!plugin.storeUrl?.trim()) {
			toast.error('当前插件缺少商店地址');
			return;
		}
		try {
			await openUrl(plugin.storeUrl);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '打开商店页面失败');
		}
	};

	const installToTargets = async (packageId: string, profileIds: string[]) => {
		if (profileIds.length === 0) {
			toast.error('请至少选择一个环境');
			return;
		}
		const runningTargetCount = profiles.filter(
			(item) => profileIds.includes(item.id) && item.running,
		).length;
		setBusyPackageId(packageId);
		try {
			const result = await installPluginToProfiles({ packageId, profileIds });
			await refreshAll();
			toast.success(`插件已写入 ${result.successCount} 个环境`);
			if (runningTargetCount > 0) {
				toast.info('运行中的环境需要重启后，插件变更才会生效');
			}
			setInstallDialogPackage(null);
			setSelectedProfileIds([]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '安装插件失败');
		} finally {
			setBusyPackageId(null);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<ActiveSectionCard label="插件" title={section.title} description={section.desc} />

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">通过扩展 ID 下载 CRX</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="flex flex-col gap-3 md:flex-row">
						<Input
							value={extensionIdInput}
							onChange={(event) => setExtensionIdInput(event.target.value)}
							placeholder="输入 Chrome Web Store 扩展 ID"
						/>
						<Select
							value={selectedDownloadProxyId}
							onValueChange={handleDownloadProxyChange}
						>
							<SelectTrigger className="min-w-[220px] cursor-pointer">
								<SelectValue placeholder="下载代理" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={DIRECT_DOWNLOAD_PROXY_VALUE}>下载代理: 不使用代理</SelectItem>
								{availableProxies.map((proxy) => (
									<SelectItem key={proxy.id} value={proxy.id}>
										下载代理: {proxy.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							className="cursor-pointer"
							onClick={() => void handleDownload()}
							disabled={downloadPending}
						>
							<Icon icon={Download} size={14} />
							{downloadPending ? '下载中...' : '下载插件'}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						下载依赖访问 Chrome Web Store；可选一个已配置代理用于下载、检查更新和更新插件。
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">插件库</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{pluginPackagesQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">正在加载插件库...</p>
					) : null}
					{pluginPackagesQuery.error instanceof Error ? (
						<p className="text-sm text-destructive">
							{pluginPackagesQuery.error.message}
						</p>
					) : null}
					{(pluginPackagesQuery.data ?? []).map((plugin) => (
						<div
							key={plugin.packageId}
							className="rounded-xl border border-border/70 bg-muted/20 p-3"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="flex min-w-0 flex-1 items-start gap-3">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/80">
										{getPluginIconSrc(plugin.iconPath) ? (
											<img
												src={getPluginIconSrc(plugin.iconPath) ?? undefined}
												alt={`${plugin.name} 图标`}
												className="h-full w-full object-cover"
											/>
										) : (
											<Icon icon={Puzzle} size={20} className="text-muted-foreground" />
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
											{plugin.description?.trim() || '暂无描述'}
										</p>
										<p className="mt-2 text-[11px] text-muted-foreground">
											CRX: {plugin.crxPath}
										</p>
										<p className="mt-1 text-[11px] text-muted-foreground">
											更新状态: {plugin.updateStatus ?? 'unknown'}
											{plugin.latestVersion ? ` / 最新版本 ${plugin.latestVersion}` : ''}
										</p>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="cursor-pointer"
										disabled={!plugin.storeUrl?.trim()}
										onClick={() => void openPluginStore(plugin)}
									>
										<Icon icon={ExternalLink} size={12} />
										在商店中打开
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="cursor-pointer"
										disabled={busyPackageId === plugin.packageId}
										onClick={() =>
											void runPackageAction(
												plugin.packageId,
												() => checkPluginUpdate(plugin.packageId, downloadProxyId),
												'插件更新状态已刷新',
											)
										}
									>
										<Icon icon={RefreshCcw} size={12} />
										检查更新
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="cursor-pointer"
										disabled={busyPackageId === plugin.packageId}
										onClick={() =>
											void runPackageAction(
												plugin.packageId,
												() => updatePluginPackage(plugin.packageId, downloadProxyId),
												'插件已更新',
											)
										}
									>
										<Icon icon={PackageCheck} size={12} />
										更新插件
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="cursor-pointer"
										disabled={busyPackageId === plugin.packageId}
										onClick={() => {
											setInstallDialogPackage(plugin);
											setSelectedProfileIds([]);
											setFilters(DEFAULT_FILTERS);
										}}
									>
										<Icon icon={Puzzle} size={12} />
										安装到环境
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="cursor-pointer"
										disabled={busyPackageId === plugin.packageId}
										onClick={() =>
											void installToTargets(
												plugin.packageId,
												profiles
													.filter((item) => item.lifecycle === 'active')
													.map((item) => item.id),
											)
										}
									>
										安装到所有环境
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										className="cursor-pointer"
										disabled={busyPackageId === plugin.packageId}
										onClick={() =>
											void runPackageAction(
												plugin.packageId,
												() => uninstallPluginPackage(plugin.packageId),
												'插件已卸载',
											)
										}
									>
										<Icon icon={Trash2} size={12} />
										卸载
									</Button>
								</div>
							</div>
						</div>
					))}
					{!pluginPackagesQuery.isLoading && (pluginPackagesQuery.data?.length ?? 0) === 0 ? (
						<p className="text-sm text-muted-foreground">还没有已下载插件。</p>
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
						<DialogTitle>安装到环境</DialogTitle>
						<DialogDescription>
							先筛选目标环境，再多选环境安装插件。运行中的环境会先写入配置，重启后生效。
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2 md:grid-cols-4">
						<Input
							value={filters.keyword}
							onChange={(event) =>
								setFilters((prev) => ({ ...prev, keyword: event.target.value }))
							}
							placeholder="搜索名称/分组/备注"
						/>
						<Select
							value={filters.groupFilter}
							onValueChange={(value) =>
								setFilters((prev) => ({ ...prev, groupFilter: value }))
							}
						>
							<SelectTrigger className="cursor-pointer">
								<SelectValue placeholder="全部分组" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部分组</SelectItem>
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
								<SelectValue placeholder="全部运行态" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">全部运行态</SelectItem>
								<SelectItem value="running">仅运行中</SelectItem>
								<SelectItem value="stopped">仅未运行</SelectItem>
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
								<SelectValue placeholder="可用环境" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">可用环境</SelectItem>
								<SelectItem value="deleted">已归档</SelectItem>
								<SelectItem value="all">全部生命周期</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
						<p>
							当前筛选 {activeFilteredProfiles.length} 个可用环境，已选择 {selectedProfileIds.length}{' '}
							个
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="cursor-pointer"
							onClick={() =>
								setSelectedProfileIds(activeFilteredProfiles.map((item) => item.id))
							}
						>
							选中当前筛选结果
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
											<p className="font-medium text-foreground">{profile.name}</p>
											<Badge variant="outline">
												{profile.running ? '运行中' : '未运行'}
											</Badge>
											<Badge variant="secondary">{profile.group}</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">{profile.note}</p>
									</div>
								</label>
							);
						})}
						{activeFilteredProfiles.length === 0 ? (
							<p className="text-sm text-muted-foreground">当前筛选没有可安装的环境。</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setInstallDialogPackage(null)}
						>
							取消
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={!installDialogPackage || selectedProfileIds.length === 0}
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
							确认安装
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
