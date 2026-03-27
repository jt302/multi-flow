import { useState } from 'react';

import {
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Loader2,
	Pencil,
	Play,
	Trash2,
	XCircle,
} from 'lucide-react';

import type { AutomationRun, AutomationScript, StepResult } from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
	script: AutomationScript;
	runs: AutomationRun[];
	activeProfiles: ProfileItem[];
	isRunning: boolean;
	liveStepResults: StepResult[];
	activeRunId: string | null;
	onEdit: () => void;
	onDelete: () => void;
	onRun: (profileId: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
	success: 'text-green-500',
	failed: 'text-red-500',
	running: 'text-blue-500',
	pending: 'text-muted-foreground',
	skipped: 'text-muted-foreground',
	cancelled: 'text-muted-foreground',
};

function StepStatusIcon({ status }: { status: string }) {
	if (status === 'success') return <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />;
	if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
	if (status === 'running') return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />;
	return <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 flex-shrink-0" />;
}

export function ScriptDetailPanel({
	script,
	runs,
	activeProfiles,
	isRunning,
	liveStepResults,
	activeRunId,
	onEdit,
	onDelete,
	onRun,
}: Props) {
	const [runPanelOpen, setRunPanelOpen] = useState(true);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [profilePickerOpen, setProfilePickerOpen] = useState(false);

	const stepResultMap = new Map(liveStepResults.map((r) => [r.index, r]));

	return (
		<div className="flex flex-col h-full">
			{/* 顶部标题栏 */}
			<div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
				<div>
					<h2 className="text-sm font-semibold">{script.name}</h2>
					{script.description && (
						<p className="text-xs text-muted-foreground mt-0.5">{script.description}</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 cursor-pointer"
						onClick={onEdit}
					>
						<Pencil className="h-3.5 w-3.5 mr-1" />
						编辑
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 text-destructive hover:text-destructive cursor-pointer"
						onClick={() => setDeleteOpen(true)}
					>
						<Trash2 className="h-3.5 w-3.5 mr-1" />
						删除
					</Button>
					<Popover open={profilePickerOpen} onOpenChange={setProfilePickerOpen}>
						<PopoverTrigger asChild>
							<Button
								size="sm"
								className="h-8 cursor-pointer"
								disabled={isRunning || script.steps.length === 0}
							>
								{isRunning ? (
									<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
								) : (
									<Play className="h-3.5 w-3.5 mr-1" />
								)}
								运行
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-52 p-1">
							{activeProfiles.length === 0 ? (
								<p className="px-2 py-1.5 text-sm text-muted-foreground">没有已开启的环境</p>
							) : (
								activeProfiles.map((p) => (
									<button
										key={p.id}
										type="button"
										className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer"
										onClick={() => {
											setProfilePickerOpen(false);
											onRun(p.id);
										}}
									>
										{p.name}
									</button>
								))
							)}
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* 步骤列表 */}
			<ScrollArea className="flex-1">
				<div className="px-5 py-4">
					<p className="text-xs font-medium text-muted-foreground mb-3">步骤 ({script.steps.length})</p>
					{script.steps.length === 0 ? (
						<p className="text-sm text-muted-foreground">暂无步骤，点击编辑添加</p>
					) : (
						<div className="space-y-1.5">
							{script.steps.map((step, i) => {
								const result = stepResultMap.get(i);
								return (
									<div
										key={i}
										className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-sm"
									>
										<StepStatusIcon status={result?.status ?? 'pending'} />
										<div className="flex-1 min-w-0">
											<span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mr-2">
												{step.kind}
											</span>
											<StepSummary step={step} />
											{result?.output && (
												<p className="text-xs text-muted-foreground mt-1 truncate">
													{result.output.slice(0, 120)}
												</p>
											)}
										</div>
										{result && (
											<span className={`text-xs flex-shrink-0 ${STATUS_COLORS[result.status]}`}>
												{result.durationMs}ms
											</span>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</ScrollArea>

			{/* 运行历史面板 */}
			<div className="border-t flex-shrink-0">
				<button
					type="button"
					className="flex items-center justify-between w-full px-5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
					onClick={() => setRunPanelOpen((v) => !v)}
				>
					<span>运行历史 ({runs.length})</span>
					{runPanelOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
				</button>
				{runPanelOpen && (
					<div className="max-h-40 overflow-auto">
						{runs.length === 0 ? (
							<p className="px-5 py-3 text-xs text-muted-foreground">暂无运行记录</p>
						) : (
							<div className="divide-y">
								{runs.map((run) => (
									<div
										key={run.id}
										className={`px-5 py-2 flex items-center gap-3 text-xs ${activeRunId === run.id ? 'bg-muted/50' : ''}`}
									>
										<RunStatusBadge status={run.status} />
										<span className="text-muted-foreground">
											{new Date(run.startedAt * 1000).toLocaleString()}
										</span>
										{run.error && (
											<span className="text-red-500 truncate max-w-40">{run.error}</span>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>删除脚本</AlertDialogTitle>
						<AlertDialogDescription>
							确认删除脚本「{script.name}」？此操作不可撤销。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
						<AlertDialogAction
							className="cursor-pointer"
							onClick={onDelete}
						>
							删除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function StepSummary({ step }: { step: AutomationScript['steps'][number] }) {
	switch (step.kind) {
		case 'navigate':
			return <span className="text-muted-foreground">{step.url}</span>;
		case 'wait':
			return <span className="text-muted-foreground">{step.ms}ms</span>;
		case 'evaluate':
			return <span className="text-muted-foreground font-mono text-xs">{step.expression.slice(0, 60)}</span>;
		case 'click':
			return <span className="text-muted-foreground">{step.selector}</span>;
		case 'type':
			return <span className="text-muted-foreground">"{step.text}" → {step.selector}</span>;
		case 'screenshot':
			return <span className="text-muted-foreground">截图</span>;
		case 'magic':
			return <span className="text-muted-foreground">{step.command}</span>;
		case 'cdp':
			return <span className="text-muted-foreground">{step.method}</span>;
		case 'wait_for_user':
			return <span className="text-muted-foreground">{step.message.slice(0, 60)}</span>;
		case 'condition':
			return <span className="text-muted-foreground font-mono text-xs">{step.condition_expr.slice(0, 60)}</span>;
		case 'loop':
			return <span className="text-muted-foreground">{step.mode === 'while' ? `while ${step.condition_expr ?? ''}` : `×${step.count ?? 1}`}</span>;
		case 'break':
			return <span className="text-muted-foreground">break</span>;
		case 'continue':
			return <span className="text-muted-foreground">continue</span>;
		default:
			return null;
	}
}

function RunStatusBadge({ status }: { status: string }) {
	const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		success: 'default',
		failed: 'destructive',
		running: 'secondary',
		pending: 'outline',
		cancelled: 'outline',
	};
	return (
		<Badge variant={variantMap[status] ?? 'outline'} className="text-xs h-5">
			{status}
		</Badge>
	);
}
