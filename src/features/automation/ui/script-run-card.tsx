import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChevronDown, ChevronUp, Download, Maximize2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AutomationRun } from '@/entities/automation/model/types';
import { exportBackendLogs } from '@/entities/log-entry/api/logs-api';
import { RunStatusBadge } from '@/entities/automation/ui/run-status-badge';
import { ProfileBadge } from '@/entities/profile/ui/profile-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RunLogViewer } from './run-log-viewer';
import { StepTreeRenderer, buildResultMap } from './step-tree-renderer';

// ─── RunRow ───────────────────────────────────────────────────────────────────

type RunRowProps = {
	run: AutomationRun;
	onSelect: () => void;
	onDelete: () => void;
};

/** 运行记录列表行，点击进入详情模式 */
export function RunRow({ run, onSelect, onDelete }: RunRowProps) {
	const { t } = useTranslation(['automation', 'common']);

	return (
		<div className="rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
			<div className="flex items-center gap-3 px-3 py-2 text-xs">
				<button
					type="button"
					className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
					onClick={onSelect}
				>
					<RunStatusBadge status={run.status} />
					{run.profileId && <ProfileBadge profileId={run.profileId} showColor={false} className="shrink-0" />}
					<span className="text-muted-foreground flex-1 min-w-0 truncate">
						{new Date(run.startedAt * 1000).toLocaleString()}
					</span>
					{run.finishedAt && (
						<span className="text-muted-foreground/60 text-[10px] shrink-0">
							{((run.finishedAt - run.startedAt) / 1).toFixed(1)}s
						</span>
					)}
					{run.error && (
						<span className="text-red-500 truncate max-w-40">{run.error}</span>
					)}
					<Maximize2 className="h-3 w-3 text-muted-foreground shrink-0" />
				</button>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					title={t('common:deleteRecord')}
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>
		</div>
	);
}

// ─── RunDetailView ────────────────────────────────────────────────────────────

// ─── 日志导出 ─────────────────────────────────────────────────────────────────

function getStatusLabel(t: (key: string) => string, status: string): string {
	const STATUS_LABEL: Record<string, string> = {
		pending: t('common:pending'),
		running: t('common:running'),
		success: t('common:success'),
		failed: t('common:failed'),
		cancelled: t('common:cancelled'),
		skipped: t('common:skipped'),
		waiting_human: t('common:waitingHuman'),
		interrupted: t('common:interrupted'),
	};
	return STATUS_LABEL[status] ?? status;
}

