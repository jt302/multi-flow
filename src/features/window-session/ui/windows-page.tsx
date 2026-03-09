import { zodResolver } from '@hookform/resolvers/zod';
import {
	Eye,
	Focus,
	LayoutPanelTop,
	Plus,
	RefreshCw,
	Rows3,
	SquareStack,
	X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

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
} from '@/components/ui';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { NAV_SECTIONS } from '@/features/console/constants';
import type { ProfileWindowItem, WindowBoundsItem } from '@/entities/window-session/model/types';
import type { WindowsPageProps } from '@/features/window-session/model/page-types';

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

const windowBoundsFormSchema = z.object({
	x: z.coerce.number().int('X 必须是整数'),
	y: z.coerce.number().int('Y 必须是整数'),
	width: z.coerce.number().int('宽度必须是整数').min(1, '宽度必须大于 0'),
	height: z.coerce.number().int('高度必须是整数').min(1, '高度必须大于 0'),
});

type BatchActionFormValues = z.infer<typeof batchActionFormSchema>;
type WindowBoundsFormValues = z.infer<typeof windowBoundsFormSchema>;

type WindowBoundsFormProps = {
	window: ProfileWindowItem;
	controllable: boolean;
	onApply: (windowId: number, bounds: WindowBoundsItem) => Promise<void>;
};

function normalizeActionUrl(value: string) {
	const trimmed = value.trim();
	const parsed = new URL(trimmed);
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('URL 必须以 http:// 或 https:// 开头');
	}
	return parsed.toString();
}

function WindowBoundsForm({ window, controllable, onApply }: WindowBoundsFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<WindowBoundsFormValues>({
		resolver: zodResolver(windowBoundsFormSchema),
		defaultValues: {
			x: window.bounds?.x ?? 0,
			y: window.bounds?.y ?? 0,
			width: window.bounds?.width ?? 1300,
			height: window.bounds?.height ?? 800,
		},
	});

	useEffect(() => {
		reset({
			x: window.bounds?.x ?? 0,
			y: window.bounds?.y ?? 0,
			width: window.bounds?.width ?? 1300,
			height: window.bounds?.height ?? 800,
		});
	}, [window.bounds?.height, window.bounds?.width, window.bounds?.x, window.bounds?.y, reset]);

	return (
		<form
			className="mb-2 grid gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
			onSubmit={handleSubmit(async (values) => {
				await onApply(window.windowId, {
					x: values.x,
					y: values.y,
					width: values.width,
					height: values.height,
				});
			})}
		>
			<Input
				{...register('x')}
				inputMode="numeric"
				placeholder="X"
				className="h-8 text-xs"
			/>
			<Input
				{...register('y')}
				inputMode="numeric"
				placeholder="Y"
				className="h-8 text-xs"
			/>
			<Input
				{...register('width')}
				inputMode="numeric"
				placeholder="宽度"
				className="h-8 text-xs"
			/>
			<Input
				{...register('height')}
				inputMode="numeric"
				placeholder="高度"
				className="h-8 text-xs"
			/>
			<Button
				type="submit"
				size="sm"
				variant="outline"
				className="cursor-pointer"
				disabled={!controllable}
			>
				应用窗口尺寸
			</Button>
			{errors.x || errors.y || errors.width || errors.height ? (
				<p className="text-xs text-destructive md:col-span-5">
					{errors.x?.message ?? errors.y?.message ?? errors.width?.message ?? errors.height?.message}
				</p>
			) : null}
		</form>
	);
}

