/**
 * step-tree-renderer.tsx
 * 递归树形渲染自动化步骤执行结果。
 * 支持 condition（then/else）、confirm_dialog（button_branches）、loop（body_steps）嵌套结构。
 * 已执行分支默认展开，未执行分支折叠并显示"未执行"灰色标签。
 */

import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AiExecutionDetail, ScriptStep, StepResult } from '@/entities/automation/model/types';
import { StepStatusIcon } from '@/entities/automation/ui/step-status-icon';
import { StepSummary } from '@/entities/automation/ui/step-summary';
import { useAutomationStore } from '@/store/automation-store';

// ─── 步骤类型可读名称映射 ──────────────────────────────────────────────────────

const STEP_KIND_LABELS: Record<string, string> = {
	// 对话类
	confirm_dialog: '确认对话框',
	select_dialog: '选择对话框',
	form_dialog: '表单对话框',
	table_dialog: '表格对话框',
	image_dialog: '图片对话框',
	countdown_dialog: '倒计时对话框',
	markdown_dialog: 'Markdown 对话框',
	rich_text_dialog: '富文本对话框',
	notification: '通知',
	// 流程控制
	condition: '条件判断',
	loop: '循环',
	continue: '继续',
	end: '结束',
	wait: '等待',
	// AI
	ai_agent: 'AI Agent',
	ai_judge: 'AI 判断',
	// 验证码
	captcha_detect: '验证码检测',
	captcha_solve: '验证码识别',
	captcha_inject_token: '注入Token',
	captcha_solve_and_inject: '识别并注入',
	captcha_get_balance: '查询余额',
	// 应用/脚本
	app_run_script: '运行脚本',
	// Magic
	magic_get_managed_extensions: '获取托管扩展',
	magic_trigger_extension_action: '触发扩展操作',
	magic_capture_app_shell: '截图',
	// CDP
	cdp_navigate: '导航',
	cdp_click: '点击',
	cdp_input: '输入',
	cdp_screenshot: '截图',
	cdp_execute_js: '执行JS',
	cdp_get_html: '获取HTML',
	cdp_get_text: '获取文本',
	cdp_wait_for: '等待元素',
	cdp_scroll: '滚动',
	cdp_select: '选择',
	cdp_hover: '悬停',
	// 文件
	file_read: '读取文件',
	file_write: '写入文件',
	file_exists: '检查文件',
	file_delete: '删除文件',
	file_list: '列出文件',
};

function getStepKindLabel(kind: string): string {
	return STEP_KIND_LABELS[kind] ?? kind;
}

// ─── 颜色配置 ─────────────────────────────────────────────────────────────────

type BranchType = 'then' | 'else' | 'body' | 'btn';

const BRANCH_BORDER = new Map<BranchType, string>([
	['then', 'border-l-blue-400'],
	['else', 'border-l-orange-400'],
	['body', 'border-l-green-400'],
	['btn', 'border-l-purple-400'],
]);

const BRANCH_LABEL_COLOR = new Map<BranchType, string>([
	['then', 'text-blue-500'],
	['else', 'text-orange-500'],
	['body', 'text-green-600'],
	['btn', 'text-purple-500'],
]);

const STATUS_COLORS: Record<string, string> = {
	success: 'text-green-500',
	failed: 'text-red-500',
	running: 'text-blue-500',
	pending: 'text-muted-foreground',
	skipped: 'text-muted-foreground',
};

// ─── 类型 ──────────────────────────────────────────────────────────────────────

/** key = stepPath.join('.') */
export type ResultMap = Map<string, StepResult>;

/** 从 StepResult[] 构建 ResultMap */
export function buildResultMap(results: StepResult[]): ResultMap {
	const map = new Map<string, StepResult>();
	for (const r of results) {
		const key = r.stepPath && r.stepPath.length > 0 ? r.stepPath.join('.') : String(r.index);
		map.set(key, r);
	}
	return map;
}

// ─── BranchGroup ──────────────────────────────────────────────────────────────

type BranchGroupProps = {
	label: string;
	branchType: BranchType;
	steps: ScriptStep[];
	resultMap: ResultMap;
	/** 父步骤在 resultMap 中的路径前缀，如 [2] */
	pathPrefix: number[];
	/** 是否有任意子步骤已执行（决定默认折叠状态） */
	hasExecuted: boolean;
};

