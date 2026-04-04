import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import {
	Focus,
	LoaderCircle,
	Monitor,
	RefreshCw,
	Send,
	Sparkles,
} from 'lucide-react';
import { z } from 'zod/v3';

import { getWorkspaceSections } from '@/app/model/workspace-sections';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Icon,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	ScrollArea,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
} from '@/components/ui';
import { useWindowSyncStore } from '@/store/window-sync-store';
import type { WindowsPageProps } from '@/features/window-session/model/page-types';
import {
	arrangeWindowsFormSchema,
	getWindowSyncStartValidation,
	syncTextFormSchema,
	windowBoundsBatchFormSchema,
} from '@/features/window-session/model/window-sync-forms';
import { WindowBatchActionsCard } from './window-batch-actions-card';
import { WindowStatesCard } from './window-states-card';

const DEFAULT_URL = 'https://www.browserscan.net/';

const batchActionFormSchema = z.object({
	targetUrl: z
		.string()
		.trim()
		.min(1, i18next.t('window:validation.enterUrl'))
		.superRefine((value, ctx) => {
			try {
				const parsed = new URL(value);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: i18next.t('window:validation.urlMustStartWithHttp'),
					});
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('window:validation.invalidUrlFull'),
				});
			}
		}),
});

type BatchActionFormValues = z.infer<typeof batchActionFormSchema>;
type WindowBoundsBatchFormValues = z.infer<typeof windowBoundsBatchFormSchema>;
type ArrangeWindowsFormValues = z.infer<typeof arrangeWindowsFormSchema>;
type SyncTextFormValues = z.infer<typeof syncTextFormSchema>;

function normalizeActionUrl(value: string) {
	const trimmed = value.trim();
	const parsed = new URL(trimmed);
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(i18next.t('window:validation.urlMustStartWithHttp'));
	}
	return parsed.toString();
}

