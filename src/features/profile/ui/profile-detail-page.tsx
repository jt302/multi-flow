import { useMemo, useState } from 'react';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { ArrowLeft, ChevronDown, ChevronRight, FolderOpen, PencilLine, Shield, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
} from '@/components/ui';
import { clearProfileCache } from '@/entities/profile/api/profiles-api';
import { formatProfileTime, resolveBrowserVersionMeta, resolvePlatformMeta } from '@/entities/profile/lib/profile-list';
import { useProfileRuntimeDetailsQuery } from '@/entities/profile/model/use-profile-runtime-details-query';
import type { ProfileItem } from '@/entities/profile/model/types';
import { PlatformMark } from '@/entities/profile/ui/platform-mark';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';

type ProfileDetailPageProps = {
	profile: ProfileItem;
	resources: ResourceItem[];
	boundProxy?: ProxyItem;
	onBack: () => void;
	onEditProfile: (profileId: string) => void;
};

function formatWebRtcModeLabel(value: string | undefined) {
	switch (value) {
		case 'follow_ip':
			return '跟随 IP';
		case 'replace':
			return '替换（指定 IP）';
		case 'disable':
			return '禁用';
		case 'real':
		default:
			return '真实（不覆盖）';
	}
}

function DetailMetric({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
			<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
			<p className="mt-1 break-words whitespace-pre-wrap text-sm">{value}</p>
		</div>
	);
}