function BranchGroup({
	label,
	branchType,
	steps,
	resultMap,
	pathPrefix,
	hasExecuted,
}: BranchGroupProps) {
	const [expanded, setExpanded] = useState(hasExecuted);
	const borderCls = BRANCH_BORDER.get(branchType) ?? 'border-l-purple-400';
	const labelCls = BRANCH_LABEL_COLOR.get(branchType) ?? 'text-purple-500';
	const { t } = useTranslation(['automation', 'common']);

	return (
		<div className={`border-l-2 pl-2 mt-1 ${borderCls}`}>
			{/* 分支标题行 */}
			<button
				type="button"
				className="flex items-center gap-1 text-[10px] font-medium cursor-pointer select-none py-0.5"
				onClick={() => setExpanded((v) => !v)}
			>
				{expanded ? (
					<ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
				) : (
					<ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
				)}
				<span className={labelCls}>{label}</span>
				{!hasExecuted && (
					<span className="ml-1 text-muted-foreground/50">{t('common:notExecuted')}</span>
				)}
			</button>

			{/* 分支内容 */}
			{expanded && (
				<div className="mt-0.5">
					<StepTreeRenderer steps={steps} resultMap={resultMap} pathPrefix={pathPrefix} />
				</div>
			)}
		</div>
	);
}

// ─── StepRow ──────────────────────────────────────────────────────────────────

type StepRowProps = {
	step: ScriptStep;
	result?: StepResult;
};

