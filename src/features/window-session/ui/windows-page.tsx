import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Focus, LoaderCircle, Monitor, RefreshCw, Send, Sparkles } from 'lucide-react';
import { z } from 'zod/v3';

import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
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
		.min(1, '请输入 URL')
		.superRefine((value, ctx) => {
			try {
				const parsed = new URL(value);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'URL 必须以 http:// 或 https:// 开头',
					});
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '请输入合法 URL（必须以 http:// 或 https:// 开头）',
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
		throw new Error('URL 必须以 http:// 或 https:// 开头');
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
	const section = WORKSPACE_SECTIONS.windows;
	const [pendingProfileIds, setPendingProfileIds] = useState<Set<string>>(new Set());
	const [syncActionPending, setSyncActionPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedProfileIds = useWindowSyncStore((state) => state.selectedProfileIds);
	const masterProfileId = useWindowSyncStore((state) => state.masterProfileId);
	const activeConfigTab = useWindowSyncStore((state) => state.activeConfigTab);
	const arrangeMode = useWindowSyncStore((state) => state.arrangeMode);
	const arrangeGap = useWindowSyncStore((state) => state.arrangeGap);
	const toggleProfile = useWindowSyncStore((state) => state.toggleProfile);
	const setMasterProfileId = useWindowSyncStore((state) => state.setMasterProfileId);
	const setActiveConfigTab = useWindowSyncStore((state) => state.setActiveConfigTab);
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
		const preferred = displayMonitors.find((item) => item.isPrimary) ?? displayMonitors[0];
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
			setError(err instanceof Error ? err.message : '窗口同步操作失败');
		}
	};

	const resolveValidatedActionUrl = async () => {
		const valid = await trigger('targetUrl');
		if (!valid) {
			throw new Error(
				errors.targetUrl?.message ??
					'请输入合法 URL（必须以 http:// 或 https:// 开头）',
			);
		}
		return normalizeActionUrl(getValues('targetUrl'));
	};

	const runProfileAction = async (profileId: string, action: () => Promise<void>) => {
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
						label: `主控 ${profileNameMap[sessionPayload.master.id] ?? sessionPayload.master.id}`,
						boundBrowserId: sessionPayload.master.boundBrowserId ?? null,
						boundWindowToken: sessionPayload.master.boundWindowToken ?? null,
						coordinateMode: sessionPayload.master.coordinateMode ?? null,
					}
				: null,
			...(sessionPayload?.slaves ?? []).map((item) => ({
				label: `从控 ${profileNameMap[item.id] ?? item.id}`,
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
		<div className="space-y-3">
			<ActiveSectionCard label="同步" title={section.title} description={section.desc} />

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">同步列表</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 px-1 pt-0">
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<p>已选择 {selectedRunningIds.length} / {runningProfileIds.length} 个运行中环境</p>
						{activeSyncSession ? (
							<Badge variant="default">
								同步中 · 主控 {profileNameMap[activeSyncSession.masterId] ?? activeSyncSession.masterId}
							</Badge>
						) : (
							<Badge variant="secondary">当前未启动同步</Badge>
						)}
						<Badge variant={syncConnectionStatus === 'connected' ? 'default' : 'outline'}>
							sidecar {syncConnectionStatus}
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
										: onStartSync(selectedRunningIds, masterProfileId ?? ''),
								)
							}
							disabled={syncActionPending || (activeSyncSession ? !activeSyncSession : !startValidation.ok)}
						>
							<Icon
								icon={syncActionPending ? LoaderCircle : Sparkles}
								size={14}
								className={syncActionPending ? 'animate-spin' : ''}
							/>
							{syncActionPending
								? activeSyncSession
									? '停止同步中'
									: '启动同步中'
								: activeSyncSession
									? '停止同步'
									: '启动同步'}
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => void runAction(onRestartSync)}
							disabled={syncActionPending || !activeSyncSession}
						>
							重启同步
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
							刷新同步状态
						</Button>
					</div>
					{startValidation.reason ? (
						<p className="text-xs text-muted-foreground">{startValidation.reason}</p>
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
											onCheckedChange={(checked) => toggleProfile(item.profileId, checked === true)}
										/>
										<div>
											<p className="text-sm font-medium">
												{profileNameMap[item.profileId] ?? item.profileId}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.totalWindows} 窗口 / {item.totalTabs} 标签 / {item.host}:{item.magicSocketServerPort ?? '-'}
											</p>
										</div>
										<Badge variant={item.syncRole === 'master' ? 'default' : item.syncRole === 'slave' ? 'secondary' : 'outline'}>
											{item.syncRole === 'master' ? '主控' : item.syncRole === 'slave' ? '从控' : '未同步'}
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
								{item.lastProbeError ? <Badge variant="outline">probe 异常</Badge> : null}
								{item.boundBrowserId ? (
									<Badge variant="outline">browser {item.boundBrowserId}</Badge>
								) : null}
								{item.boundWindowToken ? (
									<Badge variant="outline">token {item.boundWindowToken}</Badge>
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
											设为主控
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											className="cursor-pointer"
											onClick={() => onViewProfile(item.profileId)}
										>
											环境详情
										</Button>
									</div>
								</div>
							);
						})}
					</div>

				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">同步诊断</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 px-1 pt-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
					<div className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">连接状态</p>
								<p className="mt-1 text-sm font-medium">{syncConnectionStatus}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">sidecar 端口</p>
								<p className="mt-1 text-sm font-medium">{sidecarPort ?? '-'}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">会话状态</p>
								<p className="mt-1 text-sm font-medium">{activeSyncSession?.status ?? 'stopped'}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">已转发事件</p>
								<p className="mt-1 text-sm font-medium">{metrics?.eventsForwarded ?? 0}</p>
							</div>
							<div className="rounded-lg border border-border/60 p-3">
								<p className="text-xs text-muted-foreground">失败事件</p>
								<p className="mt-1 text-sm font-medium">{metrics?.eventsFailed ?? 0}</p>
							</div>
						</div>
						<div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
							<p>
								最近错误：
								<span className="ml-1 text-foreground">{syncLastError ?? '无'}</span>
							</p>
							<p className="mt-1">
								会话原因：
								<span className="ml-1 text-foreground">
									{sessionPayload?.reason ?? syncLastError ?? '无'}
								</span>
							</p>
							<p className="mt-1">
								丢弃统计：
								<span className="ml-1 text-foreground">
									invalid {metrics?.eventsDroppedInvalid ?? 0} / session mismatch{' '}
									{metrics?.eventsDroppedSessionMismatch ?? 0} / non-replayable{' '}
									{metrics?.eventsDroppedNonReplayable ?? 0} / platform mismatch{' '}
									{metrics?.eventsDroppedPlatformMismatch ?? 0}
								</span>
							</p>
							{bindingDiagnostics.length > 0 ? (
								<div className="mt-2 space-y-1">
									<p className="text-foreground">绑定窗口</p>
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
										坐标模式：
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
							<p className="mb-2 text-sm font-medium">最近 warning</p>
							<div className="space-y-2 text-xs text-muted-foreground">
								{recentWarnings.length === 0 ? (
									<p>暂无 warning</p>
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
							<p className="mb-2 text-sm font-medium">最近 probe 错误</p>
							<div className="space-y-2 text-xs text-muted-foreground">
								{recentProbeErrors.length === 0 ? (
									<p>暂无 probe 错误</p>
								) : (
									recentProbeErrors.slice(0, 5).map((item) => (
										<div key={item.profileId} className="rounded-md border border-border/50 px-2 py-1">
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

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">配置区</CardTitle>
				</CardHeader>
				<CardContent className="min-w-0 px-1 pt-0">
					<Tabs value={activeConfigTab} onValueChange={(value) => setActiveConfigTab(value as 'window' | 'tab' | 'text')}>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="window">窗口管理</TabsTrigger>
							<TabsTrigger value="tab">标签页管理</TabsTrigger>
							<TabsTrigger value="text">文本输入</TabsTrigger>
						</TabsList>

						<TabsContent value="window" className="mt-3 min-w-0 space-y-3">
							<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
								<Card className="border border-border/60 shadow-none min-w-0">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">统一大小 / 显示窗口</CardTitle>
									</CardHeader>
									<CardContent className="min-w-0 space-y-3">
										<form
											className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
											onSubmit={windowBoundsForm.handleSubmit((values) =>
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
												<Label>宽度</Label>
												<Input type="number" {...windowBoundsForm.register('width')} />
												{windowBoundsForm.formState.errors.width ? (
													<p className="text-xs text-destructive">{windowBoundsForm.formState.errors.width.message}</p>
												) : null}
											</div>
											<div className="min-w-0 space-y-1">
												<Label>高度</Label>
												<Input type="number" {...windowBoundsForm.register('height')} />
												{windowBoundsForm.formState.errors.height ? (
													<p className="text-xs text-destructive">{windowBoundsForm.formState.errors.height.message}</p>
												) : null}
											</div>
											<div className="md:col-span-2 flex flex-wrap gap-2">
												<Button type="submit" className="cursor-pointer" disabled={selectedRunningIds.length === 0}>
													统一大小
												</Button>
												<Button
													type="button"
													variant="outline"
													className="cursor-pointer"
													onClick={() => void runAction(() => onBatchRestoreWindows(selectedRunningIds))}
													disabled={selectedRunningIds.length === 0}
												>
													<Icon icon={Monitor} size={14} />
													显示窗口
												</Button>
											</div>
										</form>
									</CardContent>
								</Card>

								<Card className="border border-border/60 shadow-none min-w-0">
									<CardHeader className="pb-2">
										<CardTitle className="text-sm">窗口排列</CardTitle>
									</CardHeader>
									<CardContent className="min-w-0 space-y-3">
										<form
											className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
											onSubmit={arrangeForm.handleSubmit((values) =>
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
												<Label>显示器</Label>
												<Controller
													control={arrangeForm.control}
													name="monitorId"
													render={({ field }) => (
														<Select value={field.value} onValueChange={field.onChange}>
															<SelectTrigger className="cursor-pointer w-full">
																<SelectValue placeholder="请选择显示器" />
															</SelectTrigger>
															<SelectContent>
																{displayMonitors.map((monitor) => (
																	<SelectItem key={monitor.id} value={monitor.id}>
																		{monitor.name}
																		{monitor.isPrimary ? ' (主显示器)' : ''}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													)}
												/>
												{arrangeForm.formState.errors.monitorId ? (
													<p className="text-xs text-destructive">{arrangeForm.formState.errors.monitorId.message}</p>
												) : null}
											</div>
											<div className="min-w-0 space-y-1">
												<Label>排列方式</Label>
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
																<SelectItem value="grid">宫格平铺</SelectItem>
																<SelectItem value="cascade">重叠平铺</SelectItem>
															</SelectContent>
														</Select>
													)}
												/>
											</div>
											<div className="min-w-0 space-y-1">
												<Label>窗口间距</Label>
												<Input
													type="number"
													{...arrangeForm.register('gap', {
														onChange: (event) => setGap(Number(event.target.value || 0)),
													})}
												/>
											</div>
											<div className="min-w-0 space-y-1">
												<Label>宽度</Label>
												<Input type="number" {...arrangeForm.register('width')} />
											</div>
											<div className="min-w-0 space-y-1">
												<Label>高度</Label>
												<Input type="number" {...arrangeForm.register('height')} />
											</div>
											<div className="md:col-span-2">
												<Button type="submit" className="cursor-pointer" disabled={selectedRunningIds.length === 0}>
													一键排列
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
								onBatchCloseTabs={() => void runAction(async () => onBatchCloseTabs(selectedRunningIds))}
								onBatchCloseInactiveTabs={() => void runAction(async () => onBatchCloseInactiveTabs(selectedRunningIds))}
								onBatchFocusWindows={() => void runAction(async () => onBatchFocusWindows(selectedRunningIds))}
								onRefreshWindows={() => void runAction(onRefreshWindows)}
							/>
						</TabsContent>

						<TabsContent value="text" className="mt-3">
							<Card className="border border-border/60 shadow-none">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm">文本输入广播</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<form
										className="space-y-3"
										onSubmit={syncTextForm.handleSubmit((values) =>
											void runAction(() => onBroadcastSyncText(values.text)),
										)}
									>
										<div className="space-y-1">
											<Label>发送到所有从控当前焦点输入框</Label>
											<Textarea
												rows={5}
												placeholder="输入要同步的文本"
												{...syncTextForm.register('text')}
											/>
											{syncTextForm.formState.errors.text ? (
												<p className="text-xs text-destructive">{syncTextForm.formState.errors.text.message}</p>
											) : null}
										</div>
										<Button type="submit" className="cursor-pointer" disabled={!activeSyncSession}>
											<Icon icon={Send} size={14} />
											广播文本
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
				onSelectProfile={(profileId, checked) => toggleProfile(profileId, checked)}
				onViewProfile={onViewProfile}
				onRunProfileAction={(profileId, action) => void runProfileAction(profileId, action)}
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
