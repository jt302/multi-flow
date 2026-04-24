/**
 * step-node.tsx
 * ReactFlow 自定义节点组件，用于渲染单个自动化步骤节点。
 * 包含：运行状态环样式、连接点样式、节点组件、以及 NODE_TYPES 映射。
 */

import { Handle, Position } from '@xyflow/react';
import i18next from 'i18next';
import { memo } from 'react';

import type { StepNodeData, StepNodeSourceHandle } from '../model/canvas-node-data';

export type { StepNodeData } from '../model/canvas-node-data';

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

/** 仅供内部 continuation 连线使用的隐藏 Handle */
const HIDDEN_HANDLE_STYLE = {
	left: '50%',
	opacity: 0,
	pointerEvents: 'none' as const,
};

// ─── 起点节点 ─────────────────────────────────────────────────────────────────

/** 虚拟起点节点 — 标识流程入口，不参与步骤数组 */
const StartNodeComponent = memo(function StartNodeComponent() {
	return (
		<div className="flex items-center gap-2 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 px-4 py-2 shadow-sm">
			<div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
			<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
				{i18next.t('automation:canvas.start')}
			</span>
			<Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
		</div>
	);
});
StartNodeComponent.displayName = 'StartNodeComponent';

// ─── 步骤节点 ──────────────────────────────────────────────────────────────────
/**
 * 自定义 ReactFlow 节点，渲染一个步骤卡片。
 */
function resolveHandleStyle(handle: StepNodeSourceHandle) {
	if (handle.hidden) {
		return {
			...HIDDEN_HANDLE_STYLE,
			...(handle.left ? { left: handle.left } : {}),
		};
	}

	if (handle.left) {
		return { left: handle.left };
	}

	return undefined;
}

export const StepNodeComponent = memo(function StepNodeComponent({
	data,
	selected,
}: {
	data: StepNodeData;
	selected?: boolean;
}) {
	const {
		label,
		groupLabel,
		groupColorClass,
		accentClass,
		summary,
		stepStatus,
		concurrentCount,
		isTerminal,
		sourceHandles,
		footerLabels,
	} = data;
	const ringClass = stepStatus ? (STEP_STATUS_RING[stepStatus] ?? '') : '';
	const selectedClass = selected
		? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background'
		: '';

	return (
		<div
			className={`relative min-w-[160px] max-w-[240px] rounded-lg border border-border/50 bg-card shadow-sm cursor-pointer transition-shadow hover:shadow-md border-l-[3px] ${accentClass} ${selectedClass} ${ringClass} ${isTerminal ? '!border-l-red-500 bg-red-500/5' : ''}`}
		>
			<Handle type="target" position={Position.Top} className={HANDLE_CLS} />
			{/* 并发 profile 角标：多个 profile 同时执行此节点时显示数量 */}
			{concurrentCount != null && concurrentCount > 1 && (
				<span className="absolute -top-2 -right-2 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white shadow">
					{concurrentCount > 9 ? '9+' : concurrentCount}
				</span>
			)}
			<div className="px-3 py-2">
				<div className="flex items-center gap-1.5 mb-0.5">
					<span className={`text-[9px] font-semibold px-1 rounded ${groupColorClass}`}>
						{groupLabel}
					</span>
				</div>
				<div className="text-[11px] font-bold truncate leading-tight">{label}</div>
				{summary && (
					<div className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono opacity-70">
						{summary}
					</div>
				)}
			</div>
			{footerLabels.length > 0 && (
				<div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground select-none px-1">
					{footerLabels.map((footerLabel) => (
						<span key={footerLabel} className="truncate max-w-[50px] text-center flex-1">
							{footerLabel}
						</span>
					))}
				</div>
			)}
			{sourceHandles.length > 0 ? (
				sourceHandles.map((handle) => (
					<Handle
						key={`${handle.id ?? 'default'}-${handle.left ?? 'center'}-${handle.hidden ? 'hidden' : 'visible'}`}
						type="source"
						position={Position.Bottom}
						id={handle.id ?? undefined}
						style={resolveHandleStyle(handle)}
						className={HANDLE_CLS}
					/>
				))
			) : isTerminal ? null : (
				<>
					<div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground select-none">
						<span className="pl-3" />
						<span className="pr-3" />
					</div>
					<Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
				</>
			)}
		</div>
	);
});
StepNodeComponent.displayName = 'StepNodeComponent';

// ─── NODE_TYPES ────────────────────────────────────────────────────────────────
/**
 * ReactFlow nodeTypes 映射，传给 <ReactFlow nodeTypes={NODE_TYPES} />
 * 将 "step" 类型节点映射到 StepNodeComponent。
 */
export const NODE_TYPES = {
	step: StepNodeComponent,
	start: StartNodeComponent,
};
