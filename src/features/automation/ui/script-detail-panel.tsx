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
		// Magic 具名步骤
		case 'magic_set_bounds':
			return <span className="text-muted-foreground">{step.x},{step.y} {step.width}×{step.height}</span>;
		case 'magic_get_bounds': return <span className="text-muted-foreground">获取窗口位置大小</span>;
		case 'magic_set_maximized': return <span className="text-muted-foreground">最大化</span>;
		case 'magic_set_minimized': return <span className="text-muted-foreground">最小化</span>;
		case 'magic_set_closed': return <span className="text-muted-foreground">关闭窗口</span>;
		case 'magic_set_restored': return <span className="text-muted-foreground">还原</span>;
		case 'magic_set_fullscreen': return <span className="text-muted-foreground">全屏</span>;
		case 'magic_set_bg_color':
			return <span className="text-muted-foreground">rgb({step.r ?? 255},{step.g ?? 255},{step.b ?? 255})</span>;
		case 'magic_set_toolbar_text':
			return <span className="text-muted-foreground">{step.text}</span>;
		case 'magic_set_app_top_most': return <span className="text-muted-foreground">激活窗口</span>;
		case 'magic_set_master_indicator_visible':
			return <span className="text-muted-foreground">{step.visible ? '显示' : '隐藏'}主控标记</span>;
		case 'magic_open_new_tab':
			return <span className="text-muted-foreground">{step.url}</span>;
		case 'magic_close_tab':
		case 'magic_activate_tab':
			return <span className="text-muted-foreground">tab_id={step.tab_id}</span>;
		case 'magic_activate_tab_by_index':
			return <span className="text-muted-foreground">index={step.index}</span>;
		case 'magic_close_inactive_tabs': return <span className="text-muted-foreground">关闭非活动标签页</span>;
		case 'magic_open_new_window': return <span className="text-muted-foreground">新建窗口</span>;
		case 'magic_type_string':
			return <span className="text-muted-foreground">"{step.text.slice(0, 40)}"</span>;
		case 'magic_capture_app_shell': return <span className="text-muted-foreground">{step.mode ?? 'inline'}</span>;
		case 'magic_get_browsers': return <span className="text-muted-foreground">所有浏览器</span>;
		case 'magic_get_active_browser': return <span className="text-muted-foreground">活动浏览器</span>;
		case 'magic_get_tabs':
			return <span className="text-muted-foreground">browser_id={step.browser_id}</span>;
		case 'magic_get_active_tabs': return <span className="text-muted-foreground">活动标签页</span>;
		case 'magic_get_switches':
			return <span className="text-muted-foreground font-mono">{step.key}</span>;
		case 'magic_get_host_name': return <span className="text-muted-foreground">主机名</span>;
		case 'magic_get_mac_address': return <span className="text-muted-foreground">MAC地址</span>;
		case 'magic_get_bookmarks': return <span className="text-muted-foreground">书签树</span>;
		case 'magic_create_bookmark':
			return <span className="text-muted-foreground">{step.title} → {step.url.slice(0, 40)}</span>;
		case 'magic_create_bookmark_folder':
			return <span className="text-muted-foreground">{step.title}</span>;
		case 'magic_update_bookmark':
		case 'magic_remove_bookmark':
		case 'magic_move_bookmark':
			return <span className="text-muted-foreground font-mono">node_id={step.node_id}</span>;
		case 'magic_bookmark_current_tab': return <span className="text-muted-foreground">收藏当前标签</span>;
		case 'magic_unbookmark_current_tab': return <span className="text-muted-foreground">取消收藏当前标签</span>;
		case 'magic_is_current_tab_bookmarked': return <span className="text-muted-foreground">查询收藏状态</span>;
		case 'magic_export_bookmark_state': return <span className="text-muted-foreground">导出书签</span>;
		case 'magic_get_managed_cookies': return <span className="text-muted-foreground">托管Cookie</span>;
		case 'magic_export_cookie_state':
			return <span className="text-muted-foreground">{step.mode}</span>;
		case 'magic_get_managed_extensions': return <span className="text-muted-foreground">托管扩展</span>;
		case 'magic_trigger_extension_action':
			return <span className="text-muted-foreground font-mono">{step.extension_id.slice(0, 16)}...</span>;
		case 'magic_close_extension_popup': return <span className="text-muted-foreground">关闭扩展Popup</span>;
		case 'magic_toggle_sync_mode':
			return <span className="text-muted-foreground">{step.role}</span>;
		case 'magic_get_sync_mode': return <span className="text-muted-foreground">同步状态</span>;
		case 'magic_get_is_master': return <span className="text-muted-foreground">是否主控</span>;
		case 'magic_get_sync_status': return <span className="text-muted-foreground">完整同步状态</span>;
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