export function WindowsPage({
	profiles,
	windowStates,
	displayMonitors,
	syncConnectionStatus,
	sidecarPort,
	sessionPayload,
	recentWarnings,
	syncLastError,
	onRefreshWindows,
	onViewProfile,
	onStartSync,
	onStopSync,
	onRestartSync,
	onBroadcastSyncText,
	onBatchRestoreWindows,
	onBatchSetWindowBounds,
	onArrangeWindows,
	onOpenTab,
	onCloseTab,
	onCloseInactiveTabs,
	onActivateTab,
	onActivateTabByIndex,
	onOpenWindow,
	onCloseWindow,
	onFocusWindow,
	onSetWindowBounds,
	onBatchOpenTabs,
	onBatchCloseTabs,
	onBatchCloseInactiveTabs,
	onBatchOpenWindows,
	onBatchFocusWindows,
}: WindowsPageProps) {
	const { t } = useTranslation('window');
	const section = getWorkspaceSections().windows;
	const [pendingProfileIds, setPendingProfileIds] = useState<Set<string>>(
		new Set(),
	);
	const [syncActionPending, setSyncActionPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedProfileIds = useWindowSyncStore(
		(state) => state.selectedProfileIds,
	);
	const masterProfileId = useWindowSyncStore((state) => state.masterProfileId);
	const activeConfigTab = useWindowSyncStore((state) => state.activeConfigTab);
	const arrangeMode = useWindowSyncStore((state) => state.arrangeMode);
	const arrangeGap = useWindowSyncStore((state) => state.arrangeGap);
	const toggleProfile = useWindowSyncStore((state) => state.toggleProfile);
	const setMasterProfileId = useWindowSyncStore(
		(state) => state.setMasterProfileId,
	);
	const setActiveConfigTab = useWindowSyncStore(
		(state) => state.setActiveConfigTab,
	);
	const setArrangeMode = useWindowSyncStore((state) => state.setArrangeMode);
	const setGap = useWindowSyncStore((state) => state.setGap);
	const activeSyncSession = sessionPayload?.session ?? null;

	const {
		register,
		trigger,
		getValues,
		formState: { errors },
	} = useForm<BatchActionFormValues>({
		resolver: zodResolver(batchActionFormSchema),
		defaultValues: {
			targetUrl: DEFAULT_URL,
		},
	});

	const windowBoundsForm = useForm<WindowBoundsBatchFormValues>({
		resolver: zodResolver(windowBoundsBatchFormSchema),
		defaultValues: {
			width: 1300,
			height: 800,
		},
	});

	const arrangeForm = useForm<ArrangeWindowsFormValues>({
		resolver: zodResolver(arrangeWindowsFormSchema),
		defaultValues: {
			monitorId: '',
			mode: arrangeMode,
			gap: arrangeGap,
			width: 1300,
			height: 800,
		},
	});

	const syncTextForm = useForm<SyncTextFormValues>({
		resolver: zodResolver(syncTextFormSchema),
		defaultValues: {
			text: '',
		},
	});

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

	useEffect(() => {
		if (displayMonitors.length === 0) {
			return;
		}
		const current = arrangeForm.getValues('monitorId');
		if (current) {
			return;
		}
		const preferred =
			displayMonitors.find((item) => item.isPrimary) ?? displayMonitors[0];
		arrangeForm.setValue('monitorId', preferred.id);
	}, [arrangeForm, displayMonitors]);

	useEffect(() => {
		arrangeForm.setValue('mode', arrangeMode);
	}, [arrangeForm, arrangeMode]);

	useEffect(() => {
		arrangeForm.setValue('gap', arrangeGap);
	}, [arrangeForm, arrangeGap]);

	const profileNameMap = useMemo(
		() =>
			profiles.reduce<Record<string, string>>((acc, item) => {
				acc[item.id] = item.name;
				return acc;
			}, {}),
		[profiles],
	);

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('page.syncFailed'));
		}
	};

	const resolveValidatedActionUrl = async () => {
		const valid = await trigger('targetUrl');
		if (!valid) {
			throw new Error(
				errors.targetUrl?.message ??
					i18next.t('window:validation.invalidUrlFull'),
			);
		}
		return normalizeActionUrl(getValues('targetUrl'));
	};

	const runProfileAction = async (
		profileId: string,
		action: () => Promise<void>,
	) => {
		if (pendingProfileIds.has(profileId)) {
			return;
		}
		setPendingProfileIds((prev) => new Set(prev).add(profileId));
		await runAction(action);
		setPendingProfileIds((prev) => {
			const next = new Set(prev);
			next.delete(profileId);
			return next;
		});
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
	const metrics = sessionPayload?.metrics;
	const bindingDiagnostics = useMemo(() => {
		const items = [
			sessionPayload?.master
				? {
						label: t('syncDiag.masterPrefix', {
							name:
								profileNameMap[sessionPayload.master.id] ??
								sessionPayload.master.id,
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

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label={t('page.syncLabel')}
				title={section.title}
				description={section.desc}
			/>

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
												profileNameMap[activeSyncSession.masterId] ??
												activeSyncSession.masterId,
										})}
									</Badge>
								) : (
									<Badge variant="secondary">{t('page.notSyncing')}</Badge>
								)}
								<Badge
									variant={
										syncConnectionStatus === 'connected' ? 'default' : 'outline'
									}
								>
									{t('page.sidecarStatus', { status: syncConnectionStatus })}
								</Badge>
							</div>

							<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(2,auto)]">
								<Button
									type="button"
									className="cursor-pointer"
									onClick={() =>
										void runSyncAction(() =>
											activeSyncSession
												? onStopSync()
												: onStartSync(
														selectedRunningIds,
														masterProfileId ?? '',
													),
										)
									}
									disabled={
										syncActionPending ||
										(activeSyncSession
											? !activeSyncSession
											: !startValidation.ok)
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
									className="cursor-pointer"
									onClick={() => void runAction(onRestartSync)}
									disabled={syncActionPending || !activeSyncSession}
								>
									{t('syncActions.restartSync')}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="cursor-pointer"
									onClick={() => void runAction(onRefreshWindows)}
									disabled={syncActionPending}
								>
									<Icon icon={RefreshCw} size={12} />
									{t('syncActions.refreshSyncStatus')}
								</Button>
							</div>
							{startValidation.reason ? (
								<p className="text-xs text-muted-foreground">
									{startValidation.reason}
								</p>
							) : null}

							<div className="space-y-2">
								{windowStates.map((item) => {
									const selected = selectedProfileIds.includes(item.profileId);
									const isMaster = masterProfileId === item.profileId;
									return (
										<div
											key={item.profileId}
											className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
										>
											<div className="flex items-center gap-2">
												<Checkbox
													checked={selected}
													onCheckedChange={(checked) =>
														toggleProfile(item.profileId, checked === true)
													}
												/>
												<div>
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
												{item.platform ? (
													<Badge variant="outline">{item.platform}</Badge>
												) : null}
												{item.lastProbeError ? (
													<Badge variant="outline">
														{t('syncDiag.probeError')}
													</Badge>
												) : null}
												{item.boundBrowserId ? (
													<Badge variant="outline">
														browser {item.boundBrowserId}
													</Badge>
												) : null}
												{item.boundWindowToken ? (
													<Badge variant="outline">
														token {item.boundWindowToken}
													</Badge>
												) : null}
											</div>
											<div className="flex items-center gap-2">
												<Button
													type="button"
													size="sm"
													variant={isMaster ? 'default' : 'outline'}
													className="cursor-pointer"
													onClick={() => setMasterProfileId(item.profileId)}
													disabled={!selected}
												>
													<Icon icon={Focus} size={12} />
													{t('syncDiag.setMaster')}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="cursor-pointer"
													onClick={() => onViewProfile(item.profileId)}
												>
													{t('syncDiag.profileDetail')}
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

			<Card className="p-3 shrink-0">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">
						{t('syncDiag.syncDiagnostics')}
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 px-1 pt-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
					<div className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">
									{t('syncDiag.connectionStatus')}
								</p>
								<p className="mt-1 text-sm font-medium">
									{syncConnectionStatus}
								</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">
									{t('syncDiag.sidecarPort')}
								</p>
								<p className="mt-1 text-sm font-medium">{sidecarPort ?? '-'}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">
									{t('syncDiag.sessionStatus')}
								</p>
								<p className="mt-1 text-sm font-medium">
									{activeSyncSession?.status ?? 'stopped'}
								</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">
									{t('syncDiag.forwardedEvents')}
								</p>
								<p className="mt-1 text-sm font-medium">
									{metrics?.eventsForwarded ?? 0}
								</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">
									{t('syncDiag.failedEvents')}
								</p>
								<p className="mt-1 text-sm font-medium">
									{metrics?.eventsFailed ?? 0}
								</p>
							</div>
						</div>
						<div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
							<p>
								{t('syncDiag.lastError')}
								<span className="ml-1 text-foreground">
									{syncLastError ?? t('syncDiag.none')}
								</span>
							</p>
							<p className="mt-1">
								{t('syncDiag.sessionReason')}
								<span className="ml-1 text-foreground">
									{sessionPayload?.reason ??
										syncLastError ??
										t('syncDiag.none')}
								</span>
							</p>
							<p className="mt-1">
								{t('syncDiag.dropStats')}
								<span className="ml-1 text-foreground">
									invalid {metrics?.eventsDroppedInvalid ?? 0} / session
									mismatch {metrics?.eventsDroppedSessionMismatch ?? 0} /
									non-replayable {metrics?.eventsDroppedNonReplayable ?? 0} /
									platform mismatch{' '}
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
												browser {item.boundBrowserId ?? '-'} / token{' '}
												{item.boundWindowToken ?? '-'}
											</span>
										</p>
									))}
									<p>
										{t('syncDiag.coordinateMode')}
										<span className="ml-1 text-foreground">
											{bindingDiagnostics
												.map(
													(item) =>
														`${item.label} ${item.coordinateMode ?? '-'}`,
												)
												.join(' / ')}
										</span>
									</p>
								</div>
							) : null}
						</div>
					</div>
					<div className="grid gap-3">
						<div className="rounded-lg border border-border/60 p-3">
							<p className="mb-2 text-sm font-medium">
								{t('syncDiag.recentWarnings')}
							</p>
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
							<p className="mb-2 text-sm font-medium">
								{t('syncDiag.recentProbeErrors')}
							</p>
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

			<Card className="p-3 shrink-0">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">{t('page.configArea')}</CardTitle>
				</CardHeader>
				<CardContent className="min-w-0 px-1 pt-0">
					<Tabs
						value={activeConfigTab}
						onValueChange={(value) =>
							setActiveConfigTab(value as 'window' | 'tab' | 'text')
						}
					>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="window">
								{t('page.windowManagement')}
							</TabsTrigger>
							<TabsTrigger value="tab">{t('page.tabManagement')}</TabsTrigger>
							<TabsTrigger value="text">{t('page.textInput')}</TabsTrigger>
						</TabsList>

						<TabsContent value="window" className="mt-3 min-w-0 space-y-3">
							<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
								<Card className="border border-border/60 shadow-none min-w-0">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">
											{t('arrange.uniformSize')}
										</CardTitle>
									</CardHeader>
									<CardContent className="min-w-0 space-y-3">
										<form
											className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
											onSubmit={windowBoundsForm.handleSubmit(
												(values) =>
													void runAction(() =>
														onBatchSetWindowBounds(selectedRunningIds, {
															x: 0,
															y: 0,
															width: values.width,
															height: values.height,
														}),
													),
											)}
										>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.width')}</Label>
												<Input
													type="number"
													{...windowBoundsForm.register('width')}
												/>
												{windowBoundsForm.formState.errors.width ? (
													<p className="text-xs text-destructive">
														{windowBoundsForm.formState.errors.width.message}
													</p>
												) : null}
											</div>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.height')}</Label>
												<Input
													type="number"
													{...windowBoundsForm.register('height')}
												/>
												{windowBoundsForm.formState.errors.height ? (
													<p className="text-xs text-destructive">
														{windowBoundsForm.formState.errors.height.message}
													</p>
												) : null}
											</div>
											<div className="md:col-span-2 flex flex-wrap gap-2">
												<Button
													type="submit"
													className="cursor-pointer"
													disabled={selectedRunningIds.length === 0}
												>
													{t('arrange.setSize')}
												</Button>
												<Button
													type="button"
													variant="outline"
													className="cursor-pointer"
													onClick={() =>
														void runAction(() =>
															onBatchRestoreWindows(selectedRunningIds),
														)
													}
													disabled={selectedRunningIds.length === 0}
												>
													<Icon icon={Monitor} size={14} />
													{t('arrange.showWindow')}
												</Button>
											</div>
										</form>
									</CardContent>
								</Card>

								<Card className="border border-border/60 shadow-none min-w-0">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">
											{t('arrange.windowArrange')}
										</CardTitle>
									</CardHeader>
									<CardContent className="min-w-0 space-y-3">
										<form
											className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
											onSubmit={arrangeForm.handleSubmit(
												(values) =>
													void runAction(() =>
														onArrangeWindows({
															profileIds: selectedRunningIds,
															monitorId: values.monitorId,
															mode: values.mode,
															gap: values.gap,
															width: values.width,
															height: values.height,
														}),
													),
											)}
										>
											<div className="min-w-0 space-y-1 md:col-span-2">
												<Label>{t('arrange.monitor')}</Label>
												<Controller
													control={arrangeForm.control}
													name="monitorId"
													render={({ field }) => (
														<Select
															value={field.value}
															onValueChange={field.onChange}
														>
															<SelectTrigger className="cursor-pointer w-full">
																<SelectValue
																	placeholder={t('arrange.selectMonitor')}
																/>
															</SelectTrigger>
															<SelectContent>
																{displayMonitors.map((monitor) => (
																	<SelectItem
																		key={monitor.id}
																		value={monitor.id}
																	>
																		{monitor.name} ({monitor.width}×
																		{monitor.height})
																		{monitor.isPrimary
																			? ` (${t('arrange.primaryMonitor')})`
																			: ''}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													)}
												/>
												{arrangeForm.formState.errors.monitorId ? (
													<p className="text-xs text-destructive">
														{arrangeForm.formState.errors.monitorId.message}
													</p>
												) : null}
											</div>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.arrangeMode')}</Label>
												<Controller
													control={arrangeForm.control}
													name="mode"
													render={({ field }) => (
														<Select
															value={field.value}
															onValueChange={(value) => {
																field.onChange(value);
																setArrangeMode(value as 'grid' | 'cascade');
															}}
														>
															<SelectTrigger className="cursor-pointer w-full">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="grid">
																	{t('arrange.grid')}
																</SelectItem>
																<SelectItem value="cascade">
																	{t('arrange.cascade')}
																</SelectItem>
															</SelectContent>
														</Select>
													)}
												/>
											</div>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.windowGap')}</Label>
												<Input
													type="number"
													{...arrangeForm.register('gap', {
														onChange: (event) =>
															setGap(Number(event.target.value || 0)),
													})}
												/>
											</div>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.width')}</Label>
												<Input
													type="number"
													{...arrangeForm.register('width')}
												/>
											</div>
											<div className="min-w-0 space-y-1">
												<Label>{t('arrange.height')}</Label>
												<Input
													type="number"
													{...arrangeForm.register('height')}
												/>
											</div>
											<div className="md:col-span-2">
												<Button
													type="submit"
													className="cursor-pointer"
													disabled={selectedRunningIds.length === 0}
												>
													{t('arrange.arrangeNow')}
												</Button>
											</div>
										</form>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent value="tab" className="mt-3">
							<WindowBatchActionsCard
								register={register}
								errors={errors}
								selectedRunningIds={selectedRunningIds}
								runningProfileIds={runningProfileIds}
								onBatchOpenTabs={() =>
									void runAction(async () => {
										const url = await resolveValidatedActionUrl();
										await onBatchOpenTabs(selectedRunningIds, url);
									})
								}
								onBatchOpenWindows={() =>
									void runAction(async () => {
										const url = await resolveValidatedActionUrl();
										await onBatchOpenWindows(selectedRunningIds, url);
									})
								}
								onBatchCloseTabs={() =>
									void runAction(async () =>
										onBatchCloseTabs(selectedRunningIds),
									)
								}
								onBatchCloseInactiveTabs={() =>
									void runAction(async () =>
										onBatchCloseInactiveTabs(selectedRunningIds),
									)
								}
								onBatchFocusWindows={() =>
									void runAction(async () =>
										onBatchFocusWindows(selectedRunningIds),
									)
								}
								onRefreshWindows={() => void runAction(onRefreshWindows)}
							/>
						</TabsContent>

						<TabsContent value="text" className="mt-3">
							<Card className="border border-border/60 shadow-none">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">
										{t('textBroadcast.title')}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<form
										className="space-y-3"
										onSubmit={syncTextForm.handleSubmit(
											(values) =>
												void runAction(() => onBroadcastSyncText(values.text)),
										)}
									>
										<div className="space-y-1">
											<Label>{t('textBroadcast.desc')}</Label>
											<Textarea
												rows={5}
												placeholder={t('textBroadcast.placeholder')}
												{...syncTextForm.register('text')}
											/>
											{syncTextForm.formState.errors.text ? (
												<p className="text-xs text-destructive">
													{syncTextForm.formState.errors.text.message}
												</p>
											) : null}
										</div>
										<Button
											type="submit"
											className="cursor-pointer"
											disabled={!activeSyncSession}
										>
											<Icon icon={Send} size={14} />
											{t('textBroadcast.send')}
										</Button>
									</form>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			<WindowStatesCard
				profiles={profiles}
				windowStates={windowStates}
				selectedProfileIds={selectedProfileIds}
				pendingProfileIds={pendingProfileIds}
				error={error}
				onSelectProfile={(profileId, checked) =>
					toggleProfile(profileId, checked)
				}
				onViewProfile={onViewProfile}
				onRunProfileAction={(profileId, action) =>
					void runProfileAction(profileId, action)
				}
				onResolveValidatedActionUrl={resolveValidatedActionUrl}
				onOpenTab={onOpenTab}
				onCloseTab={onCloseTab}
				onCloseInactiveTabs={onCloseInactiveTabs}
				onActivateTab={onActivateTab}
				onActivateTabByIndex={onActivateTabByIndex}
				onOpenWindow={onOpenWindow}
				onCloseWindow={onCloseWindow}
				onFocusWindow={onFocusWindow}
				onSetWindowBounds={onSetWindowBounds}
			/>
		</div>
	);
}