export function WindowsPage({
	profiles,
	windowStates,
	onRefreshWindows,
	onViewProfile,
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
	const section = NAV_SECTIONS.windows;
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [pendingProfileIds, setPendingProfileIds] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);

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

	const profileNameMap = useMemo(() => {
		return profiles.reduce<Record<string, string>>((acc, item) => {
			acc[item.id] = item.name;
			return acc;
		}, {});
	}, [profiles]);

	const profileRunningMap = useMemo(() => {
		return profiles.reduce<Record<string, boolean>>((acc, item) => {
			acc[item.id] = item.running && item.lifecycle === 'active';
			return acc;
		}, {});
	}, [profiles]);

	const runningProfileIds = useMemo(() => {
		return profiles
			.filter((item) => item.lifecycle === 'active' && item.running)
			.map((item) => item.id);
	}, [profiles]);

	const selectedRunningIds = useMemo(() => {
		const runningSet = new Set(runningProfileIds);
		return selectedProfileIds.filter((id) => runningSet.has(id));
	}, [selectedProfileIds, runningProfileIds]);

	const runningWithoutWindows = useMemo(() => {
		const windowProfileIds = new Set(windowStates.map((item) => item.profileId));
		return profiles.filter(
			(item) =>
				item.lifecycle === 'active' &&
				item.running &&
				!windowProfileIds.has(item.id),
		);
	}, [profiles, windowStates]);

	const handleSelectProfile = (profileId: string, checked: boolean) => {
		setSelectedProfileIds((prev) => {
			if (checked) {
				if (prev.includes(profileId)) {
					return prev;
				}
				return [...prev, profileId];
			}
			return prev.filter((id) => id !== profileId);
		});
	};

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : '窗口操作失败');
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

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="窗口" title={section.title} description={section.desc} />

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">批量操作</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 px-1 pt-0">
					<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(5,auto)]">
						<div>
							<Input
								{...register('targetUrl')}
								placeholder={DEFAULT_URL}
							/>
							{errors.targetUrl ? (
								<p className="mt-1 text-xs text-destructive">{errors.targetUrl.message}</p>
							) : null}
						</div>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() =>
								runAction(async () => {
									const url = await resolveValidatedActionUrl();
									await onBatchOpenTabs(selectedRunningIds, url);
								})
							}
							disabled={selectedRunningIds.length === 0}
						>
							<Icon icon={Rows3} size={14} />
							批量新标签
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() =>
								runAction(async () => {
									const url = await resolveValidatedActionUrl();
									await onBatchOpenWindows(selectedRunningIds, url);
								})
							}
							disabled={selectedRunningIds.length === 0}
						>
							<Icon icon={SquareStack} size={14} />
							批量新窗口
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => runAction(async () => onBatchCloseTabs(selectedRunningIds))}
							disabled={selectedRunningIds.length === 0}
						>
							<Icon icon={X} size={14} />
							批量关当前标签
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => runAction(async () => onBatchCloseInactiveTabs(selectedRunningIds))}
							disabled={selectedRunningIds.length === 0}
						>
							<Icon icon={X} size={14} />
							批量关后台标签
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => runAction(async () => onBatchFocusWindows(selectedRunningIds))}
							disabled={selectedRunningIds.length === 0}
						>
							<Icon icon={Focus} size={14} />
							批量聚焦
						</Button>
					</div>
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<p>已选择 {selectedRunningIds.length} / {runningProfileIds.length} 个运行中环境</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer"
							onClick={() => {
								void runAction(onRefreshWindows);
							}}
						>
							<Icon icon={RefreshCw} size={12} />
							刷新窗口状态
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<CardTitle className="text-sm">运行环境窗口</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					{windowStates.length === 0 ? (
						<div className="rounded-xl border border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
							当前没有运行中的环境窗口
						</div>
					) : (
						windowStates.map((state) => {
							const profileLabel = profileNameMap[state.profileId] ?? state.profileId;
							const selected = selectedProfileIds.includes(state.profileId);
							const isRunning = profileRunningMap[state.profileId] ?? true;
							const profileBusy = pendingProfileIds.has(state.profileId);
							const hasWindowSnapshot = state.totalWindows > 0;
							const controllable = isRunning && hasWindowSnapshot && !profileBusy;
							return (
								<div key={state.profileId} className="rounded-xl border border-border/70 p-3">
									<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<Checkbox
												checked={selected}
												onCheckedChange={(checked) =>
													handleSelectProfile(state.profileId, checked === true)
												}
											/>
											<p className="text-sm font-semibold">{profileLabel}</p>
											<Badge variant="outline">{state.totalWindows} 窗口</Badge>
											<Badge variant="secondary">{state.totalTabs} 标签</Badge>
											<Badge variant={isRunning ? 'default' : 'secondary'}>
												{isRunning ? (profileBusy ? '操作中' : '运行中') : '已停止'}
											</Badge>
											{isRunning && !hasWindowSnapshot ? (
												<Badge variant="outline">窗口状态同步中</Badge>
											) : null}
											{state.pid ? <Badge variant="secondary">PID {state.pid}</Badge> : null}
										</div>
										<div className="flex items-center gap-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() => onViewProfile(state.profileId)}
											>
												<Icon icon={Eye} size={12} />
												环境详情
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() =>
													runProfileAction(state.profileId, async () => {
														const url = await resolveValidatedActionUrl();
														await onOpenTab(state.profileId, url);
													})
												}
												disabled={!controllable}
											>
												<Icon icon={Plus} size={12} />
												新标签
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() =>
													runProfileAction(state.profileId, async () => {
														const url = await resolveValidatedActionUrl();
														await onOpenWindow(state.profileId, url);
													})
												}
												disabled={!controllable}
											>
												<Icon icon={LayoutPanelTop} size={12} />
												新窗口
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() => runProfileAction(state.profileId, async () => onCloseTab(state.profileId))}
												disabled={!controllable}
											>
												<Icon icon={X} size={12} />
												关当前标签
											</Button>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="cursor-pointer"
												onClick={() => runProfileAction(state.profileId, async () => onCloseInactiveTabs(state.profileId))}
												disabled={!controllable}
											>
												<Icon icon={X} size={12} />
												关后台标签
											</Button>
										</div>
									</div>

									<div className="space-y-2">
										{state.windows.map((window) => (
											<div key={`${state.profileId}-${window.windowId}`} className="rounded-lg border border-border/60 p-2">
												<div className="mb-1 flex items-center justify-between">
													<div className="flex items-center gap-2 text-xs">
														<Badge variant={window.focused ? 'default' : 'secondary'}>
															窗口 #{window.windowId}
														</Badge>
														<Badge variant="outline">{window.tabCount} 标签</Badge>
													</div>
													<div className="flex items-center gap-1">
														<Button
															type="button"
															size="icon"
															variant="ghost"
															className="h-7 w-7 cursor-pointer"
															onClick={() => runProfileAction(state.profileId, async () => onFocusWindow(state.profileId, window.windowId))}
															disabled={!controllable}
														>
															<Icon icon={Focus} size={12} />
														</Button>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															className="h-7 w-7 cursor-pointer"
															onClick={() => runProfileAction(state.profileId, async () => onCloseWindow(state.profileId, window.windowId))}
															disabled={!controllable}
														>
															<Icon icon={X} size={12} />
														</Button>
													</div>
												</div>

										<WindowBoundsForm
											window={window}
											controllable={controllable}
													onApply={(windowId, bounds) =>
														runProfileAction(state.profileId, async () =>
															onSetWindowBounds(state.profileId, bounds, windowId),
														)
													}
												/>

												<div className="space-y-1">
													{window.tabs.map((tab) => (
														<div
															key={`${state.profileId}-${window.windowId}-${tab.tabId}`}
															className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1"
														>
															<div className="min-w-0">
																<div className="flex items-center gap-2">
																	{tab.active ? (
																		<Badge variant="default">当前</Badge>
																	) : (
																		<Badge variant="secondary">后台</Badge>
																	)}
																	<p className="truncate text-xs font-medium">{tab.title}</p>
																</div>
																<p className="truncate text-[11px] text-muted-foreground">
																	{tab.url}
																</p>
															</div>
															<div className="flex items-center gap-1">
																<Button
																	type="button"
																	size="icon"
																	variant="ghost"
																	className="h-7 w-7 cursor-pointer"
																	onClick={() => runProfileAction(state.profileId, async () => onActivateTab(state.profileId, tab.tabId))}
																	disabled={!controllable}
																>
																	<Icon icon={Focus} size={12} />
																</Button>
																<Button
																	type="button"
																	size="icon"
																	variant="ghost"
																	className="h-7 w-7 cursor-pointer"
																	onClick={() => runProfileAction(state.profileId, async () => onCloseTab(state.profileId, tab.tabId))}
																	disabled={!controllable}
																>
																	<Icon icon={X} size={12} />
																</Button>
															</div>
														</div>
													))}
												</div>
												<div className="mt-2 flex justify-end">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														className="cursor-pointer"
														onClick={() => runProfileAction(state.profileId, async () => onActivateTabByIndex(state.profileId, 0, window.windowId))}
														disabled={!controllable}
													>
														<Icon icon={Focus} size={12} />
														按索引激活第 1 个标签
													</Button>
												</div>
											</div>
										))}
									</div>
								</div>
							);
						})
					)}
					{runningWithoutWindows.length > 0 ? (
						<div className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
							以下环境处于运行中，但窗口信息尚未同步：
							{runningWithoutWindows.map((item) => ` ${item.name}(${item.id})`).join('、')}
						</div>
					) : null}
					{error ? (
						<p className="text-xs text-destructive">{error}</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
