import { useCallback, useEffect, useRef, useState } from 'react';

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Download, Loader2, Network, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import i18next from 'i18next';

import { openAutomationCanvasWindow } from '@/entities/automation/api/automation-api';
import { resolveScriptFlowEntryState } from '@/entities/automation/model/script-flow-entry';
import type {
	AutomationRun,
	AutomationScript,
	RunDelayConfig,
	StepResult,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
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
import { Button } from '@/components/ui/button';
import { RunDialog } from './run-dialog';
import { ScriptRunsPanel } from './script-runs-panel';
import { ScriptStepsViewer } from './script-steps-viewer';

type Props = {
	script: AutomationScript;
	runs: AutomationRun[];
	activeProfiles: ProfileItem[];
	allProfiles?: ProfileItem[];
	isRunning: boolean;
	liveStepResults: StepResult[];
	liveVariables: Record<string, string>;
	activeRunId: string | null;
	onEdit: () => void;
	onDelete: () => void;
	onRun: (
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) => void;
	onDebugRun: (profileId: string, initialVars: Record<string, string>) => void;
	onCancel: () => void;
	onRunsChange?: () => void;
};

async function exportScript(script: AutomationScript) {
	const sanitized = script.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
	const filePath = await save({
		defaultPath: `${sanitized}.json`,
		filters: [
			{ name: i18next.t('automation:detail.jsonFile'), extensions: ['json'] },
		],
	});
	if (!filePath) return;
	await invoke('export_automation_script_to_file', {
		scriptId: script.id,
		filePath: typeof filePath === 'string' ? filePath : filePath[0],
	});
}

/** 脚本详情面板：上下分栏（步骤 / 运行记录），支持拖拽调整比例 */
export function ScriptDetailPanel({
	script,
	runs,
	activeProfiles,
	allProfiles = [],
	isRunning,
	liveStepResults,
	liveVariables,
	activeRunId: _activeRunId,
	onEdit,
	onDelete,
	onRun,
	onDebugRun,
	onCancel,
	onRunsChange,
}: Props) {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const flowEntryState = resolveScriptFlowEntryState(script);
	const { t } = useTranslation(['automation', 'common']);

	// 上下分栏：lowerHeight 为下方面板高度（px），默认 350px
	const [lowerHeight, setLowerHeight] = useState(350);
	const containerRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);
	const startY = useRef(0);
	const startHeight = useRef(0);

	const handleDividerMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDragging.current = true;
			startY.current = e.clientY;
			startHeight.current = lowerHeight;
		},
		[lowerHeight],
	);

	useEffect(() => {
		function onMouseMove(e: MouseEvent) {
			if (!isDragging.current) return;
			const delta = startY.current - e.clientY;
			const containerH = containerRef.current?.clientHeight ?? 600;
			// 下方最小 160px，最大留给上方 160px
			const next = Math.min(
				containerH - 160,
				Math.max(160, startHeight.current + delta),
			);
			setLowerHeight(next);
		}
		function onMouseUp() {
			isDragging.current = false;
		}
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		return () => {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
	}, []);

	return (
		<div className="flex flex-col h-full" ref={containerRef}>
			{/* 顶部标题栏 */}
			<div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
				<div className="flex items-center gap-1 min-w-0">
					<div className="min-w-0">
						<h2 className="text-sm font-semibold truncate">{script.name}</h2>
						{script.description && (
							<p className="text-xs text-muted-foreground mt-0.5 truncate">
								{script.description}
							</p>
						)}
					</div>
					<Button
						size="icon"
						variant="ghost"
						className="h-6 w-6 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						onClick={onEdit}
						title={t('detail.renameEdit')}
					>
						<Pencil className="h-3 w-3" />
					</Button>
				</div>
				<div className="flex items-center gap-1.5">
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 cursor-pointer"
						onClick={() => openAutomationCanvasWindow(script.id, script.name)}
					>
						<Network className="h-3.5 w-3.5 mr-1" />
						{t('detail.flowEditor')}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 cursor-pointer"
						onClick={() => void exportScript(script)}
					>
						<Download className="h-3.5 w-3.5 mr-1" />
						{t('detail.export')}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 text-destructive hover:text-destructive cursor-pointer"
						onClick={() => setDeleteOpen(true)}
					>
						<Trash2 className="h-3.5 w-3.5 mr-1" />
						{t('common:delete')}
					</Button>
					{isRunning ? (
						<Button
							size="sm"
							variant="destructive"
							className="h-8 cursor-pointer"
							onClick={onCancel}
						>
							<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
							{t('common:cancel')}
						</Button>
					) : (
						<Button
							size="sm"
							className="h-8 cursor-pointer"
							disabled={script.steps.length === 0}
							onClick={() => setRunDialogOpen(true)}
						>
							<Play className="h-3.5 w-3.5 mr-1" />
							{t('detail.run')}
						</Button>
					)}
				</div>
			</div>

			{/* 上方：步骤列表（flex-1，随容器自适应） */}
			<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
				<div className="flex items-center px-5 pt-3 pb-1 shrink-0">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<span>
							{t('detail.stepsCount', { count: script.steps.length })}
							{isRunning && (
								<Loader2 className="inline h-3 w-3 ml-1 animate-spin" />
							)}
						</span>
						{!flowEntryState.entryConnected && (
							<span className="rounded-full border border-amber-300/80 bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-700">
								{t('detail.entryNotConnected')}
							</span>
						)}
						{flowEntryState.orphanedStepCount > 0 && (
							<span className="rounded-full border border-zinc-300/80 bg-zinc-100/80 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-600/60 dark:bg-zinc-800/60 dark:text-zinc-400">
								{t('detail.orphanedSteps', {
									count: flowEntryState.orphanedStepCount,
								})}
							</span>
						)}
					</div>
				</div>
				<ScriptStepsViewer
					steps={script.steps}
					isRunning={isRunning}
					liveStepResults={liveStepResults}
					liveVariables={liveVariables}
					scriptId={script.id}
					scriptName={script.name}
					entryConnected={flowEntryState.entryConnected}
				/>
			</div>

			{/* 拖拽分隔线（双击切换 50/50 与默认高度） */}
			<div
				className="h-1.5 border-t border-b cursor-row-resize bg-muted/30 hover:bg-muted/60 transition-colors shrink-0 flex items-center justify-center"
				onMouseDown={handleDividerMouseDown}
				onDoubleClick={() => {
					const containerH = containerRef.current?.clientHeight ?? 600;
					const halfH = Math.round(containerH * 0.5);
					setLowerHeight((prev) => (prev < halfH - 20 ? halfH : 350));
				}}
			>
				<div className="w-8 h-0.5 rounded-full bg-border" />
			</div>

			{/* 下方：运行记录 */}
			<div
				className="shrink-0 overflow-hidden flex flex-col"
				style={{ height: lowerHeight }}
			>
				<div className="flex items-center px-5 pt-2 pb-1 shrink-0">
					<span className="text-xs font-medium text-muted-foreground">
						{t('detail.runHistoryCount', { count: runs.length })}
					</span>
				</div>
				<div className="flex-1 min-h-0 overflow-hidden">
					<ScriptRunsPanel
						runs={runs}
						scriptId={script.id}
						scriptName={script.name}
						onRunsChange={onRunsChange ?? (() => {})}
					/>
				</div>
			</div>

			{/* 删除脚本确认弹窗 */}
			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('common:deleteItem', { item: t('common:script') })}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('automation:deleteScriptConfirm', { name: script.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button type="button" variant="ghost" className="cursor-pointer">
								{t('common:cancel')}
							</Button>
						</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								type="button"
								variant="destructive"
								className="cursor-pointer"
								onClick={onDelete}
							>
								{t('common:delete')}
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 运行对话框 */}
			<RunDialog
				open={runDialogOpen}
				onOpenChange={setRunDialogOpen}
				activeProfiles={activeProfiles}
				allProfiles={allProfiles}
				associatedProfileIds={script.associatedProfileIds}
				isRunning={isRunning}
				disabled={script.steps.length === 0}
				scriptSettings={script.settings}
				onRun={onRun}
				onDebugRun={onDebugRun}
			/>
		</div>
	);
}
