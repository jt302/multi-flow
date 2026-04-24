import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import {
	ArrowLeft,
	ChevronDown,
	ChevronRight,
	FolderOpen,
	PencilLine,
	Shield,
	Sparkles,
	Trash2,
} from 'lucide-react';
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
import {
	formatProfileTime,
	resolveBrowserVersionMeta,
	resolvePlatformMeta,
} from '@/entities/profile/lib/profile-list';
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
	backLabel?: string;
	onEditProfile: (profileId: string) => void;
};

function formatWebRtcModeLabel(value: string | undefined) {
	switch (value) {
		case 'follow_ip':
			return i18next.t('common:followIp');
		case 'replace':
			return i18next.t('common:replace');
		case 'disable':
			return i18next.t('common:disable');
		case 'real':
		default:
			return i18next.t('common:realNoOverride');
	}
}

function formatCustomValueModeLabel(value: string | undefined) {
	return value === 'custom'
		? i18next.t('common:custom')
		: i18next.t('common:real');
}

function DetailMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
			<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 break-words whitespace-pre-wrap text-sm">{value}</p>
		</div>
	);
}

export function ProfileDetailPage({
	profile,
	resources,
	boundProxy,
	onBack,
	backLabel,
	onEditProfile,
}: ProfileDetailPageProps) {
	const { t } = useTranslation(['profile', 'common']);
	const [showHiddenInfo, setShowHiddenInfo] = useState(false);
	const [confirmClearCacheOpen, setConfirmClearCacheOpen] = useState(false);
	const [clearingCache, setClearingCache] = useState(false);
	const basic = profile.settings?.basic;
	const fingerprint = profile.settings?.fingerprint;
	const source = fingerprint?.fingerprintSource;
	const snapshot = fingerprint?.fingerprintSnapshot;
	const browserVersionMeta = resolveBrowserVersionMeta(profile);
	const platformMeta = resolvePlatformMeta(profile);
	const statusLabel = profile.running
		? t('common:running')
		: t('common:notRunning');
	const editConfigDisabled = profile.running;
	const toolbarText = profile.resolvedToolbarText?.trim();
	const startupUrls =
		basic?.startupUrls?.filter((item) => item.trim()) ??
		(basic?.startupUrl?.trim() ? [basic.startupUrl.trim()] : []);
	const proxyLabel = boundProxy
		? `${boundProxy.name} · ${boundProxy.protocol.toUpperCase()}://${boundProxy.host}:${boundProxy.port}`
		: t('detail.noProxy');
	const runtimeDetailsQuery = useProfileRuntimeDetailsQuery(
		profile.id,
		profile.running,
	);
	const runtimeDetails = runtimeDetailsQuery.data;
	const activeChromiumVersion =
		resources.find(
			(item) => item.kind === 'chromium' && item.active,
		)?.version ?? '';
	const keyLaunchArgs = useMemo(() => {
		return (runtimeDetails?.launchArgs ?? []).filter(
			(item) =>
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
				toast.error(t('detail.openDirFailed'));
			}
		}
	};

	const handleClearCache = async () => {
		setClearingCache(true);
		try {
			await clearProfileCache(profile.id);
			await runtimeDetailsQuery.refetch();
			setConfirmClearCacheOpen(false);
			toast.success(t('detail.cacheCleaned'));
		} catch (error) {
			toast.error(t('detail.cacheCleanFailed'));
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
					<h2 className="text-base font-semibold">{t('detail.pageTitle')}</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBack}
					>
						<Icon icon={ArrowLeft} size={14} />
						{backLabel ?? t('detail.backToList')}
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						disabled={editConfigDisabled}
						title={editConfigDisabled ? t('detail.editConfigDisabledRunning') : undefined}
						onClick={() => onEditProfile(profile.id)}
					>
						<Icon icon={PencilLine} size={14} />
						{t('detail.editConfig')}
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
								{profile.group} · {statusLabel} · ID {profile.numericId}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{platformMeta.code} · {platformMeta.hint}
							</p>
							{toolbarText ? (
								<p className="mt-1 text-xs text-muted-foreground">
									{t('toolbarText.label')} {toolbarText}
								</p>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Badge variant="secondary">{platformMeta.label}</Badge>
						<Badge variant={profile.running ? 'default' : 'outline'}>
							{statusLabel}
						</Badge>
						<Badge variant="secondary">
							{browserVersionMeta.versionLabel}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 p-0 md:grid-cols-2 xl:grid-cols-4">
					<DetailMetric
						label={t('detail.actualChromium')}
						value={activeChromiumVersion || t('common:notSet')}
					/>
					<DetailMetric
						label={t('detail.startupUrl')}
						value={
							startupUrls.length ? startupUrls.join('\n') : t('common:notSet')
						}
					/>
					<DetailMetric label={t('detail.proxy')} value={proxyLabel} />
					<DetailMetric
						label={t('detail.lastStarted')}
						value={formatProfileTime(profile.lastOpenedAt)}
					/>
				</CardContent>
			</Card>

			<Card className="p-4">
				<CardHeader className="flex flex-row items-center justify-between gap-3 p-0 pb-3">
					<div>
						<CardTitle className="text-sm">{t('detail.runAndDir')}</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							{t('detail.runAndDirDesc')}
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
							<Icon
								icon={showHiddenInfo ? ChevronDown : ChevronRight}
								size={14}
							/>
							{showHiddenInfo ? t('detail.hideInfo') : t('detail.showInfo')}
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
							{t('detail.cleanCache')}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{showHiddenInfo ? (
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							<DetailMetric label={t('detail.profileId')} value={profile.id} />
							<PathMetric
								label={t('detail.profileDir')}
								value={runtimeDetails?.profileRootDir || t('common:loading')}
								onOpen={
									runtimeDetails?.profileRootDir
										? () => void openDir(runtimeDetails.profileRootDir)
										: undefined
								}
							/>
							<PathMetric
								label={t('detail.userDataDir')}
								value={runtimeDetails?.userDataDir || t('common:loading')}
								onOpen={
									runtimeDetails?.userDataDir
										? () => void openDir(runtimeDetails.userDataDir)
										: undefined
								}
							/>
							<PathMetric
								label={t('detail.cacheDir')}
								value={runtimeDetails?.cacheDataDir || t('common:loading')}
								onOpen={
									runtimeDetails?.cacheDataDir
										? () => void openDir(runtimeDetails.cacheDataDir)
										: undefined
								}
							/>
							<DetailMetric
								label={t('detail.pidDebugMagic')}
								value={
									runtimeDetails?.runtimeHandle
										? `${runtimeDetails.runtimeHandle.pid ?? '-'} / ${runtimeDetails.runtimeHandle.debugPort ?? '-'} / ${runtimeDetails.runtimeHandle.magicPort ?? '-'}`
										: t('detail.currentNotRunning')
								}
							/>
							<DetailMetric
								label={t('detail.session')}
								value={
									runtimeDetails?.runtimeHandle?.sessionId?.toString() ||
									t('detail.currentNotRunning')
								}
							/>
						</div>
					) : null}

					<Card className="border border-border/60 shadow-none">
						<CardHeader className="px-4 pt-4 pb-2">
							<CardTitle className="text-sm">
								{t('detail.launchParams')}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 px-4 pb-4 pt-0">
							{profile.running ? (
								<>
									<div className="grid gap-3 md:grid-cols-2">
										<DetailMetric
											label={t('detail.keyParams')}
											value={
												keyLaunchArgs.length
													? keyLaunchArgs.join('\n')
													: t('detail.noKeyParams')
											}
										/>
										<DetailMetric
											label={t('detail.extraArgs')}
											value={
												runtimeDetails?.extraArgs?.length
													? runtimeDetails.extraArgs.join('\n')
													: t('common:none')
											}
										/>
									</div>
									<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
										<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
											{t('detail.fullLaunchParams')}
										</p>
										<pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">
											{runtimeDetails?.launchArgs?.length
												? runtimeDetails.launchArgs.join('\n')
												: runtimeDetailsQuery.isLoading
													? t('common:loading')
													: t('detail.noLaunchParams')}
										</pre>
									</div>
								</>
							) : (
								<p className="text-sm text-muted-foreground">
									{t('detail.notRunningHint')}
								</p>
							)}
						</CardContent>
					</Card>

					{runtimeDetailsQuery.error instanceof Error ? (
						<p className="text-xs text-destructive">
							{runtimeDetailsQuery.error.message}
						</p>
					) : null}
				</CardContent>
			</Card>

			<div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Shield} size={16} />
						<CardTitle className="text-sm">
							{t('detail.fingerprintSource')}
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 p-0 md:grid-cols-2">
						<DetailMetric
							label={t('detail.simulatedPlatform')}
							value={source?.platform || basic?.platform || t('common:notSet')}
						/>
						<DetailMetric
							label={t('detail.devicePreset')}
							value={source?.devicePresetId || t('common:notSet')}
						/>
						<DetailMetric
							label={t('detail.browserVersion')}
							value={
								source?.browserVersion ||
								basic?.browserVersion ||
								t('common:notSet')
							}
						/>
						<DetailMetric
							label={t('detail.seedPolicy')}
							value={`${source?.strategy || 'template'} / ${source?.seedPolicy || 'fixed'}`}
						/>
						<DetailMetric
							label={t('detail.catalog')}
							value={source?.catalogVersion || t('common:notSet')}
						/>
						<DetailMetric
							label={t('detail.webrtc')}
							value={formatWebRtcModeLabel(fingerprint?.webRtcMode)}
						/>
						<DetailMetric
							label={t('detail.deviceName')}
							value={
								fingerprint?.deviceNameMode === 'custom'
									? `${t('common:custom')} · ${fingerprint.customDeviceName || t('common:notSet')}`
									: formatCustomValueModeLabel(fingerprint?.deviceNameMode)
							}
						/>
						<DetailMetric
							label={t('detail.macAddress')}
							value={
								fingerprint?.macAddressMode === 'custom'
									? `${t('common:custom')} · ${fingerprint.customMacAddress || t('common:notSet')}`
									: formatCustomValueModeLabel(fingerprint?.macAddressMode)
							}
						/>
						<DetailMetric
							label={t('detail.doNotTrack')}
							value={
								fingerprint?.doNotTrackEnabled
									? t('common:enabled')
									: t('common:disabled')
							}
						/>
					</CardContent>
				</Card>

				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Sparkles} size={16} />
						<CardTitle className="text-sm">
							{t('detail.fingerprintSummary')}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 p-0">
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								{t('detail.userAgent')}
							</p>
							<p className="mt-1 break-words text-sm">
								{snapshot?.userAgent || t('common:notGenerated')}
							</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								{t('detail.uaMetadata')}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customUaMetadata || t('common:notGenerated')}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<DetailMetric
								label={t('detail.platformParams')}
								value={snapshot?.customPlatform || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.resolutionDpr')}
								value={
									snapshot?.windowWidth && snapshot?.windowHeight
										? `${snapshot.windowWidth}x${snapshot.windowHeight} · ${snapshot.deviceScaleFactor ?? '-'}x`
										: t('common:notSet')
								}
							/>
						<DetailMetric
							label={t('detail.cpuRam')}
							value={
								snapshot?.customCpuCores && snapshot?.customRamGb
									? `${snapshot.customCpuCores} ${t('detail.core')} / ${snapshot.customRamGb} ${t('detail.gb')}`
									: t('common:notSet')
							}
						/>
							<DetailMetric
								label={t('detail.touchFormFactor')}
								value={`${snapshot?.customTouchPoints ?? 0} / ${snapshot?.formFactor || t('common:notSet')}`}
							/>
							<DetailMetric
								label={t('detail.glVendor')}
								value={snapshot?.customGlVendor || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.glRenderer')}
								value={snapshot?.customGlRenderer || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.language')}
								value={snapshot?.language || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.timezone')}
								value={snapshot?.timeZone || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.acceptLanguage')}
								value={snapshot?.acceptLanguages || t('common:notSet')}
							/>
							<DetailMetric
								label={t('detail.seed')}
								value={
									snapshot?.fingerprintSeed?.toString() ||
									t('common:generatedOnStartup')
								}
							/>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								{t('detail.fontCollection')}
							</p>
							<p className="mt-1 text-sm">
								{snapshot?.customFontList?.length
									? t('common:fontsCount', {
											count: snapshot.customFontList.length,
										})
									: t('common:notSet')}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customFontList?.slice(0, 10).join(' / ') ||
									t('common:notSet')}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<AlertDialog
				open={confirmClearCacheOpen}
				onOpenChange={setConfirmClearCacheOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('detail.confirmCleanCache')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('detail.confirmCleanCacheDesc')}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button
								type="button"
								variant="outline"
								className="cursor-pointer"
							>
								{t('common:cancel')}
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								className="cursor-pointer"
								disabled={clearingCache}
								onClick={() => void handleClearCache()}
							>
								{clearingCache
									? t('common:cleaningInProgress')
									: t('detail.confirmClean')}
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
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						{label}
					</p>
					<p className="mt-1 break-words whitespace-pre-wrap text-sm">
						{value}
					</p>
				</div>
				{onOpen ? (
					<Button
						type="button"
						size="icon"
						variant="ghost"
						className="h-8 w-8 cursor-pointer"
						onClick={onOpen}
					>
						<Icon icon={FolderOpen} size={14} />
					</Button>
				) : null}
			</div>
		</div>
	);
}