function AiDetailPanel({ detail }: { detail: AiExecutionDetail }) {
	const { t } = useTranslation(['automation', 'common']);
	const phaseLabel: Record<string, string> = {
		thinking: t('common:aiThinking'),
		tool_calling: t('common:toolCalling'),
		tool_result: t('common:toolResult'),
		complete: t('common:aiComplete'),
	};
	return (
		<div className="mt-1.5 space-y-1.5 text-xs border-l-2 border-blue-500/40 pl-2.5 ml-1">
			<div className="text-muted-foreground flex items-center gap-1.5">
				{detail.phase === 'thinking' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
				<span>{t('common:aiRound', { current: detail.round, total: detail.maxRounds })}</span>
				<span className="text-muted-foreground/60">
					— {phaseLabel[detail.phase] ?? detail.phase}
				</span>
			</div>
			{detail.thinking && (
				<div className="bg-muted/30 rounded px-2 py-1.5 text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
					{detail.thinking}
				</div>
			)}
			{detail.toolCalls?.map((tc) => (
				<div
					key={`${tc.name}-${tc.status}-${tc.durationMs ?? 'pending'}-${tc.result ?? ''}`}
					className="flex items-start gap-1.5 py-0.5"
				>
					{tc.status === 'executing' ? (
						<Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-0.5 shrink-0" />
					) : tc.status === 'completed' ? (
						<CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
					) : (
						<XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
					)}
					<div className="flex-1 min-w-0">
						<span className="font-mono text-blue-500">{tc.name}</span>
						{tc.durationMs != null && (
							<span className="text-muted-foreground/60 ml-1.5">{tc.durationMs}ms</span>
						)}
						{tc.result && (
							<p className="text-muted-foreground mt-0.5 break-all line-clamp-2">{tc.result}</p>
						)}
					</div>
				</div>
			))}
		</div>
	);
}

function StepRow({ step, result }: StepRowProps) {
	const isAiStep = step.kind === 'ai_agent' || step.kind === 'ai_judge';
	const liveAiDetail = useAutomationStore((s) => s.liveAiDetail);
	const aiDetail =
		isAiStep && result?.status === 'running' && liveAiDetail?.stepIndex === result.index
			? liveAiDetail.detail
			: null;

	return (
		<div className="py-1 px-1.5 rounded-md bg-muted/40 text-sm">
			<div className="flex items-start gap-2">
				<StepStatusIcon status={result?.status ?? 'pending'} />
				<div className="flex-1 min-w-0">
					<span className="text-xs bg-muted px-1 py-0.5 rounded mr-2">
						{getStepKindLabel(step.kind)}
					</span>
					<StepSummary step={step} />
					{result?.output && (
						<button
							type="button"
							className="block max-w-full truncate text-left text-xs text-muted-foreground mt-0.5 cursor-pointer hover:text-foreground"
							title={result.output}
							onClick={() => {
								if (result.output) void navigator.clipboard.writeText(result.output);
							}}
						>
							{result.output.slice(0, 120)}
							{result.output.length > 120 ? '…' : ''}
						</button>
					)}
				</div>
				{result && (
					<span className={`text-xs shrink-0 ${STATUS_COLORS[result.status] ?? ''}`}>
						{result.durationMs}ms
					</span>
				)}
			</div>
			{aiDetail && <AiDetailPanel detail={aiDetail} />}
		</div>
	);
}

// ─── StepTreeRenderer ─────────────────────────────────────────────────────────

type Props = {
	steps: ScriptStep[];
	resultMap: ResultMap;
	/** 当前层级步骤在全局嵌套路径中的前缀，顶层为 [] */
	pathPrefix?: number[];
};

export function StepTreeRenderer({ steps, resultMap, pathPrefix = [] }: Props) {
	const { t } = useTranslation(['automation', 'common']);

	return (
		<div className="space-y-1">
			{steps.map((step, i) => {
				const currentPath = [...pathPrefix, i];
				const pathKey = currentPath.join('.');
				const result = resultMap.get(pathKey);

				// condition 步骤：渲染 then/else 分支
				if (step.kind === 'condition') {
					// 检测 then/else 子步骤是否有结果
					const thenHasResult = step.then_steps.some((_, ti) => {
						const p = [...currentPath, ti].join('.');
						return resultMap.has(p);
					});
					const elseHasResult = (step.else_steps ?? []).some((_, ei) => {
						const p = [...currentPath, ei].join('.');
						return resultMap.has(p);
					});

					return (
						<div key={pathKey}>
							<StepRow step={step} result={result} />
							<div>
								<BranchGroup
									label="then"
									branchType="then"
									steps={step.then_steps}
									resultMap={resultMap}
									pathPrefix={currentPath}
									hasExecuted={thenHasResult}
								/>
								{step.else_steps && step.else_steps.length > 0 && (
									<BranchGroup
										label="else"
										branchType="else"
										steps={step.else_steps}
										resultMap={resultMap}
										pathPrefix={currentPath}
										hasExecuted={elseHasResult}
									/>
								)}
							</div>
						</div>
					);
				}

				// confirm_dialog 有 button_branches：渲染每个按钮分支
				if (
					step.kind === 'confirm_dialog' &&
					step.button_branches &&
					step.button_branches.length > 0
				) {
					const buttons = step.buttons ?? [];
					return (
						<div key={pathKey}>
							<StepRow step={step} result={result} />
							<div className="ml-2">
								{step.button_branches.map((branch, bi) => {
									const btnLabel = buttons[bi]?.text ?? t('common:button', { index: bi + 1 });
									const btnHasResult = branch.some((_, si) => {
										const p = [...currentPath, si].join('.');
										return resultMap.has(p);
									});
									return (
										<BranchGroup
											key={`${pathKey}-btn-${btnLabel}`}
											label={btnLabel}
											branchType="btn"
											steps={branch}
											resultMap={resultMap}
											pathPrefix={currentPath}
											hasExecuted={btnHasResult}
										/>
									);
								})}
							</div>
						</div>
					);
				}

				// loop 步骤：渲染 body_steps
				if (step.kind === 'loop') {
					const bodyHasResult = step.body_steps.some((_, si) => {
						const p = [...currentPath, si].join('.');
						return resultMap.has(p);
					});
					return (
						<div key={pathKey}>
							<StepRow step={step} result={result} />
							<div>
								<BranchGroup
									label="body"
									branchType="body"
									steps={step.body_steps}
									resultMap={resultMap}
									pathPrefix={currentPath}
									hasExecuted={bodyHasResult}
								/>
							</div>
						</div>
					);
				}

				// 普通步骤
				return <StepRow key={pathKey} step={step} result={result} />;
			})}
		</div>
	);
}
