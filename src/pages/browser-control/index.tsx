/**
 * 浏览器控制页面 — 窗口管理、标签页管理、文本输入、运行环境窗口详情
 * 从窗口同步页面拆分而来，独立为主导航入口
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod/v3';
import { AppWindow, Bookmark, LayoutList, Monitor, Send, Type } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import { getWorkspaceSection } from '@/app/model/workspace-sections';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { formatDisplayMonitorOptionLabel } from '@/entities/window-session/model/display-monitor-label';
import { useDisplayMonitorsQuery } from '@/entities/window-session/model/use-display-monitors-query';
import { useSyncTargetsQuery } from '@/entities/window-session/model/use-sync-targets-query';
import { buildSyncTargetItems } from '@/entities/window-session/model/build-sync-target-items';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWindowSyncActions } from '@/features/window-session/model/use-window-sync-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { WindowBatchActionsCard } from '@/features/window-session/ui/window-batch-actions-card';
import { WindowStatesCard } from '@/features/window-session/ui/window-states-card';
import { useWindowSyncStore, windowSyncStore } from '@/store/window-sync-store';
import { useSyncManagerStore } from '@/store/sync-manager-store';
import { computeArrangePreview } from '@/features/window-session/lib/arrange-preview';
import { ArrangePreview } from '@/features/window-session/ui/arrange-preview';
import {
	arrangeWindowsFormSchema,
	syncTextFormSchema,
	windowBoundsBatchFormSchema,
} from '@/features/window-session/model/window-sync-forms';
import { BookmarkTab } from '@/widgets/browser-control/ui/bookmark-tab';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { NAV_PATHS } from '@/app/workspace-routes';
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
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

const section = getWorkspaceSection('browser-control');

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
					message: i18next.t('window:validation.invalidUrl'),
				});
			}
		}),
});

type ArrangeWindowsFormValues = z.input<typeof arrangeWindowsFormSchema>;

export function BrowserControlRoutePage() {
	const { t } = useTranslation(['window', 'common']);
	const { navigation } = useOutletContext<WorkspaceOutletContext>();
	const profilesQuery = useProfilesQuery();
	const localTargetsQuery = useSyncTargetsQuery();
	const displayMonitorsQuery = useDisplayMonitorsQuery();
	const localTargets = localTargetsQuery.data?.items ?? [];
	const displayMonitors = displayMonitorsQuery.data ?? [];
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const { refreshWindows, refreshWindowsStable, refreshProfilesAndBindings } =
		useWorkspaceRefresh();
	const sessionPayload = useSyncManagerStore((s) => s.sessionPayload);
	const syncLocalTargets = useSyncManagerStore((s) => s.syncLocalTargets);
	const syncInstances = useSyncManagerStore((s) => s.instances);
	const selectedProfileIds = useWindowSyncStore((s) => s.selectedProfileIds);
	const arrangeMode = useWindowSyncStore((s) => s.arrangeMode);
	const arrangeGap = useWindowSyncStore((s) => s.arrangeGap);
	const arrangeTemplates = useWindowSyncStore((s) => s.arrangeTemplates);
	const setArrangeMode = useWindowSyncStore((s) => s.setArrangeMode);
	const setGap = useWindowSyncStore((s) => s.setGap);
	const saveArrangeTemplate = useWindowSyncStore((s) => s.saveArrangeTemplate);
	const deleteArrangeTemplate = useWindowSyncStore((s) => s.deleteArrangeTemplate);

	const [templateNameInput, setTemplateNameInput] = useState('');
	const [showSaveTemplate, setShowSaveTemplate] = useState(false);

	const activeSyncSession = sessionPayload?.session ?? null;

	const withWindowActionLock = useCallback(
		async (profileId: string, action: () => Promise<void>) => {
			if (windowActionLocksRef.current.has(profileId)) return;
			windowActionLocksRef.current.add(profileId);
			try {
				await action();
			} finally {
				windowActionLocksRef.current.delete(profileId);
			}
		},
		[],
	);

	const windowActions = useWindowActions({
		withWindowActionLock,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});
	const syncActions = useWindowSyncActions({
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});

	const runningProfileIds = useMemo(() => {
		const profilesData = profilesQuery.data ?? [];
		return profilesData
			.filter((p) => p.lifecycle === 'active' && p.running)
			.map((p) => p.id);
	}, [profilesQuery.data]);
	const selectedRunningIds = useMemo(() => {
		const runningSet = new Set(runningProfileIds);
		return selectedProfileIds.filter((id) => runningSet.has(id));
	}, [runningProfileIds, selectedProfileIds]);

	const runningProfiles = useMemo(() => {
		const profilesData = profilesQuery.data ?? [];
		return profilesData.filter(
			(p) => p.lifecycle === 'active' && p.running,
		);
	}, [profilesQuery.data]);

	const allSelected =
		runningProfiles.length > 0 &&
		runningProfiles.every((p) => selectedProfileIds.includes(p.id));

	const toggleProfile = useCallback(
		(id: string) => {
			const current = windowSyncStore.getState().selectedProfileIds;
			const isChecked = !current.includes(id);
			windowSyncStore.getState().toggleProfile(id, isChecked);
		},
		[],
	);

	const toggleAll = useCallback(() => {
		const state = windowSyncStore.getState();
		const current = state.selectedProfileIds;
		if (allSelected) {
			runningProfiles.forEach((p) => state.toggleProfile(p.id, false));
		} else {
			runningProfiles.forEach((p) => {
				if (!current.includes(p.id)) {
					state.toggleProfile(p.id, true);
				}
			});
		}
	}, [allSelected, runningProfiles]);

	const [error, setError] = useState<string | null>(null);
	const [pendingProfileIds, setPendingProfileIds] = useState<Set<string>>(
		new Set(),
	);

	const runAction = useCallback(async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	const runProfileAction = useCallback(
		async (profileId: string, action: () => Promise<void>) => {
			if (pendingProfileIds.has(profileId)) return;
			setPendingProfileIds((prev) => new Set(prev).add(profileId));
			await runAction(action);
			setPendingProfileIds((prev) => {
				const next = new Set(prev);
				next.delete(profileId);
				return next;
			});
		},
		[pendingProfileIds, runAction],
	);

	// Forms
	const {
		register,
		formState: { errors },
		trigger,
		getValues,
	} = useForm({
		resolver: zodResolver(batchActionFormSchema),
		defaultValues: { targetUrl: 'https://www.browserscan.net/' },
	});
	const windowBoundsForm = useForm({
		resolver: zodResolver(windowBoundsBatchFormSchema),
		defaultValues: { width: 1280, height: 800 },
	});
	const arrangeForm = useForm<ArrangeWindowsFormValues>({
		resolver: zodResolver(arrangeWindowsFormSchema),
		defaultValues: {
			monitorId: displayMonitors[0]?.id ?? '',
			mode: (arrangeMode as 'grid' | 'cascade' | 'main_with_sidebar') ?? 'grid',
			rows: undefined,
			columns: undefined,
			gapX: arrangeGap,
			gapY: arrangeGap,
			paddingTop: 12,
			paddingRight: 12,
			paddingBottom: 12,
			paddingLeft: 12,
			lastRowAlign: 'stretch',
			flow: 'row_major',
			width: 1280,
			height: 800,
			cascadeStep: 32,
			mainRatio: 0.66,
			mainPosition: 'left',
			order: 'selection',
			chromeDecorationCompensation: 'auto',
		},
	});
	const syncTextForm = useForm({
		resolver: zodResolver(syncTextFormSchema),
		defaultValues: { text: '' },
	});

	// 当 displayMonitors 加载完成后设置默认显示器
	useEffect(() => {
		if (displayMonitors.length === 0) return;
		const current = arrangeForm.getValues('monitorId');
		if (current) return;
		const preferred =
			displayMonitors.find((m) => m.isPrimary) ?? displayMonitors[0];
		arrangeForm.setValue('monitorId', preferred.id);
	}, [arrangeForm, displayMonitors]);

	const resolveValidatedActionUrl = useCallback(async () => {
		const ok = await trigger('targetUrl');
		if (!ok) throw new Error(i18next.t('window:validation.invalidUrl'));
		const raw = getValues('targetUrl').trim();
		return new URL(raw).toString();
	}, [trigger, getValues]);

	const refreshSyncAwareWindows = useCallback(async () => {
		await refreshWindows();
		await syncLocalTargets(localTargets);
	}, [localTargets, refreshWindows, syncLocalTargets]);

	// 构建 windowStates（包含 syncRole, instanceStatus 等富状态）
	const windowStates = useMemo(
		() => buildSyncTargetItems(localTargets, syncInstances, sessionPayload),
		[localTargets, syncInstances, sessionPayload],
	);

	const handleViewProfile = useCallback(
		(profileId: string) => {
			navigation.onSetProfileNavigationIntent({ profileId, view: 'detail', returnNav: 'browser-control' });
			navigation.onNavigate(NAV_PATHS.profiles);
		},
		[navigation],
	);

	return (
		<div className="flex h-full min-h-0 w-full flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
			<ActiveSectionCard
				label={t('page.configArea')}
				title={section.title}
				description={section.desc}
			/>

			{/* 运行环境选择器 */}
			<Card className="border border-border/60 shadow-none shrink-0">
				<CardContent className="py-3">
					<div className="flex items-center gap-3 flex-wrap">
						<Label className="text-sm shrink-0">{t('page.selectEnv')}</Label>
						<div className="flex flex-wrap gap-2 flex-1 min-w-0">
							{runningProfiles.length === 0 ? (
								<span className="text-xs text-muted-foreground">
									{t('page.noRunningEnv')}
								</span>
							) : (
								runningProfiles.map((p) => {
									const isSelected = selectedProfileIds.includes(p.id);
									return (
										<button
											key={p.id}
											type="button"
											onClick={() => toggleProfile(p.id)}
											className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
												isSelected
													? 'bg-primary text-primary-foreground border-primary'
													: 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
											}`}
										>
											{p.name}
											{isSelected && (
												<span className="text-[10px] opacity-70">✓</span>
											)}
										</button>
									);
								})
							)}
						</div>
						{runningProfiles.length > 1 && (
							<button
								type="button"
								onClick={toggleAll}
								className="text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
							>
								{allSelected
									? t('page.deselectAll')
									: t('page.selectAll')}
							</button>
						)}
					</div>
				</CardContent>
			</Card>

			{error && (
				<div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive shrink-0">
					{error}
				</div>
			)}

			<Tabs defaultValue="window" className="shrink-0">
				<TabsList className="h-9 bg-muted/40">
					<TabsTrigger
						value="window"
						className="text-xs h-7 px-3 cursor-pointer gap-1.5"
					>
						<AppWindow className="h-3 w-3" />
						{t('page.windowManagement')}
					</TabsTrigger>
					<TabsTrigger
						value="tab"
						className="text-xs h-7 px-3 cursor-pointer gap-1.5"
					>
						<LayoutList className="h-3 w-3" />
						{t('page.tabManagement')}
					</TabsTrigger>
					<TabsTrigger
						value="text"
						className="text-xs h-7 px-3 cursor-pointer gap-1.5"
					>
						<Type className="h-3 w-3" />
						{t('page.textInput')}
					</TabsTrigger>
					<TabsTrigger
						value="bookmark"
						className="text-xs h-7 px-3 cursor-pointer gap-1.5"
					>
						<Bookmark className="h-3 w-3" />
						{t('page.bookmarks', { defaultValue: '书签' })}
					</TabsTrigger>
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
												syncActions.applyUniformBounds(selectedRunningIds, {
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
									</div>
									<div className="min-w-0 space-y-1">
										<Label>{t('arrange.height')}</Label>
										<Input
											type="number"
											{...windowBoundsForm.register('height')}
										/>
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
													syncActions.restoreWindows(selectedRunningIds),
												)
											}
											disabled={selectedRunningIds.length === 0}
										>
											<Icon icon={Monitor} size={14} />{' '}
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
								{/* 布局预览 */}
								{(() => {
									const watchedValues = arrangeForm.watch();
									const selectedMonitor = displayMonitors.find(
										(m) => m.id === watchedValues.monitorId,
									);
									if (!selectedMonitor || selectedRunningIds.length === 0) return null;

									// work_area 是物理像素；预览和后端保持一致，用 DIP 空间
									const scale = Math.max(1, selectedMonitor.scaleFactor || 1);
									const dipWorkArea = {
										x: Math.round(selectedMonitor.workArea.x / scale),
										y: Math.round(selectedMonitor.workArea.y / scale),
										width: Math.round(selectedMonitor.workArea.width / scale),
										height: Math.round(selectedMonitor.workArea.height / scale),
									};

									// register() 默认把 input 值保留为字符串，需手动解析为数字
									const parseNum = (v: unknown, fallback: number) => {
										if (v === undefined || v === null || v === '' || v === 'auto') return fallback;
										const n = typeof v === 'number' ? v : Number(v);
										return Number.isFinite(n) ? n : fallback;
									};
									const parseHint = (v: unknown) => {
										if (v === undefined || v === null || v === '' || v === 'auto') return undefined;
										const n = typeof v === 'number' ? v : Number(v);
										return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
									};

									const previewBounds = computeArrangePreview({
										workArea: dipWorkArea,
										n: selectedRunningIds.length,
										mode: watchedValues.mode as 'grid' | 'cascade' | 'main_with_sidebar',
										rows: parseHint(watchedValues.rows),
										columns: parseHint(watchedValues.columns),
										gapX: parseNum(watchedValues.gapX, 16),
										gapY: parseNum(watchedValues.gapY, 16),
										padding: {
											top: parseNum(watchedValues.paddingTop, 12),
											right: parseNum(watchedValues.paddingRight, 12),
											bottom: parseNum(watchedValues.paddingBottom, 12),
											left: parseNum(watchedValues.paddingLeft, 12),
										},
										lastRowAlign: watchedValues.lastRowAlign,
										flow: watchedValues.flow,
										width: parseNum(watchedValues.width, 1280),
										height: parseNum(watchedValues.height, 800),
										cascadeStep: parseNum(watchedValues.cascadeStep, 32),
										mainRatio: parseNum(watchedValues.mainRatio, 0.66),
										mainPosition: watchedValues.mainPosition,
									});

									return (
										<div className="flex justify-center">
											<ArrangePreview
												workArea={dipWorkArea}
												bounds={previewBounds}
												canvasWidth={240}
												canvasHeight={140}
												className="rounded border border-border/40"
											/>
										</div>
									);
								})()}

								<form
									className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
									onSubmit={arrangeForm.handleSubmit(
										(values) => {
											const mode = values.mode as 'grid' | 'cascade' | 'main_with_sidebar';
											void runAction(() =>
												syncActions.arrangeWindows({
													profileIds: selectedRunningIds,
													monitorId: values.monitorId,
													mode,
													gapX: values.gapX,
													gapY: values.gapY,
													padding: {
														top: values.paddingTop ?? 12,
														right: values.paddingRight ?? 12,
														bottom: values.paddingBottom ?? 12,
														left: values.paddingLeft ?? 12,
													},
													rows: values.rows === 'auto' ? undefined : values.rows as number | undefined,
													columns: values.columns === 'auto' ? undefined : values.columns as number | undefined,
													lastRowAlign: values.lastRowAlign,
													flow: values.flow,
													width: values.width ?? undefined,
													height: values.height ?? undefined,
													cascadeStep: values.cascadeStep,
													mainRatio: values.mainRatio,
													mainPosition: values.mainPosition,
													order: values.order,
													chromeDecorationCompensation: values.chromeDecorationCompensation,
												}),
											);
										}
									)}
								>
									<div className="min-w-0 space-y-1 md:col-span-2">
										<Label>{t('arrange.monitor')}</Label>
										<Controller
											control={arrangeForm.control}
											name="monitorId"
											render={({ field }) => (
												<Select value={field.value} onValueChange={field.onChange}>
													<SelectTrigger className="cursor-pointer w-full">
														<SelectValue placeholder={t('arrange.selectMonitor')} />
													</SelectTrigger>
													<SelectContent>
														{displayMonitors.map((m) => (
															<SelectItem key={m.id} value={m.id}>
																{formatDisplayMonitorOptionLabel(m, t)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
									</div>
									<div className="min-w-0 space-y-1 md:col-span-2">
										<Label>{t('arrange.arrangeMode')}</Label>
										<Controller
											control={arrangeForm.control}
											name="mode"
											render={({ field }) => (
												<Select
													value={field.value}
													onValueChange={(v) => {
														field.onChange(v);
														setArrangeMode(v as 'grid' | 'cascade');
													}}
												>
													<SelectTrigger className="cursor-pointer w-full">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="grid">{t('arrange.grid')}</SelectItem>
														<SelectItem value="cascade">{t('arrange.cascade')}</SelectItem>
														<SelectItem value="main_with_sidebar">{t('arrange.mainWithSidebar')}</SelectItem>
													</SelectContent>
												</Select>
											)}
										/>
									</div>

									{/* grid 模式：行列 + 快捷预设 */}
									{arrangeForm.watch('mode') === 'grid' && (<>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.rows')}</Label>
											<Input
												type="number"
												min={1}
												placeholder={t('arrange.auto')}
												{...arrangeForm.register('rows')}
											/>
										</div>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.columns')}</Label>
											<Input
												type="number"
												min={1}
												placeholder={t('arrange.auto')}
												{...arrangeForm.register('columns')}
											/>
										</div>
										<div className="md:col-span-2 flex gap-2 flex-wrap">
											<Button type="button" variant="outline" size="sm" className="cursor-pointer"
												onClick={() => { arrangeForm.setValue('rows', 1 as unknown as 'auto'); arrangeForm.setValue('columns', undefined); }}>
												{t('arrange.preset.singleRow')}
											</Button>
											<Button type="button" variant="outline" size="sm" className="cursor-pointer"
												onClick={() => { arrangeForm.setValue('rows', undefined); arrangeForm.setValue('columns', 1 as unknown as 'auto'); }}>
												{t('arrange.preset.singleCol')}
											</Button>
											<Button type="button" variant="outline" size="sm" className="cursor-pointer"
												onClick={() => { arrangeForm.setValue('rows', undefined); arrangeForm.setValue('columns', undefined); }}>
												{t('arrange.preset.auto')}
											</Button>
										</div>
									</>)}

									{/* cascade 模式：宽高步长 */}
									{arrangeForm.watch('mode') === 'cascade' && (<>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.width')}</Label>
											<Input type="number" {...arrangeForm.register('width')} />
										</div>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.height')}</Label>
											<Input type="number" {...arrangeForm.register('height')} />
										</div>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.cascadeStep')}</Label>
											<Input type="number" min={8} {...arrangeForm.register('cascadeStep')} />
										</div>
									</>)}

									{/* mainWithSidebar 模式 */}
									{arrangeForm.watch('mode') === 'main_with_sidebar' && (<>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.mainRatio')}</Label>
											<Input type="number" step={0.05} min={0.2} max={0.9} {...arrangeForm.register('mainRatio')} />
										</div>
										<div className="min-w-0 space-y-1">
											<Label>{t('arrange.mainPosition')}</Label>
											<Controller
												control={arrangeForm.control}
												name="mainPosition"
												render={({ field }) => (
													<Select value={field.value} onValueChange={field.onChange}>
														<SelectTrigger className="cursor-pointer w-full"><SelectValue /></SelectTrigger>
														<SelectContent>
															<SelectItem value="left">{t('arrange.posLeft')}</SelectItem>
															<SelectItem value="right">{t('arrange.posRight')}</SelectItem>
															<SelectItem value="top">{t('arrange.posTop')}</SelectItem>
															<SelectItem value="bottom">{t('arrange.posBottom')}</SelectItem>
														</SelectContent>
													</Select>
												)}
											/>
										</div>
									</>)}

									{/* 通用：独立横纵间距 */}
									<div className="min-w-0 space-y-1">
										<Label>{t('arrange.gapX')}</Label>
										<Input
											type="number"
											min={0}
											{...arrangeForm.register('gapX', {
												onChange: (e) => setGap(Number(e.target.value || 0)),
											})}
										/>
									</div>
									<div className="min-w-0 space-y-1">
										<Label>{t('arrange.gapY')}</Label>
										<Input type="number" min={0} {...arrangeForm.register('gapY')} />
									</div>

									<div className="md:col-span-2 flex gap-2 flex-wrap">
										<Button
											type="submit"
											className="cursor-pointer"
											disabled={selectedRunningIds.length === 0}
										>
											{t('arrange.arrangeNow')}
										</Button>
										<Button
											type="button"
											variant="outline"
											className="cursor-pointer"
											onClick={() => void runAction(() => syncActions.restoreLastArrangement())}
										>
											{t('arrange.undoLast')}
										</Button>
									</div>

									{/* 模板保存 */}
									<div className="md:col-span-2 border-t border-border/40 pt-3 space-y-2">
										{showSaveTemplate ? (
											<div className="flex gap-2 items-center">
												<Input
													className="flex-1"
													placeholder={t('template.namePlaceholder')}
													value={templateNameInput}
													onChange={(e) => setTemplateNameInput(e.target.value)}
												/>
												<Button
													type="button"
													size="sm"
													className="cursor-pointer"
													onClick={() => {
														if (!templateNameInput.trim()) return;
														const values = arrangeForm.getValues();
														saveArrangeTemplate(templateNameInput.trim(), values as unknown as Record<string, unknown>);
														setTemplateNameInput('');
														setShowSaveTemplate(false);
													}}
												>
													{t('template.save')}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="cursor-pointer"
													onClick={() => { setShowSaveTemplate(false); setTemplateNameInput(''); }}
												>
													{t('template.cancel')}
												</Button>
											</div>
										) : (
											<div className="flex gap-2 flex-wrap items-center">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="cursor-pointer text-xs"
													onClick={() => setShowSaveTemplate(true)}
												>
													{t('template.saveTemplate')}
												</Button>
												{arrangeTemplates.length > 0 && (
													<Select
														onValueChange={(id) => {
															const tmpl = arrangeTemplates.find((t) => t.id === id);
															if (!tmpl) return;
															const payload = tmpl.payload as Record<string, unknown>;
															Object.entries(payload).forEach(([key, val]) => {
																arrangeForm.setValue(key as Parameters<typeof arrangeForm.setValue>[0], val as never);
															});
														}}
													>
														<SelectTrigger className="cursor-pointer h-7 text-xs w-auto min-w-[120px]">
															<SelectValue placeholder={t('template.loadTemplate')} />
														</SelectTrigger>
														<SelectContent>
															{arrangeTemplates.map((tmpl) => (
																<SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
																	{tmpl.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
												{arrangeTemplates.length > 0 && (
													<Select
														onValueChange={(id) => deleteArrangeTemplate(id)}
													>
														<SelectTrigger className="cursor-pointer h-7 text-xs w-auto min-w-[80px] text-destructive border-destructive/30">
															<SelectValue placeholder={t('template.delete')} />
														</SelectTrigger>
														<SelectContent>
															{arrangeTemplates.map((tmpl) => (
																<SelectItem key={tmpl.id} value={tmpl.id} className="text-xs text-destructive">
																	{tmpl.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
											</div>
										)}
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
								await windowActions.batchOpenTabs(selectedRunningIds, url);
							})
						}
						onBatchOpenWindows={() =>
							void runAction(async () => {
								const url = await resolveValidatedActionUrl();
								await windowActions.batchOpenWindows(selectedRunningIds, url);
							})
						}
						onBatchCloseTabs={() =>
							void runAction(() =>
								windowActions.batchCloseTabs(selectedRunningIds),
							)
						}
						onBatchCloseInactiveTabs={() =>
							void runAction(() =>
								windowActions.batchCloseInactiveTabs(selectedRunningIds),
							)
						}
						onBatchFocusWindows={() =>
							void runAction(() =>
								windowActions.batchFocusWindows(selectedRunningIds),
							)
						}
						onRefreshWindows={() => void runAction(refreshSyncAwareWindows)}
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
										void runAction(() => syncActions.sendSyncText(values.text)),
								)}
							>
								<div className="space-y-1">
									<Label>{t('textBroadcast.desc')}</Label>
									<Textarea
										rows={5}
										placeholder={t('textBroadcast.placeholder')}
										{...syncTextForm.register('text')}
									/>
									{syncTextForm.formState.errors.text && (
										<p className="text-xs text-destructive">
											{syncTextForm.formState.errors.text.message}
										</p>
									)}
								</div>
								<Button
									type="submit"
									className="cursor-pointer"
									disabled={!activeSyncSession}
								>
									<Icon icon={Send} size={14} /> {t('textBroadcast.send')}
								</Button>
							</form>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="bookmark" className="mt-3 min-h-[480px] flex flex-col">
					<BookmarkTab profiles={profilesQuery.data ?? []} />
				</TabsContent>
			</Tabs>

			{/* 运行环境窗口详情 */}
			<WindowStatesCard
				profiles={profilesQuery.data ?? []}
				windowStates={windowStates}
				selectedProfileIds={selectedProfileIds}
				pendingProfileIds={pendingProfileIds}
				error={error}
				onSelectProfile={(profileId, checked) =>
					windowSyncStore.getState().toggleProfile(profileId, checked)
				}
				onViewProfile={handleViewProfile}
				onRunProfileAction={runProfileAction}
				onResolveValidatedActionUrl={resolveValidatedActionUrl}
				onOpenTab={windowActions.openTab}
				onCloseTab={windowActions.closeTab}
				onCloseInactiveTabs={windowActions.closeInactiveTabs}
				onActivateTab={windowActions.activateTab}
				onActivateTabByIndex={windowActions.activateTabByIndex}
				onOpenWindow={windowActions.openWindow}
				onCloseWindow={windowActions.closeWindow}
				onFocusWindow={windowActions.focusWindow}
				onSetWindowBounds={windowActions.setWindowBounds}
			/>
		</div>
	);
}
