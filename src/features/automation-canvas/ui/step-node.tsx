/**
 * step-node.tsx
 * ReactFlow 自定义节点组件，用于渲染单个自动化步骤节点。
 * 包含：运行状态环样式、连接点样式、节点数据类型定义、节点组件、以及 NODE_TYPES 映射。
 */

import { Handle, Position } from '@xyflow/react';

import type { ScriptStep } from '@/entities/automation/model/types';
import {
	GROUP_COLORS,
	KIND_GROUPS,
	KIND_LABELS,
	getStepSummaryText,
} from '@/entities/automation/model/step-registry';

// ─── 运行状态高亮环 ────────────────────────────────────────────────────────────
/** 步骤运行状态 → Tailwind ring class 映射 */
export const STEP_STATUS_RING: Record<string, string> = {
	running: 'ring-2 ring-blue-500 ring-offset-1',
	success: 'ring-2 ring-green-500 ring-offset-1',
	failed: 'ring-2 ring-red-500 ring-offset-1',
	waiting_human: 'ring-2 ring-amber-400 ring-offset-1 animate-pulse',
};

// ─── 连接点样式 ────────────────────────────────────────────────────────────────
/** ReactFlow Handle 的公共样式类名 */
export const HANDLE_CLS =
	'!w-2.5 !h-2.5 !bg-muted-foreground/40 hover:!bg-primary !border-0 !rounded-full';

// ─── 节点数据类型 ──────────────────────────────────────────────────────────────
/** ReactFlow 节点的 data 字段类型 */
export type StepNodeData = {
	step: ScriptStep;
	index: number;
	stepStatus?: string;
};

// ─── 节点组件 ──────────────────────────────────────────────────────────────────
/**
 * 自定义 ReactFlow 节点，渲染一个步骤卡片。
 * - condition 步骤会渲染两个底部 Handle（then / else）
 * - 其余步骤渲染单个底部 Handle
 */
export function StepNodeComponent({
	data,
	selected,
}: {
	data: StepNodeData;
	selected?: boolean;
}) {
	const { step, index, stepStatus } = data;
	const kind = step.kind;
	const label = KIND_LABELS[kind] ?? kind;
	const group = KIND_GROUPS[kind] ?? '通用';
	const colorClass = GROUP_COLORS[group] ?? GROUP_COLORS['通用'];
	const ringClass = stepStatus ? (STEP_STATUS_RING[stepStatus] ?? '') : '';
	const selectedClass = selected ? 'ring-2 ring-primary ring-offset-2' : '';
	const summary = getStepSummaryText(step);
	const isCondition = kind === 'condition';

	return (
		<div
			className={`relative min-w-[160px] max-w-[220px] rounded-lg border bg-background shadow-sm px-3 py-2 cursor-pointer ${selectedClass} ${ringClass}`}
		>
			<Handle type="target" position={Position.Top} className={HANDLE_CLS} />
			<div className="flex items-center gap-1.5 mb-1">
				<span className="text-[10px] text-muted-foreground font-mono">
					#{index + 1}
				</span>
				<span
					className={`text-[10px] font-medium px-1 rounded border ${colorClass}`}
				>
					{group}
				</span>
			</div>
			<div className="text-xs font-semibold truncate">{label}</div>
			{summary && (
				<div className="text-[10px] text-muted-foreground truncate mt-0.5">
					{summary}
				</div>
			)}
			{isCondition ? (
				<>
					<div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground select-none">
						<span className="pl-3">then</span>
						<span className="pr-3">else</span>
					</div>
					<Handle
						type="source"
						position={Position.Bottom}
						id="then"
						style={{ left: '30%' }}
						className={HANDLE_CLS}
					/>
					<Handle
						type="source"
						position={Position.Bottom}
						id="else"
						style={{ left: '70%' }}
						className={HANDLE_CLS}
					/>
				</>
			) : (
				<Handle
					type="source"
					position={Position.Bottom}
					className={HANDLE_CLS}
				/>
			)}
		</div>
	);
}

// ─── NODE_TYPES ────────────────────────────────────────────────────────────────
/**
 * ReactFlow nodeTypes 映射，传给 <ReactFlow nodeTypes={NODE_TYPES} />
 * 将 "step" 类型节点映射到 StepNodeComponent。
 */
export const NODE_TYPES = { step: StepNodeComponent };
