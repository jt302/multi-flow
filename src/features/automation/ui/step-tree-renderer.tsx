/**
 * step-tree-renderer.tsx
 * 递归树形渲染自动化步骤执行结果。
 * 支持 condition（then/else）、confirm_dialog（button_branches）、loop（body_steps）嵌套结构。
 * 已执行分支默认展开，未执行分支折叠并显示"未执行"灰色标签。
 */

import { useState } from 'react';

import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-react';

import type { AiExecutionDetail, ScriptStep, StepResult } from '@/entities/automation/model/types';
import { useAutomationStore } from '@/store/automation-store';
import { StepStatusIcon } from '@/entities/automation/ui/step-status-icon';
import { StepSummary } from '@/entities/automation/ui/step-summary';

// ─── 颜色配置 ─────────────────────────────────────────────────────────────────

const BRANCH_BORDER: Record<string, string> = {
	then: 'border-l-blue-400',
	else: 'border-l-orange-400',
	body: 'border-l-green-400',
	btn: 'border-l-purple-400',
};

const BRANCH_LABEL_COLOR: Record<string, string> = {
	then: 'text-blue-500',
	else: 'text-orange-500',
	body: 'text-green-600',
	btn: 'text-purple-500',
};

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
	branchType: 'then' | 'else' | 'body' | 'btn';
	steps: ScriptStep[];
	resultMap: ResultMap;
	/** 父步骤在 resultMap 中的路径前缀，如 [2] */
	pathPrefix: number[];
	/** 是否有任意子步骤已执行（决定默认折叠状态） */
	hasExecuted: boolean;
};

function BranchGroup({ label, branchType, steps, resultMap, pathPrefix, hasExecuted }: BranchGroupProps) {
	const [expanded, setExpanded] = useState(hasExecuted);
	const borderCls = BRANCH_BORDER[branchType] ?? BRANCH_BORDER.btn;
	const labelCls = BRANCH_LABEL_COLOR[branchType] ?? BRANCH_LABEL_COLOR.btn;

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
					<span className="ml-1 text-muted-foreground/50">未执行</span>
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
	const phaseLabel: Record<string, string> = {
		thinking: 'AI 思考中...',
		tool_calling: '调用工具',
		tool_result: '工具执行完成',
		complete: '完成',
	};
	return (
		<div className="mt-1.5 space-y-1.5 text-xs border-l-2 border-blue-500/40 pl-2.5 ml-1">
			<div className="text-muted-foreground flex items-center gap-1.5">
				{detail.phase === 'thinking' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
				<span>轮次 {detail.round}/{detail.maxRounds}</span>
				<span className="text-muted-foreground/60">— {phaseLabel[detail.phase] ?? detail.phase}</span>
			</div>
			{detail.thinking && (
				<div className="bg-muted/30 rounded px-2 py-1.5 text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
					{detail.thinking}
				</div>
			)}
			{detail.toolCalls?.map((tc, i) => (
				<div key={`${tc.name}-${i}`} className="flex items-start gap-1.5 py-0.5">
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
	const aiDetail = isAiStep && result?.status === 'running' && liveAiDetail?.stepIndex === result.index
		? liveAiDetail.detail
		: null;

	return (
		<div className="py-1 px-1.5 rounded-md bg-muted/40 text-sm">
			<div className="flex items-start gap-2">
				<StepStatusIcon status={result?.status ?? 'pending'} />
				<div className="flex-1 min-w-0">
					<span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mr-2">
						{step.kind}
					</span>
					<StepSummary step={step} />
					{result?.output && (
						<p
							className="text-xs text-muted-foreground mt-0.5 truncate cursor-pointer hover:text-foreground"
							title={result.output}
							onClick={() => {
								void navigator.clipboard.writeText(result.output!);
							}}
						>
							{result.output.slice(0, 120)}
							{result.output.length > 120 ? '…' : ''}
						</p>
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
						<div key={i}>
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
						<div key={i}>
							<StepRow step={step} result={result} />
							<div className="ml-2">
								{step.button_branches.map((branch, bi) => {
									const btnLabel = buttons[bi]?.text ?? `按钮 ${bi + 1}`;
									const btnHasResult = branch.some((_, si) => {
										const p = [...currentPath, si].join('.');
										return resultMap.has(p);
									});
									return (
										<BranchGroup
											key={bi}
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
						<div key={i}>
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
				return <StepRow key={i} step={step} result={result} />;
			})}
		</div>
	);
}