function formatExportLogTime(ts: number): string {
	const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRunForExport(run: AutomationRun, t: (key: string, options?: Record<string, unknown>) => string): string[] {
	const lines: string[] = [];

	lines.push('═══════════════════════════════════════════');
	lines.push(`  ${t('automation:executionReport')}`);
	lines.push('═══════════════════════════════════════════');
	lines.push('');
	lines.push(`${t('common:runId')}:   ${run.id}`);
	lines.push(`${t('common:profileId')}:   ${run.profileId}`);
	lines.push(`${t('common:status')}:      ${getStatusLabel(t, run.status)}`);
	lines.push(`${t('common:startTime')}:  ${formatExportLogTime(run.startedAt)}`);
	if (run.finishedAt) {
		lines.push(`${t('common:endTime')}:  ${formatExportLogTime(run.finishedAt)}`);
		lines.push(`${t('common:totalTime')}:    ${(run.finishedAt - run.startedAt).toFixed(1)}s`);
	}
	if (run.error) {
		lines.push(`${t('common:error')}:      ${run.error}`);
	}
	lines.push('');

	// 步骤结果
	if (run.results && run.results.length > 0) {
		lines.push('───────────────────────────────────────────');
		lines.push(`  ${t('common:stepResults')} (${run.results.length})`);
		lines.push('───────────────────────────────────────────');
		lines.push('');
		for (const r of run.results) {
			const path = r.stepPath ? r.stepPath.join('.') : String(r.index);
			const status = getStatusLabel(t, r.status);
			lines.push(`[${path}] ${status} (${r.durationMs}ms)`);
			if (r.output) {
				lines.push(`    ${t('common:output')}: ${r.output}`);
			}
			if (r.varsSet && Object.keys(r.varsSet).length > 0) {
				for (const [k, v] of Object.entries(r.varsSet)) {
					lines.push(`    ${t('common:var')}: ${k} = ${v}`);
				}
			}
		}
		lines.push('');
	}

	// 执行日志
	const logs = run.logs ?? [];
	if (logs.length > 0) {
		lines.push('───────────────────────────────────────────');
		lines.push(`  ${t('common:executionLogs')} (${logs.length})`);
		lines.push('───────────────────────────────────────────');
		lines.push('');
		for (const entry of logs) {
			const time = formatExportLogTime(entry.timestamp);
			const level = entry.level.toUpperCase().padEnd(5);
			lines.push(`${time} [${level}] [${entry.category}] ${entry.message}`);
			if (entry.details) {
				lines.push(`    ${JSON.stringify(entry.details)}`);
			}
		}
	}

	return lines;
}

type RunDetailViewProps = {
	run: AutomationRun;
	/** Sheet 全屏模式下传 true，内部会给更大空间 */
	expanded?: boolean;
};

/** 运行记录详情视图：包含步骤结果和执行日志两个 Tab，高度自适应父容器 */
export function RunDetailView({ run, expanded = false }: RunDetailViewProps) {
	const { t } = useTranslation(['automation', 'common']);
	const [runDetailTab, setRunDetailTab] = useState<string>('results');
	const [exporting, setExporting] = useState(false);

	async function handleExport() {
		setExporting(true);
		try {
			const lines = formatRunForExport(run, t);
			const ts = formatExportLogTime(run.startedAt).replace(/[: ]/g, '-');
			const fileName = `run-${ts}.log`;
			const result = await exportBackendLogs(lines, fileName);
			toast.success(t('common:exportSucceeded', { count: result.lineCount, path: result.path }));
		} catch (err) {
			toast.error(t('common:exportFailed'));
		} finally {
			setExporting(false);
		}
	}

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<Tabs
				value={runDetailTab}
				onValueChange={setRunDetailTab}
				className="flex flex-col flex-1 min-h-0 w-full"
			>
				<div className="flex items-center mx-3 mt-2 mb-0 shrink-0 gap-1">
					<TabsList className="h-7 bg-muted/40">
						<TabsTrigger value="results" className="text-xs h-6 px-2.5">
							{t('common:stepResults')}{run.results ? ` (${run.results.length})` : ''}
						</TabsTrigger>
						<TabsTrigger value="logs" className="text-xs h-6 px-2.5">
							{t('common:executionLogs')}
							{run.logs && run.logs.length > 0 && (
								<span className="ml-1 text-[10px] bg-primary/15 text-primary rounded px-1">
									{run.logs.length}
								</span>
							)}
						</TabsTrigger>
					</TabsList>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
						title={t('common:exportReport')}
						disabled={exporting}
						onClick={handleExport}
					>
						<Download className="h-3.5 w-3.5" />
					</Button>
				</div>

				{/* 步骤结果 Tab */}
				<TabsContent
					value="results"
					className="flex-1 min-h-0 overflow-auto px-3 pb-3 pt-2 space-y-2 mt-0"
				>
					{run.error && (
						<div className="rounded bg-red-50 dark:bg-red-950/20 p-2">
							<p className="text-xs text-red-500 font-medium mb-0.5">
								{t('common:errorInfo')}
							</p>
							<p className="text-xs text-red-400 break-all whitespace-pre-wrap">
								{run.error}
							</p>
						</div>
					)}
					{run.results && run.results.length > 0 ? (
						<StepTreeRenderer
							steps={run.steps}
							resultMap={buildResultMap(run.results)}
						/>
					) : (
						<p className="text-xs text-muted-foreground">{t('common:noResults')}</p>
					)}
				</TabsContent>

				{/* 执行日志 Tab */}
				<TabsContent
					value="logs"
					className="flex flex-col flex-1 min-h-0 px-0 pb-0 pt-0 mt-0"
				>
					<RunLogViewer logs={run.logs ?? []} expanded={expanded} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// ─── ScriptRunCard（已废弃，保留兼容） ─────────────────────────────────────────

type Props = {
	run: AutomationRun;
	runIndex: number;
	isExpanded: boolean;
	onToggle: () => void;
	onDelete: () => void;
};

/** @deprecated 使用 RunRow + RunDetailView 替代 */
export function ScriptRunCard({
	run,
	runIndex: _runIndex,
	isExpanded,
	onToggle,
	onDelete,
}: Props) {
	const { t } = useTranslation(['automation', 'common']);

	return (
		<div
			className={`rounded-lg border ${isExpanded ? 'bg-card shadow-sm' : 'bg-muted/20'}`}
		>
			<div className="flex items-center gap-3 px-3 py-2 text-xs">
				<button
					type="button"
					className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
					onClick={onToggle}
				>
					<RunStatusBadge status={run.status} />
					<span className="text-muted-foreground flex-1 min-w-0 truncate">
						{new Date(run.startedAt * 1000).toLocaleString()}
					</span>
					{run.finishedAt && (
						<span className="text-muted-foreground/60 text-[10px] shrink-0">
							{((run.finishedAt - run.startedAt) / 1).toFixed(1)}s
						</span>
					)}
					{run.error && !isExpanded && (
						<span className="text-red-500 truncate max-w-40">{run.error}</span>
					)}
					{isExpanded ? (
						<ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
					) : (
						<ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
					)}
				</button>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					title={t('common:deleteRecord')}
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>

			<div
				className="grid transition-all duration-200 ease-in-out"
				style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
			>
				<div className="overflow-hidden min-h-0">
					{isExpanded && (
						<div className="border-t">
							<RunDetailView run={run} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
