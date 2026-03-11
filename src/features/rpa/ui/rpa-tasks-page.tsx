import { zodResolver } from '@hookform/resolvers/zod';
import { Edit, Play, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import { ConfirmActionDialog, DataSection, EmptyState, PageHeader } from '@/components/common';
import {
	Badge,
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
} from '@/components/ui';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useRpaFlowsQuery } from '@/entities/rpa/model/use-rpa-flows-query';
import { useRpaTasksQuery } from '@/entities/rpa/model/use-rpa-tasks-query';
import type { RpaTaskItem, SaveRpaTaskPayload } from '@/entities/rpa/model/types';
import { useRpaActions } from '@/features/rpa/model/use-rpa-actions';

const taskFormSchema = z
	.object({
		name: z.string().trim().min(1, '请输入任务名称'),
		flowId: z.string().trim().min(1, '请选择流程'),
		runType: z.enum(['manual', 'scheduled']),
		executionMode: z.enum(['serial', 'parallel']),
		concurrencyLimit: z.coerce.number().int().min(1).max(5),
		cronExpr: z.string().optional(),
		startAt: z.string().optional(),
		timezone: z.string().trim().min(1, '请输入时区'),
		runtimeInputText: z.string(),
		targetProfileIds: z.array(z.string()).min(1, '至少选择一个执行环境'),
	})
	.superRefine((value, ctx) => {
		if (value.runType === 'scheduled' && !(value.cronExpr || '').trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '计划任务必须填写 Cron 表达式',
				path: ['cronExpr'],
			});
		}
	});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function formatTs(ts?: number | null) {
	if (!ts) {
		return '暂无';
	}
	return new Intl.DateTimeFormat('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(ts * 1000));
}

function toDatetimeLocal(ts?: number | null) {
	if (!ts) {
		return '';
	}
	const date = new Date(ts * 1000);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseRuntimeInput(runtimeInputText: string): Record<string, unknown> {
	const parsed = JSON.parse(runtimeInputText || '{}') as unknown;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('运行时输入必须是 JSON 对象');
	}
	return parsed as Record<string, unknown>;
}

function buildFormDefaults(task: RpaTaskItem | null): TaskFormValues {
	if (!task) {
		return {
			name: '',
			flowId: '',
			runType: 'manual',
			executionMode: 'parallel',
			concurrencyLimit: 3,
			cronExpr: '',
			startAt: '',
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
			runtimeInputText: JSON.stringify({}, null, 2),
			targetProfileIds: [],
		};
	}
	return {
		name: task.name,
		flowId: task.flowId,
		runType: task.runType,
		executionMode: task.executionMode,
		concurrencyLimit: task.concurrencyLimit,
		cronExpr: task.cronExpr ?? '',
		startAt: toDatetimeLocal(task.startAt),
		timezone: task.timezone,
		runtimeInputText: JSON.stringify(task.runtimeInput ?? {}, null, 2),
		targetProfileIds: task.targetProfileIds,
	};
}

export function RpaTasksPage() {
	const actions = useRpaActions();
	const tasksQuery = useRpaTasksQuery(false);
	const flowsQuery = useRpaFlowsQuery(false);
	const profilesQuery = useProfilesQuery();
	const [formOpen, setFormOpen] = useState(false);
	const [editingTask, setEditingTask] = useState<RpaTaskItem | null>(null);
	const [pending, setPending] = useState(false);
	const [deleteTask, setDeleteTask] = useState<RpaTaskItem | null>(null);

	const profiles = useMemo(
		() => (profilesQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[profilesQuery.data],
	);
	const flows = useMemo(
		() => (flowsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[flowsQuery.data],
	);
	const tasks = useMemo(
		() => (tasksQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[tasksQuery.data],
	);

	const form = useForm<TaskFormValues>({
		resolver: zodResolver(taskFormSchema),
		defaultValues: buildFormDefaults(null),
	});
	const runType = form.watch('runType');
	const selectedProfileIds = form.watch('targetProfileIds');

	const openCreate = () => {
		setEditingTask(null);
		form.reset(buildFormDefaults(null));
		setFormOpen(true);
	};

	const openEdit = (task: RpaTaskItem) => {
		setEditingTask(task);
		form.reset(buildFormDefaults(task));
		setFormOpen(true);
	};

	const handleSubmit = form.handleSubmit(async (values) => {
		setPending(true);
		try {
			let runtimeInput: Record<string, unknown>;
			try {
				runtimeInput = parseRuntimeInput(values.runtimeInputText);
			} catch (error) {
				form.setError('runtimeInputText', {
					type: 'manual',
					message: error instanceof Error ? error.message : '运行时输入 JSON 无效',
				});
				return;
			}

			const payload: SaveRpaTaskPayload = {
				flowId: values.flowId,
				name: values.name,
				runType: values.runType,
				executionMode: values.executionMode,
				concurrencyLimit: values.executionMode === 'serial' ? 1 : values.concurrencyLimit,
				cronExpr: values.runType === 'scheduled' ? values.cronExpr?.trim() : undefined,
				startAt: values.startAt
					? (() => {
							const ts = Math.floor(new Date(values.startAt).getTime() / 1000);
							return Number.isFinite(ts) ? ts : null;
					  })()
					: null,
				timezone: values.timezone,
				targetProfileIds: values.targetProfileIds,
				runtimeInput,
			};
			if (editingTask) {
				await actions.updateTask(editingTask.id, payload);
			} else {
				await actions.createTask(payload);
			}
			setFormOpen(false);
		} finally {
			setPending(false);
		}
	});

	return (
		<div className="flex flex-col gap-3">
			<PageHeader
				label="rpa"
				title="任务管理"
				description="正式运行统一通过任务触发，支持普通与计划两种执行类型"
				actions={(
					<Button type="button" className="cursor-pointer" onClick={openCreate}>
						<Plus data-icon="inline-start" />
						新建任务
					</Button>
				)}
			/>

			<DataSection
				title="任务列表"
				description="支持启停、立即执行、编辑和删除"
				actions={<Badge variant="secondary">{tasks.length}</Badge>}
			>
				{tasks.length === 0 ? (
					<EmptyState
						title="还没有任务"
						description="先创建任务，再进行正式运行或计划调度。"
						actionLabel="新建任务"
						onAction={openCreate}
					/>
				) : (
					<div className="overflow-hidden rounded-xl border border-border/70">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/20 hover:bg-muted/20">
									<TableHead>任务</TableHead>
									<TableHead className="w-[260px]">执行策略</TableHead>
									<TableHead className="w-[180px]">下次触发</TableHead>
									<TableHead className="w-[180px]">最近运行</TableHead>
									<TableHead className="w-[240px] text-right">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tasks.map((task) => (
									<TableRow key={task.id}>
										<TableCell>
											<div className="flex items-center gap-2">
												<p className="font-medium">{task.name}</p>
												<Badge variant={task.enabled ? 'default' : 'secondary'}>
													{task.enabled ? 'enabled' : 'disabled'}
												</Badge>
											</div>
											<p className="mt-1 text-xs text-muted-foreground">流程：{task.flowName}</p>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											<div className="flex flex-wrap gap-2">
												<span>{task.runType === 'scheduled' ? '计划任务' : '普通任务'}</span>
												<span>{task.executionMode === 'serial' ? '串行' : `并发 ${task.concurrencyLimit}`}</span>
												<span>目标 {task.targetProfileIds.length}</span>
											</div>
											{task.runType === 'scheduled' ? (
												<p className="mt-1 truncate text-[11px]">Cron: {task.cronExpr || '-'}</p>
											) : null}
										</TableCell>
										<TableCell className="text-muted-foreground">{formatTs(task.nextRunAt)}</TableCell>
										<TableCell className="text-muted-foreground">{formatTs(task.lastRunAt)}</TableCell>
										<TableCell>
											<div className="flex justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="cursor-pointer"
													onClick={() => void actions.runTask(task.id)}
												>
													<Play data-icon="inline-start" />
													执行
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="cursor-pointer"
													onClick={() => openEdit(task)}
												>
													<Edit data-icon="inline-start" />
													编辑
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="cursor-pointer"
													onClick={() => void actions.toggleTaskEnabled(task.id, !task.enabled)}
												>
													{task.enabled ? <PowerOff data-icon="inline-start" /> : <Power data-icon="inline-start" />}
													{task.enabled ? '停用' : '启用'}
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="cursor-pointer"
													onClick={() => setDeleteTask(task)}
												>
													<Trash2 data-icon="inline-start" />
													删除
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</DataSection>

			<Dialog open={formOpen} onOpenChange={(open) => !pending && setFormOpen(open)}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
						<DialogDescription>正式运行与计划任务都在这里统一配置</DialogDescription>
					</DialogHeader>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="rpa-task-name">任务名称</Label>
								<Input id="rpa-task-name" className="cursor-pointer" {...form.register('name')} />
								{form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="rpa-task-flow">关联流程</Label>
								<Select
									value={form.watch('flowId')}
									onValueChange={(value) => form.setValue('flowId', value, { shouldValidate: true })}
								>
									<SelectTrigger id="rpa-task-flow" className="cursor-pointer">
										<SelectValue placeholder="选择流程" />
									</SelectTrigger>
									<SelectContent>
										{flows.map((flow) => (
											<SelectItem key={flow.id} value={flow.id} className="cursor-pointer">
												{flow.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{form.formState.errors.flowId ? <p className="text-xs text-destructive">{form.formState.errors.flowId.message}</p> : null}
							</div>
							<div className="space-y-2">
								<Label>执行类型</Label>
								<Select
									value={runType}
									onValueChange={(value) => form.setValue('runType', value as 'manual' | 'scheduled', { shouldValidate: true })}
								>
									<SelectTrigger className="cursor-pointer">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manual" className="cursor-pointer">普通任务</SelectItem>
										<SelectItem value="scheduled" className="cursor-pointer">计划任务</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>执行顺序</Label>
								<Select
									value={form.watch('executionMode')}
									onValueChange={(value) => form.setValue('executionMode', value as 'serial' | 'parallel', { shouldValidate: true })}
								>
									<SelectTrigger className="cursor-pointer">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="serial" className="cursor-pointer">串行</SelectItem>
										<SelectItem value="parallel" className="cursor-pointer">并行</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="rpa-task-concurrency">并发上限</Label>
								<Input
									id="rpa-task-concurrency"
									type="number"
									min={1}
									max={5}
									className="cursor-pointer"
									{...form.register('concurrencyLimit', { valueAsNumber: true })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="rpa-task-timezone">时区</Label>
								<Input id="rpa-task-timezone" className="cursor-pointer" {...form.register('timezone')} />
							</div>
						</div>

						{runType === 'scheduled' ? (
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="rpa-task-cron">Cron 表达式</Label>
									<Input id="rpa-task-cron" className="cursor-pointer" {...form.register('cronExpr')} />
									{form.formState.errors.cronExpr ? <p className="text-xs text-destructive">{form.formState.errors.cronExpr.message}</p> : null}
								</div>
								<div className="space-y-2">
									<Label htmlFor="rpa-task-start-at">开始时间</Label>
									<Input id="rpa-task-start-at" type="datetime-local" className="cursor-pointer" {...form.register('startAt')} />
								</div>
							</div>
						) : null}

						<div className="space-y-2">
							<Label>执行环境</Label>
							<div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
								{profiles.map((profile) => (
									<label
										key={profile.id}
										htmlFor={`task-profile-${profile.id}`}
										className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
									>
										<Checkbox
											id={`task-profile-${profile.id}`}
											checked={selectedProfileIds.includes(profile.id)}
											onCheckedChange={(checked) => {
												const current = form.getValues('targetProfileIds');
												form.setValue(
													'targetProfileIds',
													checked
														? [...new Set([...current, profile.id])]
														: current.filter((item) => item !== profile.id),
													{ shouldValidate: true },
												);
											}}
										/>
										<span>{profile.name}</span>
									</label>
								))}
							</div>
							{form.formState.errors.targetProfileIds ? (
								<p className="text-xs text-destructive">{form.formState.errors.targetProfileIds.message}</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="rpa-task-runtime-input">运行时输入 JSON</Label>
							<Textarea
								id="rpa-task-runtime-input"
								rows={6}
								className="font-mono text-xs"
								{...form.register('runtimeInputText')}
							/>
							{form.formState.errors.runtimeInputText ? (
								<p className="text-xs text-destructive">{form.formState.errors.runtimeInputText.message}</p>
							) : null}
						</div>

						<DialogFooter>
							<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending} onClick={() => setFormOpen(false)}>
								取消
							</Button>
							<Button type="submit" className="cursor-pointer" disabled={pending}>
								{editingTask ? '保存任务' : '创建任务'}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<ConfirmActionDialog
				open={Boolean(deleteTask)}
				title="删除任务"
				description={`确认删除任务「${deleteTask?.name ?? ''}」？历史运行记录会保留。`}
				confirmText="删除"
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTask(null);
					}
				}}
				onConfirm={() => {
					if (!deleteTask) {
						return;
					}
					void actions.deleteTask(deleteTask.id).finally(() => {
						setDeleteTask(null);
					});
				}}
			/>
		</div>
	);
}