export function ProfileDetailPage({
	profile,
	resources,
	boundProxy,
	onBack,
	onEditProfile,
}: ProfileDetailPageProps) {
	const [showHiddenInfo, setShowHiddenInfo] = useState(false);
	const [confirmClearCacheOpen, setConfirmClearCacheOpen] = useState(false);
	const [clearingCache, setClearingCache] = useState(false);
	const basic = profile.settings?.basic;
	const fingerprint = profile.settings?.fingerprint;
	const source = fingerprint?.fingerprintSource;
	const snapshot = fingerprint?.fingerprintSnapshot;
	const browserVersionMeta = resolveBrowserVersionMeta(profile, resources);
	const platformMeta = resolvePlatformMeta(profile);
	const statusLabel = profile.running ? '运行中' : '未运行';
	const toolbarText = basic?.toolbarText?.trim();
	const startupUrls =
		basic?.startupUrls?.filter((item) => item.trim()) ??
		(basic?.startupUrl?.trim() ? [basic.startupUrl.trim()] : []);
	const proxyLabel = boundProxy
		? `${boundProxy.name} · ${boundProxy.protocol.toUpperCase()}://${boundProxy.host}:${boundProxy.port}`
		: '未绑定代理';
	const runtimeDetailsQuery = useProfileRuntimeDetailsQuery(profile.id, profile.running);
	const runtimeDetails = runtimeDetailsQuery.data;
	const keyLaunchArgs = useMemo(() => {
		return (runtimeDetails?.launchArgs ?? []).filter((item) =>
			item.startsWith('--user-data-dir=') ||
			item.startsWith('--disk-cache-dir=') ||
			item.startsWith('--magic-socket-server-port=') ||
			item.startsWith('--fingerprint-seed='),
		);
	}, [runtimeDetails?.launchArgs]);

	const openDir = async (path: string) => {
		try {
			await revealItemInDir(path);
		} catch (error) {
			try {
				await openPath(path);
			} catch {
				toast.error('打开目录失败');
			}
		}
	};

	const handleClearCache = async () => {
		setClearingCache(true);
		try {
			await clearProfileCache(profile.id);
			await runtimeDetailsQuery.refetch();
			setConfirmClearCacheOpen(false);
			toast.success('缓存目录已清理');
		} catch (error) {
			toast.error('清理 cache 失败');
		} finally {
			setClearingCache(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/65 px-3 py-2.5">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						profiles / detail
					</p>
					<h2 className="text-base font-semibold">环境详情</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" className="cursor-pointer" onClick={onBack}>
						<Icon icon={ArrowLeft} size={14} />
						返回列表
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						onClick={() => onEditProfile(profile.id)}
					>
						<Icon icon={PencilLine} size={14} />
						修改配置
					</Button>
				</div>
			</div>

			<Card className="p-4">
				<CardHeader className="flex flex-row items-start justify-between gap-3 p-0 pb-3">
					<div className="flex items-start gap-3">
						<PlatformMark meta={platformMeta} size="lg" />
						<div>
							<CardTitle className="text-lg">{profile.name}</CardTitle>
							<p className="mt-1 text-sm text-muted-foreground">
								{profile.group} · {statusLabel}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{platformMeta.code} · {platformMeta.hint}
							</p>
							{toolbarText && toolbarText !== profile.name ? (
								<p className="mt-1 text-xs text-muted-foreground">工具栏文本 {toolbarText}</p>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Badge variant="secondary">{platformMeta.label}</Badge>
						<Badge variant={profile.running ? 'default' : 'outline'}>{statusLabel}</Badge>
						<Badge
							variant={
								browserVersionMeta.resourceLabel === '已安装' ? 'secondary' : 'outline'
							}
						>
							{browserVersionMeta.versionLabel}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 p-0 md:grid-cols-2 xl:grid-cols-4">
					<DetailMetric label="浏览器资源" value={browserVersionMeta.resourceLabel} />
					<DetailMetric
						label="默认打开 URL"
						value={startupUrls.length ? startupUrls.join('\n') : '未设置'}
					/>
					<DetailMetric label="代理" value={proxyLabel} />
					<DetailMetric label="最近启动" value={formatProfileTime(profile.lastOpenedAt)} />
				</CardContent>
			</Card>

			<Card className="p-4">
				<CardHeader className="flex flex-row items-center justify-between gap-3 p-0 pb-3">
					<div>
						<CardTitle className="text-sm">运行与目录</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							显示环境隐藏信息、目录路径与当前运行时参数
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="cursor-pointer"
							onClick={() => setShowHiddenInfo((value) => !value)}
						>
							<Icon icon={showHiddenInfo ? ChevronDown : ChevronRight} size={14} />
							{showHiddenInfo ? '隐藏信息' : '显示隐藏信息'}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="cursor-pointer"
							disabled={profile.running || clearingCache}
							onClick={() => setConfirmClearCacheOpen(true)}
						>
							<Icon icon={Trash2} size={14} />
							清理 cache
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{showHiddenInfo ? (
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							<DetailMetric label="环境 ID" value={profile.id} />
							<PathMetric
								label="Profile 目录"
								value={runtimeDetails?.profileRootDir || '加载中...'}
								onOpen={
									runtimeDetails?.profileRootDir
										? () => void openDir(runtimeDetails.profileRootDir)
										: undefined
								}
							/>
							<PathMetric
								label="User Data 目录"
								value={runtimeDetails?.userDataDir || '加载中...'}
								onOpen={
									runtimeDetails?.userDataDir
										? () => void openDir(runtimeDetails.userDataDir)
										: undefined
								}
							/>
							<PathMetric
								label="Cache 目录"
								value={runtimeDetails?.cacheDataDir || '加载中...'}
								onOpen={
									runtimeDetails?.cacheDataDir
										? () => void openDir(runtimeDetails.cacheDataDir)
										: undefined
								}
							/>
							<DetailMetric
								label="PID / Debug / Magic"
								value={
									runtimeDetails?.runtimeHandle
										? `${runtimeDetails.runtimeHandle.pid ?? '-'} / ${runtimeDetails.runtimeHandle.debugPort ?? '-'} / ${runtimeDetails.runtimeHandle.magicPort ?? '-'}`
										: '当前未运行'
								}
							/>
							<DetailMetric
								label="Session"
								value={
									runtimeDetails?.runtimeHandle?.sessionId?.toString() || '当前未运行'
								}
							/>
						</div>
					) : null}

					<Card className="border border-border/60 shadow-none">
						<CardHeader className="p-0 pb-2">
							<CardTitle className="text-sm">启动参数</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 p-0">
							{profile.running ? (
								<>
									<div className="grid gap-3 md:grid-cols-2">
										<DetailMetric
											label="关键参数"
											value={keyLaunchArgs.length ? keyLaunchArgs.join('\n') : '未解析到关键参数'}
										/>
										<DetailMetric
											label="Extra Args"
											value={
												runtimeDetails?.extraArgs?.length
													? runtimeDetails.extraArgs.join('\n')
													: '无'
											}
										/>
									</div>
									<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
										<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
											完整启动参数
										</p>
										<pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">
											{runtimeDetails?.launchArgs?.length
												? runtimeDetails.launchArgs.join('\n')
												: runtimeDetailsQuery.isLoading
													? '加载中...'
													: '当前未读取到启动参数'}
										</pre>
									</div>
								</>
							) : (
								<p className="text-sm text-muted-foreground">
									当前未运行，启动参数会在环境运行后显示。
								</p>
							)}
						</CardContent>
					</Card>

					{runtimeDetailsQuery.error instanceof Error ? (
						<p className="text-xs text-destructive">{runtimeDetailsQuery.error.message}</p>
					) : null}
				</CardContent>
			</Card>

			<div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Shield} size={16} />
						<CardTitle className="text-sm">指纹来源</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 p-0 md:grid-cols-2">
						<DetailMetric label="模拟平台" value={source?.platform || basic?.platform || '未设置'} />
						<DetailMetric label="设备预设" value={source?.devicePresetId || '未设置'} />
						<DetailMetric label="浏览器版本" value={source?.browserVersion || basic?.browserVersion || '未设置'} />
						<DetailMetric label="策略 / Seed Policy" value={`${source?.strategy || 'template'} / ${source?.seedPolicy || 'fixed'}`} />
						<DetailMetric label="Catalog" value={source?.catalogVersion || '未设置'} />
						<DetailMetric
							label="WebRTC"
							value={formatWebRtcModeLabel(fingerprint?.webRtcMode)}
						/>
						<DetailMetric
							label="Do Not Track"
							value={fingerprint?.doNotTrackEnabled ? '开启' : '关闭'}
						/>
					</CardContent>
				</Card>

				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Sparkles} size={16} />
						<CardTitle className="text-sm">指纹摘要</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 p-0">
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">UserAgent</p>
							<p className="mt-1 break-words text-sm">{snapshot?.userAgent || '未生成'}</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">UA Metadata</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customUaMetadata || '未生成'}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<DetailMetric
								label="平台参数"
								value={snapshot?.customPlatform || '未设置'}
							/>
							<DetailMetric
								label="分辨率 / DPR"
								value={
									snapshot?.windowWidth && snapshot?.windowHeight
										? `${snapshot.windowWidth}x${snapshot.windowHeight} · ${snapshot.deviceScaleFactor ?? '-'}x`
										: '未设置'
								}
							/>
							<DetailMetric
								label="CPU / RAM"
								value={
									snapshot?.customCpuCores && snapshot?.customRamGb
										? `${snapshot.customCpuCores} 核 / ${snapshot.customRamGb} GB`
										: '未设置'
								}
							/>
							<DetailMetric
								label="触点 / 形态"
								value={`${snapshot?.customTouchPoints ?? 0} / ${snapshot?.formFactor || '未设置'}`}
							/>
							<DetailMetric
								label="GL Vendor"
								value={snapshot?.customGlVendor || '未设置'}
							/>
							<DetailMetric
								label="GL Renderer"
								value={snapshot?.customGlRenderer || '未设置'}
							/>
							<DetailMetric label="语言" value={snapshot?.language || '未设置'} />
							<DetailMetric label="时区" value={snapshot?.timeZone || '未设置'} />
							<DetailMetric
								label="Accept-Language"
								value={snapshot?.acceptLanguages || '未设置'}
							/>
							<DetailMetric
								label="Seed"
								value={snapshot?.fingerprintSeed?.toString() || '启动时生成'}
							/>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">字体集合</p>
							<p className="mt-1 text-sm">
								{snapshot?.customFontList?.length
									? `${snapshot.customFontList.length} 个字体`
									: '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customFontList?.slice(0, 10).join(' / ') || '未设置'}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<AlertDialog open={confirmClearCacheOpen} onOpenChange={setConfirmClearCacheOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认清理 cache</AlertDialogTitle>
						<AlertDialogDescription>
							将清理当前环境的 cache-data 目录，只删除缓存文件，不会删除账号数据或 user-data。该操作仅允许在环境关闭后执行。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button type="button" variant="outline" className="cursor-pointer">
								取消
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								className="cursor-pointer"
								disabled={clearingCache}
								onClick={() => void handleClearCache()}
							>
								{clearingCache ? '清理中...' : '确认清理'}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function PathMetric({
	label,
	value,
	onOpen,
}: {
	label: string;
	value: string;
	onOpen?: () => void;
}) {
	return (
		<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
					<p className="mt-1 break-words whitespace-pre-wrap text-sm">{value}</p>
				</div>
				{onOpen ? (
					<Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={onOpen}>
						<Icon icon={FolderOpen} size={14} />
					</Button>
				) : null}
			</div>
		</div>
	);
}
