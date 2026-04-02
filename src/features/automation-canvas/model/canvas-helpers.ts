/**
 * canvas-helpers.ts
 * 画布相关的纯工具函数，不包含任何 React/JSX 依赖。
 * 包含：节点构建、边构建、画布数据解析、拓扑排序。
 */

import { Position, type Edge, type Node } from '@xyflow/react';

import type { ScriptStep } from '@/entities/automation/model/types';

import type { StepNodeData } from '../ui/step-node';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

/** 节点位置映射：node-id → {x, y} */
export type PositionsMap = Record<string, { x: number; y: number }>;

/**
 * 持久化到 DB 的边数据格式（精简版，去除 ReactFlow 运行时字段）
 */
export type StoredEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
};

// ─── 节点构建 ──────────────────────────────────────────────────────────────────

/**
 * 根据步骤列表、位置映射和运行时状态，构建 ReactFlow Node 数组。
 *
 * @param steps - 脚本步骤列表
 * @param positions - 节点位置映射（node-id → {x, y}）
 * @param liveStatuses - 运行时步骤状态（step index → status string）
 * @returns ReactFlow Node 数组
 */
export function buildNodes(
	steps: ScriptStep[],
	positions: PositionsMap,
	liveStatuses: Record<number, string>,
): Node[] {
	return steps.map((step, i) => {
		const id = `step-${i}`;
		// 若无已保存位置，则纵向排列（默认 x=120, y=i*120+60）
		const pos = positions[id] ?? { x: 120, y: i * 120 + 60 };
		return {
			id,
			type: 'step',
			position: pos,
			sourcePosition: Position.Bottom,
			targetPosition: Position.Top,
			data: { step, index: i, stepStatus: liveStatuses[i] } as StepNodeData,
		};
	});
}

// ─── 边构建 ────────────────────────────────────────────────────────────────────

/**
 * 为连续的步骤序列生成默认顺序边（0→1, 1→2, ...）。
 * 用于首次加载或无持久化边数据时的回退。
 *
 * @param count - 步骤总数
 * @returns Edge 数组（smoothstep 类型）
 */
export function buildDefaultEdges(count: number): Edge[] {
	return Array.from({ length: count - 1 }, (_, i) => ({
		id: `e-${i}-${i + 1}`,
		source: `step-${i}`,
		target: `step-${i + 1}`,
		type: 'smoothstep',
	}));
}

// ─── 画布数据解析 ──────────────────────────────────────────────────────────────

/**
 * 解析 DB 中存储的 canvasPositionsJson 字段，提取节点位置和边。
 * 支持两种格式：
 * - 新格式：`{ positions: {...}, edges: [...] }`
 * - 旧格式（向前兼容）：直接是 `{ 'step-0': {x,y}, ... }`
 *
 * @param json - JSON 字符串（可为 null）
 * @param stepCount - 步骤总数，用于生成回退边
 * @returns 解析后的位置映射和边数组
 */
export function parseCanvasData(
	json: string | null,
	stepCount: number,
): { positions: PositionsMap; edges: Edge[] } {
	if (!json) return { positions: {}, edges: buildDefaultEdges(stepCount) };
	try {
		const parsed = JSON.parse(json) as Record<string, unknown>;
		if ('positions' in parsed || 'edges' in parsed) {
			// 新格式：{ positions: {...}, edges: [...] }
			const positions = (parsed.positions ?? {}) as PositionsMap;
			const edges = ((parsed.edges ?? []) as StoredEdge[]).map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
				type: 'smoothstep',
				...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
			}));
			return { positions, edges };
		}
		// 旧格式：直接是 { 'step-0': {x,y}, ... }
		return {
			positions: parsed as PositionsMap,
			edges: buildDefaultEdges(stepCount),
		};
	} catch {
		return { positions: {}, edges: buildDefaultEdges(stepCount) };
	}
}

// ─── 拓扑排序 ──────────────────────────────────────────────────────────────────

/**
 * 根据画布边对 steps 进行拓扑排序（Kahn's BFS 算法）。
 * 用于在保存时保证步骤顺序与画布连线顺序一致。
 * - 有环或孤立节点会被追加到末尾
 * - 同一层级的节点按原始 index 升序排列（稳定排序）
 *
 * 时间复杂度：O(V + E)，V 为步骤数，E 为边数
 * 空间复杂度：O(V + E)
 *
 * @param steps - 当前步骤列表
 * @param edges - 当前画布边列表
 * @returns 重排后的步骤数组、旧 index → 新 index 映射、孤立节点数量
 */
export function topologySortSteps(
	steps: ScriptStep[],
	edges: Edge[],
): {
	reorderedSteps: ScriptStep[];
	indexMap: Map<number, number>; // oldIndex → newIndex
	orphanedCount: number;
} {
	const n = steps.length;
	if (n === 0)
		return { reorderedSteps: [], indexMap: new Map(), orphanedCount: 0 };

	// 构建邻接表和入度表
	const adj = new Map<number, number[]>(); // source → targets
	const inDegree = new Map<number, number>();
	for (let i = 0; i < n; i++) {
		adj.set(i, []);
		inDegree.set(i, 0);
	}

	// 从 edges 解析 source/target index
	for (const edge of edges) {
		const si = parseInt(edge.source.replace('step-', ''), 10);
		const ti = parseInt(edge.target.replace('step-', ''), 10);
		if (isNaN(si) || isNaN(ti) || si >= n || ti >= n) continue;
		adj.get(si)?.push(ti);
		inDegree.set(ti, (inDegree.get(ti) ?? 0) + 1);
	}

	// BFS 拓扑排序（Kahn's algorithm）
	const queue: number[] = [];
	for (let i = 0; i < n; i++) {
		if ((inDegree.get(i) ?? 0) === 0) queue.push(i);
	}

	const order: number[] = [];
	const visited = new Set<number>();
	while (queue.length > 0) {
		// 取最小 index 的根节点（保证稳定排序）
		queue.sort((a, b) => a - b);
		const cur = queue.shift()!;
		order.push(cur);
		visited.add(cur);
		for (const next of adj.get(cur) ?? []) {
			const newDeg = (inDegree.get(next) ?? 0) - 1;
			inDegree.set(next, newDeg);
			if (newDeg === 0) queue.push(next);
		}
	}

	// 未被访问的节点（孤立或有环）追加到末尾
	const unvisited: number[] = [];
	for (let i = 0; i < n; i++) {
		if (!visited.has(i)) unvisited.push(i);
	}
	const finalOrder = [...order, ...unvisited];

	// 构建映射和重排数组
	const indexMap = new Map<number, number>();
	finalOrder.forEach((oldIdx, newIdx) => indexMap.set(oldIdx, newIdx));
	const reorderedSteps = finalOrder.map((i) => steps[i]);

	return { reorderedSteps, indexMap, orphanedCount: unvisited.length };
}
