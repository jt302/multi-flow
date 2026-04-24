import { Focus, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getWorkspaceSection } from '@/app/model/workspace-sections';
import { ProfileGroupSelector } from '@/components/common/profile-group-selector';
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Icon,
	ScrollArea,
} from '@/components/ui';
import type { WindowsPageProps } from '@/features/window-session/model/page-types';
import { getWindowSyncStartValidation } from '@/features/window-session/model/window-sync-forms';
import { useWindowSyncStore } from '@/store/window-sync-store';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';

export function WindowsPage({
	profiles,
	windowStates,
	syncConnectionStatus,
	sidecarPort,
	sessionPayload,
	recentWarnings,
	syncLastError,
	onRefreshWindows,
	onStartSync,
	onStopSync,
	onRestartSync,
}: WindowsPageProps) {
	const { t } = useTranslation('window');
	const section = getWorkspaceSection('windows');
	const [syncActionPending, setSyncActionPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedProfileIds = useWindowSyncStore((state) => state.selectedProfileIds);
	const masterProfileId = useWindowSyncStore((state) => state.masterProfileId);
	const toggleProfile = useWindowSyncStore((state) => state.toggleProfile);
	const setSelectedProfileIds = useWindowSyncStore((state) => state.setSelectedProfileIds);
	const setMasterProfileId = useWindowSyncStore((state) => state.setMasterProfileId);
	const activeSyncSession = sessionPayload?.session ?? null;

	const runningProfileIds = useMemo(() => {
		return profiles
			.filter((item) => item.lifecycle === 'active' && item.running)
			.map((item) => item.id);
	}, [profiles]);

	const selectedRunningIds = useMemo(() => {
		const runningSet = new Set(runningProfileIds);
		return selectedProfileIds.filter((id) => runningSet.has(id));
	}, [selectedProfileIds, runningProfileIds]);

	useEffect(() => {
		if (!masterProfileId && activeSyncSession?.masterId) {
			setMasterProfileId(activeSyncSession.masterId);
		}
	}, [activeSyncSession?.masterId, masterProfileId, setMasterProfileId]);

	const profileNameMap = useMemo(
		() =>
			profiles.reduce<Record<string, string>>((acc, item) => {
				acc[item.id] = item.name;
				return acc;
			}, {}),
		[profiles],
	);

	const handleGroupSelectorChange = useCallback(
		(ids: string[]) => {
			setSelectedProfileIds(ids);
		},
		[setSelectedProfileIds],
	);

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('page.syncFailed'));
		}
	};

	const runSyncAction = async (action: () => Promise<void>) => {
		if (syncActionPending) {
			return;
		}
		setSyncActionPending(true);
		try {
			await runAction(action);
		} finally {
			setSyncActionPending(false);
		}
	};

	const startValidation = useMemo(
		() => getWindowSyncStartValidation(selectedRunningIds, masterProfileId),
		[masterProfileId, selectedRunningIds],
	);

	const metrics = sessionPayload?.metrics;
	const bindingDiagnostics = useMemo(() => {
		const items = [
			sessionPayload?.master
				? {
						label: t('syncDiag.masterPrefix', {
							name: profileNameMap[sessionPayload.master.id] ?? sessionPayload.master.id,
						}),
						boundBrowserId: sessionPayload.master.boundBrowserId ?? null,
						boundWindowToken: sessionPayload.master.boundWindowToken ?? null,
						coordinateMode: sessionPayload.master.coordinateMode ?? null,
					}
				: null,
			...(sessionPayload?.slaves ?? []).map((item) => ({
				label: t('syncDiag.slavePrefix', {
					name: profileNameMap[item.id] ?? item.id,
				}),
				boundBrowserId: item.boundBrowserId ?? null,
				boundWindowToken: item.boundWindowToken ?? null,
				coordinateMode: item.coordinateMode ?? null,
			})),
		].filter(
			(
				item,
			): item is {
				label: string;
				boundBrowserId: number | null;
				boundWindowToken: string | null;
				coordinateMode: string | null;
			} => Boolean(item),
		);

		return items.filter(
			(item) =>
				item.boundBrowserId !== null ||
				item.boundWindowToken !== null ||
				item.coordinateMode !== null,
		);
	}, [profileNameMap, sessionPayload?.master, sessionPayload?.slaves]);

	const recentProbeErrors = useMemo(
		() =>
			windowStates
				.filter((item) => item.lastProbeError)
				.map((item) => ({
					profileId: item.profileId,
					label: profileNameMap[item.profileId] ?? item.profileId,
					message: item.lastProbeError ?? '',
				})),
		[profileNameMap, windowStates],
	);

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label={t('page.syncLabel')}
				title={section.title}
				description={section.desc}
			/>

			{/* 同步列表 — flex-1 填满剩余高度 */}
			<Card className="p-3 flex-1 min-h-64 overflow-hidden flex flex-col">
				<CardHeader className="px-1 pb-2 shrink-0">
					<CardTitle className="text-sm">{t('page.syncList')}</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0 flex-1 min-h-0">
					<ScrollArea className="h-full pr-1">
						<div className="space-y-3">
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<p>
									{t('page.selectedRunning', {
										selected: selectedRunningIds.length,
										total: runningProfileIds.length,
									})}
								</p>
								{activeSyncSession ? (
									<Badge variant="default">
										{t('page.syncing', {
											master:
												profileNameMap[activeSyncSession.masterId] ?? activeSyncSession.masterId,
										})}
									</Badge>
								) : (
									<Badge variant="secondary">{t('page.notSyncing')}</Badge>
								)}
								<Badge variant={syncConnectionStatus === 'connected' ? 'default' : 'outline'}>
									{t('page.sidecarStatus', { status: syncConnectionStatus })}
								</Badge>
							</div>

							<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(2,auto)]">
								<Button
									type="button"
									className="w-full cursor-pointer"
									onClick={() =>
										void runSyncAction(() =>
											activeSyncSession
												? onStopSync()
												: onStartSync(selectedRunningIds, masterProfileId ?? ''),
										)
									}
									disabled={
										syncActionPending ||
										(activeSyncSession ? !activeSyncSession : !startValidation.ok)
									}
								>
									<Icon
										icon={syncActionPending ? LoaderCircle : Sparkles}
										size={14}
										className={syncActionPending ? 'animate-spin' : ''}
									/>
									{syncActionPending
										? activeSyncSession
											? t('page.stoppingSync')
											: t('page.startingSync')
										: activeSyncSession
											? t('page.stopSync')
											: t('page.startSync')}
								</Button>
								<Button
									type="button"
									variant="outline"
									className="w-full cursor-pointer"
									onClick={() => void runAction(onRestartSync)}
									disabled={syncActionPending || !activeSyncSession}
								>
									{t('syncActions.restartSync')}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full cursor-pointer sm:w-auto"
									onClick={() => void runAction(onRefreshWindows)}
									disabled={syncActionPending}
								>
									<Icon icon={RefreshCw} size={12} />
									{t('syncActions.refreshSyncStatus')}
								</Button>
							</div>
							{startValidation.reason ? (
								<p className="text-xs text-muted-foreground">{startValidation.reason}</p>
							) : null}
							{error ? <p className="text-xs text-destructive">{error}</p> : null}

							{/* 按分组快速选择环境 */}
							<ProfileGroupSelector
								selectedIds={selectedProfileIds}
								onChange={handleGroupSelectorChange}
								filterRunning
							/>

							<div className="space-y-2">
								{windowStates.map((item) => {
									const selected = selectedProfileIds.includes(item.profileId);
									const isMaster = masterProfileId === item.profileId;
									return (
										<div
											key={item.profileId}
											className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
										>
											<div className="flex min-w-0 flex-wrap items-center gap-2">
												<Checkbox
													checked={selected}
													onCheckedChange={(checked) =>
														toggleProfile(item.profileId, checked === true)
													}
												/>
												<div className="min-w-0">
													<p className="text-sm font-medium">
														{profileNameMap[item.profileId] ?? item.profileId}
													</p>
													<p className="text-xs text-muted-foreground">
														{t('syncDiag.windowsTabsInfo', {
															windows: item.totalWindows,
															tabs: item.totalTabs,
															host: item.host,
															port: item.magicSocketServerPort ?? '-',
														})}
													</p>
												</div>
												<Badge
													variant={
														item.syncRole === 'master'
															? 'default'
															: item.syncRole === 'slave'
																? 'secondary'
																: 'outline'
													}
												>
													{item.syncRole === 'master'
														? t('syncDiag.master')
														: item.syncRole === 'slave'
															? t('syncDiag.slave')
															: t('syncDiag.notSynced')}
												</Badge>
												<Badge
													variant={
														item.instanceStatus === 'online'
															? 'default'
															: item.instanceStatus === 'unknown'
																? 'outline'
																: 'secondary'
													}
												>
													{item.instanceStatus}
												</Badge>
												{item.platform ? <Badge variant="outline">{item.platform}</Badge> : null}
												{item.lastProbeError ? (
													<Badge variant="outline">{t('syncDiag.probeError')}</Badge>
												) : null}
												{item.boundBrowserId ? (
													<Badge variant="outline">browser {item.boundBrowserId}</Badge>
												) : null}
												{item.boundWindowToken ? (
													<Badge variant="outline">token {item.boundWindowToken}</Badge>
												) : null}
											</div>
											<div className="flex w-full items-center gap-2 sm:w-auto">
												<Button
													type="button"
													size="sm"
													variant={isMaster ? 'default' : 'outline'}
													className="w-full cursor-pointer sm:w-auto"
													onClick={() => setMasterProfileId(item.profileId)}
													disabled={!selected}
												>
													<Icon icon={Focus} size={12} />
													{t('syncDiag.setMaster')}
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* 同步诊断 — shrink-0 固定在底部 */}
			<Card className="p-3 shrink-0">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">{t('syncDiag.syncDiagnostics')}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 px-1 pt-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
					<div className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">{t('syncDiag.connectionStatus')}</p>
								<p className="mt-1 text-sm font-medium">{syncConnectionStatus}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">{t('syncDiag.sidecarPort')}</p>
								<p className="mt-1 text-sm font-medium">{sidecarPort ?? '-'}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">{t('syncDiag.sessionStatus')}</p>
								<p className="mt-1 text-sm font-medium">{activeSyncSession?.status ?? 'stopped'}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">{t('syncDiag.forwardedEvents')}</p>
								<p className="mt-1 text-sm font-medium">{metrics?.eventsForwarded ?? 0}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">{t('syncDiag.failedEvents')}</p>
								<p className="mt-1 text-sm font-medium">{metrics?.eventsFailed ?? 0}</p>
							</div>
						</div>
						<div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
							<p>
								{t('syncDiag.lastError')}
								<span className="ml-1 text-foreground">{syncLastError ?? t('syncDiag.none')}</span>
							</p>
							<p className="mt-1">
								{t('syncDiag.sessionReason')}
								<span className="ml-1 text-foreground">
									{sessionPayload?.reason ?? syncLastError ?? t('syncDiag.none')}
								</span>
							</p>
							<p className="mt-1">
								{t('syncDiag.dropStats')}
								<span className="ml-1 text-foreground">
									invalid {metrics?.eventsDroppedInvalid ?? 0} / session mismatch{' '}
									{metrics?.eventsDroppedSessionMismatch ?? 0} / non-replayable{' '}
									{metrics?.eventsDroppedNonReplayable ?? 0} / platform mismatch{' '}
									{metrics?.eventsDroppedPlatformMismatch ?? 0}
								</span>
							</p>
							{bindingDiagnostics.length > 0 ? (
								<div className="mt-2 space-y-1">
									<p className="text-foreground">{t('syncDiag.boundWindow')}</p>
									{bindingDiagnostics.map((item) => (
										<p key={item.label}>
											{item.label}：
											<span className="ml-1 text-foreground">
												browser {item.boundBrowserId ?? '-'} / token {item.boundWindowToken ?? '-'}
											</span>
										</p>
									))}
									<p>
										{t('syncDiag.coordinateMode')}
										<span className="ml-1 text-foreground">
											{bindingDiagnostics
												.map((item) => `${item.label} ${item.coordinateMode ?? '-'}`)
												.join(' / ')}
										</span>
									</p>
								</div>
							) : null}
						</div>
					</div>
					<div className="grid gap-3">
						<div className="rounded-lg border border-border/60 p-3">
							<p className="mb-2 text-sm font-medium">{t('syncDiag.recentWarnings')}</p>
							<div className="space-y-2 text-xs text-muted-foreground">
								{recentWarnings.length === 0 ? (
									<p>{t('syncDiag.noWarnings')}</p>
								) : (
									recentWarnings.slice(0, 5).map((item) => (
										<div
											key={`${item.code}-${item.scope}-${item.instanceId ?? 'global'}-${item.message}`}
											className="rounded-md border border-border/50 px-2 py-1"
										>
											<p className="text-foreground">{item.message}</p>
											<p>
												{item.code} / {item.scope}
												{item.instanceId ? ` / ${item.instanceId}` : ''}
											</p>
										</div>
									))
								)}
							</div>
						</div>
						<div className="rounded-lg border border-border/60 p-3">
							<p className="mb-2 text-sm font-medium">{t('syncDiag.recentProbeErrors')}</p>
							<div className="space-y-2 text-xs text-muted-foreground">
								{recentProbeErrors.length === 0 ? (
									<p>{t('syncDiag.noProbeErrors')}</p>
								) : (
									recentProbeErrors.slice(0, 5).map((item) => (
										<div
											key={item.profileId}
											className="rounded-md border border-border/50 px-2 py-1"
										>
											<p className="text-foreground">{item.label}</p>
											<p>{item.message}</p>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
