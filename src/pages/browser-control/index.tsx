/**
 * 浏览器控制页面 — 窗口管理、标签页管理、文本输入
 * 从窗口同步页面拆分而来，独立为主导航入口
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod/v3';
import { AppWindow, LayoutList, Monitor, Send, Type } from 'lucide-react';

import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useDisplayMonitorsQuery } from '@/entities/window-session/model/use-display-monitors-query';
import { useSyncTargetsQuery } from '@/entities/window-session/model/use-sync-targets-query';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';
import { useWindowSyncActions } from '@/features/window-session/model/use-window-sync-actions';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import { WindowBatchActionsCard } from '@/features/window-session/ui/window-batch-actions-card';
import { useWindowSyncStore } from '@/store/window-sync-store';
import { useSyncManagerStore } from '@/store/sync-manager-store';
import {
	arrangeWindowsFormSchema,
	syncTextFormSchema,
	windowBoundsBatchFormSchema,
} from '@/features/window-session/model/window-sync-forms';
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

const section = WORKSPACE_SECTIONS['browser-control'];

const batchActionFormSchema = z.object({
	targetUrl: z.string().trim().min(1, '请输入 URL').superRefine((value, ctx) => {
		try {
			const parsed = new URL(value);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL 必须以 http:// 或 https:// 开头' });
			}
		} catch {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入合法 URL' });
		}
	}),
});

type ArrangeWindowsFormValues = z.infer<typeof arrangeWindowsFormSchema>;

export function BrowserControlRoutePage() {
	const profilesQuery = useProfilesQuery();
	const localTargetsQuery = useSyncTargetsQuery();
	const displayMonitorsQuery = useDisplayMonitorsQuery();
	const localTargets = localTargetsQuery.data?.items ?? [];
	const displayMonitors = displayMonitorsQuery.data ?? [];
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const { refreshWindows, refreshWindowsStable, refreshProfilesAndBindings } = useWorkspaceRefresh();
	const sessionPayload = useSyncManagerStore((s) => s.sessionPayload);
	const syncLocalTargets = useSyncManagerStore((s) => s.syncLocalTargets);
	const selectedProfileIds = useWindowSyncStore((s) => s.selectedProfileIds);
	const arrangeMode = useWindowSyncStore((s) => s.arrangeMode);
	const arrangeGap = useWindowSyncStore((s) => s.arrangeGap);
	const setArrangeMode = useWindowSyncStore((s) => s.setArrangeMode);
	const setGap = useWindowSyncStore((s) => s.setGap);

	const activeSyncSession = sessionPayload?.session ?? null;

	const withWindowActionLock = useCallback(async (profileId: string, action: () => Promise<void>) => {
		if (windowActionLocksRef.current.has(profileId)) return;
		windowActionLocksRef.current.add(profileId);
		try { await action(); } finally { windowActionLocksRef.current.delete(profileId); }
	}, []);

	const windowActions = useWindowActions({ withWindowActionLock, refreshWindowsStable, refreshProfilesAndBindings });
	const syncActions = useWindowSyncActions({ refreshWindowsStable, refreshProfilesAndBindings });

	const runningProfileIds = useMemo(() => {
		const profilesData = profilesQuery.data ?? [];
		return profilesData.filter((p) => p.lifecycle === 'active' && p.running).map((p) => p.id);
	}, [profilesQuery.data]);
	const selectedRunningIds = useMemo(() => {
		const runningSet = new Set(runningProfileIds);
		return selectedProfileIds.filter((id) => runningSet.has(id));
	}, [runningProfileIds, selectedProfileIds]);

	const [error, setError] = useState<string | null>(null);

	const runAction = useCallback(async (action: () => Promise<void>) => {
		setError(null);
		try { await action(); } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
	}, []);

	// Forms
	const { register, formState: { errors }, trigger, getValues } = useForm({ resolver: zodResolver(batchActionFormSchema), defaultValues: { targetUrl: 'https://www.browserscan.net/' } });
	const windowBoundsForm = useForm({ resolver: zodResolver(windowBoundsBatchFormSchema), defaultValues: { width: 1280, height: 800 } });
	const arrangeForm = useForm<ArrangeWindowsFormValues>({
		resolver: zodResolver(arrangeWindowsFormSchema),
		defaultValues: { monitorId: displayMonitors[0]?.id ?? '', mode: arrangeMode, gap: arrangeGap, width: 1280, height: 800 },
	});
	const syncTextForm = useForm({ resolver: zodResolver(syncTextFormSchema), defaultValues: { text: '' } });

	const resolveValidatedActionUrl = useCallback(async () => {
		const ok = await trigger('targetUrl');
		if (!ok) throw new Error('URL 验证失败');
		const raw = getValues('targetUrl').trim();
		return new URL(raw).toString();
	}, [trigger, getValues]);

	const refreshSyncAwareWindows = useCallback(async () => {
		await refreshWindows();
		await syncLocalTargets(localTargets);
	}, [localTargets, refreshWindows, syncLocalTargets]);

	return (
		<div className="flex h-full min-h-0 w-full flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
			<ActiveSectionCard label="浏览器控制" title={section.title} description={section.desc} />

			{error && (
				<div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			)}

			<Tabs defaultValue="window" className="flex-1 min-h-0">
				<TabsList className="h-9 bg-muted/40">
					<TabsTrigger value="window" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<AppWindow className="h-3 w-3" />
						窗口管理
					</TabsTrigger>
					<TabsTrigger value="tab" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<LayoutList className="h-3 w-3" />
						标签页管理
					</TabsTrigger>
					<TabsTrigger value="text" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<Type className="h-3 w-3" />
						文本输入
					</TabsTrigger>
				</TabsList>

				{/* 窗口管理 */}
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
										void runAction(() => syncActions.applyUniformBounds(selectedRunningIds, { x: 0, y: 0, width: values.width, height: values.height }))
									)}
								>
									<div className="min-w-0 space-y-1">
										<Label>宽度</Label>
										<Input type="number" {...windowBoundsForm.register('width')} />
									</div>
									<div className="min-w-0 space-y-1">
										<Label>高度</Label>
										<Input type="number" {...windowBoundsForm.register('height')} />
									</div>
									<div className="md:col-span-2 flex flex-wrap gap-2">
										<Button type="submit" className="cursor-pointer" disabled={selectedRunningIds.length === 0}>
											统一大小
										</Button>
										<Button type="button" variant="outline" className="cursor-pointer"
											onClick={() => void runAction(() => syncActions.restoreWindows(selectedRunningIds))}
											disabled={selectedRunningIds.length === 0}
										>
											<Icon icon={Monitor} size={14} /> 显示窗口
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
										void runAction(() => syncActions.arrangeWindows({
											profileIds: selectedRunningIds,
											monitorId: values.monitorId,
											mode: values.mode,
											gap: values.gap,
											width: values.width,
											height: values.height,
										}))
									)}
								>
									<div className="min-w-0 space-y-1 md:col-span-2">
										<Label>显示器</Label>
										<Controller control={arrangeForm.control} name="monitorId"
											render={({ field }) => (
												<Select value={field.value} onValueChange={field.onChange}>
													<SelectTrigger className="cursor-pointer w-full"><SelectValue placeholder="请选择显示器" /></SelectTrigger>
													<SelectContent>
														{displayMonitors.map((m) => (
															<SelectItem key={m.id} value={m.id}>{m.name}{m.isPrimary ? ' (主显示器)' : ''}</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
									</div>
									<div className="min-w-0 space-y-1">
										<Label>排列方式</Label>
										<Controller control={arrangeForm.control} name="mode"
											render={({ field }) => (
												<Select value={field.value} onValueChange={(v) => { field.onChange(v); setArrangeMode(v as 'grid' | 'cascade'); }}>
													<SelectTrigger className="cursor-pointer w-full"><SelectValue /></SelectTrigger>
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
										<Input type="number" {...arrangeForm.register('gap', { onChange: (e) => setGap(Number(e.target.value || 0)) })} />
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

				{/* 标签页管理 */}
				<TabsContent value="tab" className="mt-3">
					<WindowBatchActionsCard
						register={register}
						errors={errors}
						selectedRunningIds={selectedRunningIds}
						runningProfileIds={runningProfileIds}
						onBatchOpenTabs={() => void runAction(async () => { const url = await resolveValidatedActionUrl(); await windowActions.batchOpenTabs(selectedRunningIds, url); })}
						onBatchOpenWindows={() => void runAction(async () => { const url = await resolveValidatedActionUrl(); await windowActions.batchOpenWindows(selectedRunningIds, url); })}
						onBatchCloseTabs={() => void runAction(() => windowActions.batchCloseTabs(selectedRunningIds))}
						onBatchCloseInactiveTabs={() => void runAction(() => windowActions.batchCloseInactiveTabs(selectedRunningIds))}
						onBatchFocusWindows={() => void runAction(() => windowActions.batchFocusWindows(selectedRunningIds))}
						onRefreshWindows={() => void runAction(refreshSyncAwareWindows)}
					/>
				</TabsContent>

				{/* 文本输入 */}
				<TabsContent value="text" className="mt-3">
					<Card className="border border-border/60 shadow-none">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">文本输入广播</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<form className="space-y-3"
								onSubmit={syncTextForm.handleSubmit((values) => void runAction(() => syncActions.sendSyncText(values.text)))}
							>
								<div className="space-y-1">
									<Label>发送到所有从控当前焦点输入框</Label>
									<Textarea rows={5} placeholder="输入要同步的文本" {...syncTextForm.register('text')} />
									{syncTextForm.formState.errors.text && (
										<p className="text-xs text-destructive">{syncTextForm.formState.errors.text.message}</p>
									)}
								</div>
								<Button type="submit" className="cursor-pointer" disabled={!activeSyncSession}>
									<Icon icon={Send} size={14} /> 广播文本
								</Button>
							</form>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
