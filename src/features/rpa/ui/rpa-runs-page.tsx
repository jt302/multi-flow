import { CalendarRange, Filter, Play, Square } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DataSection, EmptyState, PageHeader } from '@/components/common';
import {
	Badge,
	Button,
	Card,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import { useRpaRunDetailsQuery } from '@/entities/rpa/model/use-rpa-run-details-query';
import { useRpaRunsQuery } from '@/entities/rpa/model/use-rpa-runs-query';
import { useRpaRunStepsQuery } from '@/entities/rpa/model/use-rpa-run-steps-query';
import { useRpaTasksQuery } from '@/entities/rpa/model/use-rpa-tasks-query';
import type { ListRpaRunsFilters, RpaRunStatus } from '@/entities/rpa/model/types';
import { useRpaActions } from '@/features/rpa/model/use-rpa-actions';

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

function toUnixTs(input: string) {
	if (!input.trim()) {
		return undefined;
	}
	const parsed = Math.floor(new Date(input).getTime() / 1000);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function formatStatus(status: string) {
	return status.split('_').join(' ');
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
	if (status === 'success') {
		return 'default';
	}
	if (status === 'failed' || status === 'cancelled') {
		return 'destructive';
	}
	return 'secondary';
}

export function RpaRunsPage() {
	const actions = useRpaActions();
	const tasksQuery = useRpaTasksQuery(false);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
	const [taskIdFilter, setTaskIdFilter] = useState<string>('all');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [sourceFilter, setSourceFilter] = useState<string>('all');
	const [createdFrom, setCreatedFrom] = useState('');
	const [createdTo, setCreatedTo] = useState('');

	const filters: ListRpaRunsFilters = useMemo(
		() => ({
			limit: 100,
			taskId: taskIdFilter === 'all' ? undefined : taskIdFilter,
			status: statusFilter === 'all' ? undefined : (statusFilter as RpaRunStatus),
			triggerSource: sourceFilter === 'all' ? undefined : sourceFilter,
			createdFrom: toUnixTs(createdFrom),
			createdTo: toUnixTs(createdTo),
		}),
		[createdFrom, createdTo, sourceFilter, statusFilter, taskIdFilter],
	);

	const runsQuery = useRpaRunsQuery(filters);
	const runDetailsQuery = useRpaRunDetailsQuery(selectedRunId);
	const runStepsQuery = useRpaRunStepsQuery(selectedInstanceId);
	const runs = runsQuery.data ?? [];
	const tasks = (tasksQuery.data ?? []).filter((item) => item.lifecycle === 'active');
	const selectedRun = runDetailsQuery.data?.run ?? runs.find((item) => item.id === selectedRunId) ?? null;
	const selectedInstance =
		runDetailsQuery.data?.instances.find((item) => item.id === selectedInstanceId) ?? null;

	return (
		<div className="flex flex-col gap-3">
			<PageHeader
				label="rpa"
				title="运行记录"
				description="查看任务执行详情、步骤日志和调试产物"
			/>

			<DataSection
				title="筛选条件"
				description="按任务 / 状态 / 来源 / 时间范围过滤运行记录"
				actions={
					<Badge variant="secondary" className="gap-1">
						<Filter className="h-3.5 w-3.5" />
						{runs.length}
					</Badge>
				}
			>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">任务</p>
						<Select value={taskIdFilter} onValueChange={setTaskIdFilter}>
							<SelectTrigger className="cursor-pointer">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="cursor-pointer">全部任务</SelectItem>
								{tasks.map((task) => (
									<SelectItem key={task.id} value={task.id} className="cursor-pointer">
										{task.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">状态</p>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="cursor-pointer">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="cursor-pointer">全部状态</SelectItem>
								<SelectItem value="queued" className="cursor-pointer">queued</SelectItem>
								<SelectItem value="running" className="cursor-pointer">running</SelectItem>
								<SelectItem value="partial_success" className="cursor-pointer">partial_success</SelectItem>
								<SelectItem value="success" className="cursor-pointer">success</SelectItem>
								<SelectItem value="failed" className="cursor-pointer">failed</SelectItem>
								<SelectItem value="cancelled" className="cursor-pointer">cancelled</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">来源</p>
						<Select value={sourceFilter} onValueChange={setSourceFilter}>
							<SelectTrigger className="cursor-pointer">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="cursor-pointer">全部来源</SelectItem>
								<SelectItem value="task_manual" className="cursor-pointer">task_manual</SelectItem>
								<SelectItem value="task_schedule" className="cursor-pointer">task_schedule</SelectItem>
								<SelectItem value="debug_manual" className="cursor-pointer">debug_manual</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">开始时间</p>
						<Input type="datetime-local" className="cursor-pointer" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
					</div>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">结束时间</p>
						<Input type="datetime-local" className="cursor-pointer" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
					</div>
				</div>
			</DataSection>

			{runs.length === 0 ? (
				<EmptyState
					title="没有匹配的运行记录"
					description="调整筛选条件，或者先在任务管理里触发一次执行。"
					actionLabel="清空筛选"
					onAction={() => {
						setTaskIdFilter('all');
						setStatusFilter('all');
						setSourceFilter('all');
						setCreatedFrom('');
						setCreatedTo('');
					}}
				/>
			) : (
				<Card className="border-border/60 bg-card/88 p-4">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-sm font-semibold">运行明细</h2>
							<p className="text-xs text-muted-foreground">任务 / 实例 / 步骤日志与调试产物</p>
						</div>
						{selectedRun ? (
							<Button
								variant="outline"
								className="cursor-pointer gap-2"
								onClick={() => void actions.cancelRun(selectedRun.id)}
							>
								<Square className="h-4 w-4" />
								取消任务
							</Button>
						) : null}
					</div>

					<div className="grid gap-4 xl:grid-cols-[300px_300px_minmax(0,1fr)]">
						<div className="space-y-2">
							{runs.map((run) => (
								<Button
									key={run.id}
									type="button"
									variant="outline"
									className={`h-auto w-full justify-start rounded-xl border px-3 py-3 text-left ${
										selectedRun?.id === run.id
											? 'border-primary bg-primary/10'
											: 'border-border/60 hover:border-primary/40'
									}`}
									onClick={() => {
										setSelectedRunId(run.id);
										setSelectedInstanceId(null);
									}}
								>
									<div className="flex w-full items-center justify-between gap-2">
										<p className="truncate text-sm font-medium">{run.taskName || run.flowName}</p>
										<Badge variant={statusVariant(run.status)}>{formatStatus(run.status)}</Badge>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">来源 {run.triggerSource}</p>
									<p className="text-xs text-muted-foreground">创建于 {formatTs(run.createdAt)}</p>
								</Button>
							))}
						</div>

						<div className="space-y-2">
							{runDetailsQuery.data?.instances.map((instance) => (
								<div
									key={instance.id}
									className={`rounded-xl border px-3 py-3 ${
										selectedInstance?.id === instance.id
											? 'border-primary bg-primary/10'
											: 'border-border/60'
									}`}
								>
									<Button
										type="button"
										variant="ghost"
										className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
										onClick={() => setSelectedInstanceId(instance.id)}
									>
										<div className="flex w-full items-center justify-between">
											<p className="text-sm font-medium">{instance.profileId}</p>
											<Badge variant={statusVariant(instance.status)}>{formatStatus(instance.status)}</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">当前节点：{instance.currentNodeId ?? '已完成'}</p>
									</Button>
									<div className="mt-3 flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="flex-1 cursor-pointer"
											onClick={() => void actions.cancelInstance(instance.id)}
										>
											取消
										</Button>
										{instance.status === 'needs_manual' ? (
											<Button
												size="sm"
												className="flex-1 cursor-pointer"
												onClick={() => void actions.resumeInstance(instance.id)}
											>
												<Play data-icon="inline-start" />继续
											</Button>
										) : null}
									</div>
								</div>
							))}
						</div>

						<div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
							{selectedInstance ? (
								<>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="rounded-xl border border-border/60 p-3">
											<p className="text-xs text-muted-foreground">上下文</p>
											<pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(selectedInstance.context, null, 2)}</pre>
										</div>
										<div className="rounded-xl border border-border/60 p-3">
											<p className="text-xs text-muted-foreground">调试产物</p>
											<pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(selectedInstance.artifactIndex, null, 2)}</pre>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<CalendarRange className="h-3.5 w-3.5" />
											步骤日志
										</div>
										{runStepsQuery.data?.map((step) => (
											<div key={step.id} className="rounded-xl border border-border/60 p-3">
												<div className="flex items-center justify-between gap-3">
													<div>
														<p className="text-sm font-medium">{step.nodeKind} · {step.nodeId}</p>
														<p className="text-xs text-muted-foreground">尝试 {step.attempt}</p>
													</div>
													<Badge variant={statusVariant(step.status)}>{formatStatus(step.status)}</Badge>
												</div>
												<div className="mt-3 grid gap-3 md:grid-cols-2">
													<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">{JSON.stringify(step.inputSnapshot, null, 2)}</pre>
													<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">{JSON.stringify(step.outputSnapshot, null, 2)}</pre>
												</div>
											</div>
										))}
									</div>
								</>
							) : (
								<div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
									先从左侧选择一条任务执行记录，再查看实例和步骤详情。
								</div>
							)}
						</div>
					</div>
				</Card>
			)}
		</div>
	);
}
