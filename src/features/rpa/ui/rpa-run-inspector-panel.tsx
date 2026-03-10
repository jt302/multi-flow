import { Play, Square, Workflow } from 'lucide-react';

import { Badge, Button, Card, Checkbox, Input, Textarea } from '@/components/ui';
import type { RpaFlowEditorModel } from '@/features/rpa/model/use-rpa-flow-editor';

type RpaRunInspectorPanelProps = {
	editor: RpaFlowEditorModel;
};

export function RpaRunInspectorPanel({ editor }: RpaRunInspectorPanelProps) {
	return (
		<div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
			<Card className="space-y-4 border-border/60 bg-card/88 p-4">
				<div className="flex items-center gap-2">
					<Play className="h-4 w-4 text-primary" />
					<div>
						<h2 className="text-sm font-semibold">运行面板</h2>
						<p className="text-xs text-muted-foreground">选择分组或 Profile，手动启动当前流程。</p>
					</div>
				</div>
				<form className="space-y-4" onSubmit={editor.handleRunFlow}>
					<div className="space-y-2">
						<div className="text-xs font-medium text-muted-foreground">目标分组</div>
						<div className="rounded-xl border border-border/60 p-2">
							{editor.groups.map((group) => {
								const memberIds = editor.profiles
									.filter((profile) => profile.group === group.name)
									.map((profile) => profile.id);
								const checked =
									memberIds.length > 0 &&
									memberIds.every((id) => editor.runTargetProfileIds.includes(id));
								return (
									<label
										htmlFor={`rpa-group-target-${group.id}`}
										key={group.id}
										className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
									>
										<Checkbox
											id={`rpa-group-target-${group.id}`}
											checked={checked}
											onCheckedChange={(nextChecked) =>
												editor.setRunTargetProfileIds((current) =>
													nextChecked
														? [...new Set([...current, ...memberIds])]
														: current.filter((item) => !memberIds.includes(item)),
												)
											}
										/>
										<span>{group.name}</span>
									</label>
								);
							})}
						</div>
					</div>
					<div className="space-y-2">
						<div className="text-xs font-medium text-muted-foreground">目标 Profile</div>
						<div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
							{editor.profiles.map((profile) => (
								<label
									htmlFor={`rpa-run-target-${profile.id}`}
									key={profile.id}
									className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
								>
									<Checkbox
										id={`rpa-run-target-${profile.id}`}
										checked={editor.runTargetProfileIds.includes(profile.id)}
										onCheckedChange={(checked) =>
											editor.setRunTargetProfileIds((current) =>
												checked
													? [...new Set([...current, profile.id])]
													: current.filter((item) => item !== profile.id),
											)
										}
									/>
									<span>{profile.name}</span>
								</label>
							))}
						</div>
					</div>
					<div className="space-y-2">
						<label htmlFor="rpa-run-concurrency" className="text-xs font-medium text-muted-foreground">
							运行并发
						</label>
						<Input
							id="rpa-run-concurrency"
							type="number"
							min={1}
							max={5}
							{...editor.runForm.register('concurrencyLimit', { valueAsNumber: true })}
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="rpa-runtime-input" className="text-xs font-medium text-muted-foreground">
							运行时输入 JSON
						</label>
						<Textarea id="rpa-runtime-input" rows={6} {...editor.runForm.register('runtimeInputText')} />
					</div>
					<Button
						type="submit"
						className="w-full cursor-pointer gap-2"
						disabled={!editor.selectedFlow || editor.selectedFlow.lifecycle !== 'active'}
					>
						<Workflow className="h-4 w-4" />
						启动任务
					</Button>
				</form>
			</Card>

			<Card className="border-border/60 bg-card/88 p-4">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="text-sm font-semibold">任务中心</h2>
						<p className="text-xs text-muted-foreground">任务列表 / 实例状态 / 步骤与调试产物</p>
					</div>
					{editor.selectedRun ? (
						<Button
							variant="outline"
							className="cursor-pointer gap-2"
							onClick={() => {
								if (!editor.selectedRun) {
									return;
								}
								void editor.actions.cancelRun(editor.selectedRun.id);
							}}
						>
							<Square className="h-4 w-4" />
							取消任务
						</Button>
					) : null}
				</div>

				<div className="grid gap-4 xl:grid-cols-[280px_280px_minmax(0,1fr)]">
					<div className="space-y-2">
						{editor.runs.map((run) => (
							<Button
								key={run.id}
								type="button"
								variant="outline"
								className={`h-auto w-full justify-start rounded-xl border px-3 py-3 text-left ${
									editor.selectedRun?.id === run.id
										? 'border-primary bg-primary/10'
										: 'border-border/60 hover:border-primary/40'
								}`}
								onClick={() => {
									editor.setSelectedRunId(run.id);
									editor.setSelectedInstanceId(null);
								}}
							>
								<div className="flex w-full items-center justify-between">
									<p className="text-sm font-medium">{run.flowName}</p>
									<Badge variant={editor.statusVariant(run.status)}>{editor.formatStatus(run.status)}</Badge>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									成功 {run.successCount} / 失败 {run.failedCount} / 取消 {run.cancelledCount}
								</p>
							</Button>
						))}
					</div>

					<div className="space-y-2">
						{editor.runDetailsQuery.data?.instances.map((instance) => (
							<div
								key={instance.id}
								className={`rounded-xl border px-3 py-3 ${
									editor.selectedInstance?.id === instance.id
										? 'border-primary bg-primary/10'
										: 'border-border/60'
								}`}
							>
								<Button
									type="button"
									variant="ghost"
									className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
									onClick={() => editor.setSelectedInstanceId(instance.id)}
								>
									<div className="flex w-full items-center justify-between">
										<p className="text-sm font-medium">{instance.profileId}</p>
										<Badge variant={editor.statusVariant(instance.status)}>
											{editor.formatStatus(instance.status)}
										</Badge>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										当前节点：{instance.currentNodeId ?? '已完成'}
									</p>
									{instance.errorMessage ? (
										<p className="mt-1 text-xs text-destructive">{instance.errorMessage}</p>
									) : null}
								</Button>
								<div className="mt-3 flex gap-2">
									<Button
										variant="outline"
										size="sm"
										className="flex-1 cursor-pointer"
										onClick={() => void editor.actions.cancelInstance(instance.id)}
									>
										取消
									</Button>
									{instance.status === 'needs_manual' ? (
										<Button
											size="sm"
											className="flex-1 cursor-pointer"
											onClick={() => void editor.actions.resumeInstance(instance.id)}
										>
											继续
										</Button>
									) : null}
								</div>
							</div>
						))}
					</div>

					<div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
						{editor.selectedInstance ? (
							<>
								<div className="grid gap-3 md:grid-cols-2">
									<div className="rounded-xl border border-border/60 p-3">
										<p className="text-xs text-muted-foreground">上下文</p>
										<pre className="mt-2 overflow-x-auto text-xs">
											{JSON.stringify(editor.selectedInstance.context, null, 2)}
										</pre>
									</div>
									<div className="rounded-xl border border-border/60 p-3">
										<p className="text-xs text-muted-foreground">调试产物</p>
										<pre className="mt-2 overflow-x-auto text-xs">
											{JSON.stringify(editor.selectedInstance.artifactIndex, null, 2)}
										</pre>
									</div>
								</div>
								<div className="space-y-2">
									{editor.runStepsQuery.data?.map((step) => (
										<div key={step.id} className="rounded-xl border border-border/60 p-3">
											<div className="flex items-center justify-between gap-3">
												<div>
													<p className="text-sm font-medium">
														{step.nodeKind} · {step.nodeId}
													</p>
													<p className="text-xs text-muted-foreground">尝试 {step.attempt}</p>
												</div>
												<Badge variant={editor.statusVariant(step.status)}>
													{editor.formatStatus(step.status)}
												</Badge>
											</div>
											{step.errorMessage ? (
												<p className="mt-2 text-xs text-destructive">{step.errorMessage}</p>
											) : null}
											<div className="mt-3 grid gap-3 md:grid-cols-2">
												<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">
													{JSON.stringify(step.inputSnapshot, null, 2)}
												</pre>
												<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">
													{JSON.stringify(step.outputSnapshot, null, 2)}
												</pre>
											</div>
										</div>
									))}
								</div>
							</>
						) : (
							<div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
								从左侧任务和实例列表选择一条记录，查看步骤日志、变量上下文和调试产物。
							</div>
						)}
					</div>
				</div>
			</Card>
		</div>
	);
}
