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

export type ParsedCanvasData = {
	positions: PositionsMap;
	edges: Edge[];
	edgesFromSave: boolean;
	startEdgeTarget?: string | null;
	orphanedSteps?: ScriptStep[];
};

type StoredCanvasData = {
	positions: PositionsMap;
	edges: StoredEdge[];
	startEdgeTarget: string | null;
	orphanedSteps?: ScriptStep[];
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
): ParsedCanvasData {
	if (!json) return { positions: {}, edges: buildDefaultEdges(stepCount), edgesFromSave: false };
	try {
		const parsed = JSON.parse(json) as Record<string, unknown>;
		if ('positions' in parsed || 'edges' in parsed || 'startEdgeTarget' in parsed) {
			// 新格式：{ positions: {...}, edges: [...] }
			const positions = (parsed.positions ?? {}) as PositionsMap;
			const edges = ((parsed.edges ?? []) as StoredEdge[]).map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
				type: 'smoothstep',
				...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
			}));
			const startEdgeTarget =
				typeof parsed.startEdgeTarget === 'string'
					? parsed.startEdgeTarget
					: parsed.startEdgeTarget === null
						? null
						: undefined;
			const orphanedSteps = Array.isArray(parsed.orphanedSteps)
				? (parsed.orphanedSteps as ScriptStep[])
				: undefined;
			return { positions, edges, edgesFromSave: true, startEdgeTarget, orphanedSteps };
		}
		// 旧格式：直接是 { 'step-0': {x,y}, ... }
		return {
			positions: parsed as PositionsMap,
			edges: buildDefaultEdges(stepCount),
			edgesFromSave: false,
		};
	} catch {
		return { positions: {}, edges: buildDefaultEdges(stepCount), edgesFromSave: false };
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

// ─── 嵌套控制流树→图展平 ──────────────────────────────────────────────────────

/**
 * 将嵌套控制流树还原为扁平节点+边（resolveControlFlowGraph 的逆操作）。
 * 从后端加载脚本时调用，将 then_steps/else_steps/body_steps 展开为独立画布节点。
 *
 * 算法：DFS 遍历嵌套步骤树，将每个步骤推入扁平数组并生成对应边。
 * 条件节点生成带 sourceHandle 的分叉边，两条分支的出口节点都连接到后续步骤。
 * 循环节点的 body 出口不连接后续（循环体隐式回到 loop 节点）。
 *
 * 时间复杂度：O(N)，N 为全部步骤总数（含嵌套）
 * 空间复杂度：O(N)
 *
 * @param nestedSteps - 后端返回的嵌套步骤树
 * @returns 扁平步骤数组和对应边列表
 */
export function flattenControlFlowTree(
	nestedSteps: ScriptStep[],
): { flatSteps: ScriptStep[]; edges: Edge[] } {
	const flatSteps: ScriptStep[] = [];
	const edges: Edge[] = [];

	/**
	 * 处理一条步骤链，返回"出口"节点索引列表。
	 * 出口节点 = 需要通过 default handle 连接到后续步骤的节点。
	 */
	function processChain(steps: ScriptStep[]): number[] {
		let pendingConnections: number[] = [];

		for (const step of steps) {
			const currentIdx = flatSteps.length;

			// 将上一步的出口节点通过 default handle 连接到当前节点
			for (const fromIdx of pendingConnections) {
				edges.push({
					id: `e-${fromIdx}-${currentIdx}`,
					source: `step-${fromIdx}`,
					target: `step-${currentIdx}`,
					type: 'smoothstep',
				});
			}

			if (step.kind === 'condition') {
				// 条件节点：清空嵌套子步骤后加入扁平数组
				flatSteps.push({ ...step, then_steps: [], else_steps: [] });
				const exitIndices: number[] = [];

				// 展平 then 分支
				if (step.then_steps.length > 0) {
					const thenFirstIdx = flatSteps.length;
					edges.push({
						id: `e-${currentIdx}-${thenFirstIdx}-then`,
						source: `step-${currentIdx}`,
						target: `step-${thenFirstIdx}`,
						sourceHandle: 'then',
						type: 'smoothstep',
					});
					exitIndices.push(...processChain(step.then_steps));
				}

				// 展平 else 分支
				if (step.else_steps && step.else_steps.length > 0) {
					const elseFirstIdx = flatSteps.length;
					edges.push({
						id: `e-${currentIdx}-${elseFirstIdx}-else`,
						source: `step-${currentIdx}`,
						target: `step-${elseFirstIdx}`,
						sourceHandle: 'else',
						type: 'smoothstep',
					});
					exitIndices.push(...processChain(step.else_steps));
				}

				// 条件步骤执行完任一分支后，都会继续执行后续主流程。
				// 因此画布中显式保留一条 default continuation 边，避免仅靠“分支汇合点推断”导致错序。
				pendingConnections = [currentIdx, ...exitIndices];
			} else if (step.kind === 'confirm_dialog' && step.button_branches && step.button_branches.length > 0) {
				// 弹窗分支节点：清空 button_branches 后加入扁平数组
				flatSteps.push({ ...step, button_branches: [] });
				const exitIndices: number[] = [];

				for (let bi = 0; bi < step.button_branches.length; bi++) {
					const branch = step.button_branches[bi];
					if (branch.length > 0) {
						const branchFirstIdx = flatSteps.length;
						edges.push({
							id: `e-${currentIdx}-${branchFirstIdx}-btn_${bi}`,
							source: `step-${currentIdx}`,
							target: `step-${branchFirstIdx}`,
							sourceHandle: `btn_${bi}`,
							type: 'smoothstep',
						});
						exitIndices.push(...processChain(branch));
					}
				}

				// confirm_dialog 的按钮分支执行后仍会回到后续主流程；
				// 对空分支同样需要保留 continuation，因此保留当前节点本身作为出口。
				pendingConnections = [currentIdx, ...exitIndices];
			} else if (step.kind === 'loop') {
				// 循环节点：清空 body_steps 后加入扁平数组
				flatSteps.push({ ...step, body_steps: [] });

				// 展平 body 分支
				if (step.body_steps.length > 0) {
					const bodyFirstIdx = flatSteps.length;
					edges.push({
						id: `e-${currentIdx}-${bodyFirstIdx}-body`,
						source: `step-${currentIdx}`,
						target: `step-${bodyFirstIdx}`,
						sourceHandle: 'body',
						type: 'smoothstep',
					});
					processChain(step.body_steps);
					// body 出口不连接后续（循环体隐式回到 loop 节点）
				}

				// loop 自身通过 default handle 连接后续步骤
				pendingConnections = [currentIdx];
			} else {
				flatSteps.push(step);
				pendingConnections = [currentIdx];
			}
		}

		return pendingConnections;
	}

	processChain(nestedSteps);
	return { flatSteps, edges };
}

// ─── 图→嵌套控制流树转换 ──────────────────────────────────────────────────────

/** 解析后的边信息：source index → Map<handle|null, target index[]> */
type HandleEdgeMap = Map<number, Map<string | null, number[]>>;

/**
 * 构建带 sourceHandle 信息的邻接表。
 * 每个源节点按 sourceHandle 分拣到不同的目标。
 *
 * @param edges - ReactFlow 边列表
 * @param n - 步骤总数（用于范围校验）
 * @returns source → (handle → target) 映射
 */
function buildHandleEdgeMap(edges: Edge[], n: number): HandleEdgeMap {
	const map: HandleEdgeMap = new Map();
	for (const edge of edges) {
		const si = parseInt(edge.source.replace('step-', ''), 10);
		const ti = parseInt(edge.target.replace('step-', ''), 10);
		if (isNaN(si) || isNaN(ti) || si >= n || ti >= n) continue;
		if (!map.has(si)) map.set(si, new Map());
		const handle = edge.sourceHandle ?? null;
		const byHandle = map.get(si)!;
		const targets = byHandle.get(handle) ?? [];
		targets.push(ti);
		targets.sort((a, b) => a - b);
		byHandle.set(handle, targets);
	}
	return map;
}

function getFirstHandleTarget(
	handles: Map<string | null, number[]> | undefined,
	handle: string | null,
): number {
	if (!handles) return -1;
	const targets = handles.get(handle);
	if (!targets || targets.length === 0) return -1;
	return targets[0];
}

function distanceFrom(start: number, edgeMap: HandleEdgeMap): Map<number, number> {
	const distances = new Map<number, number>();
	if (start < 0) return distances;

	const queue: number[] = [start];
	distances.set(start, 0);

	while (queue.length > 0) {
		const cur = queue.shift()!;
		const curDist = distances.get(cur) ?? 0;
		const handles = edgeMap.get(cur);
		if (!handles) continue;
		for (const targets of handles.values()) {
			for (const target of targets) {
				if (distances.has(target)) continue;
				distances.set(target, curDist + 1);
				queue.push(target);
			}
		}
	}

	return distances;
}

/**
 * 找到多个起点共同可达的最近公共后继。
 * 优先按图距离最小排序，距离相同时再按 index 稳定排序。
 */
function findNearestSharedSuccessor(
	starts: number[],
	edgeMap: HandleEdgeMap,
): number {
	const validStarts = [...new Set(starts.filter((start) => start >= 0))];
	if (validStarts.length < 2) return -1;

	const distanceMaps = validStarts.map((start) => distanceFrom(start, edgeMap));
	const candidates: Array<{ node: number; maxDistance: number; totalDistance: number }> = [];

	for (const [node, distance] of distanceMaps[0].entries()) {
		if (validStarts.includes(node)) continue;
		let maxDistance = distance;
		let totalDistance = distance;
		let shared = true;
		for (let i = 1; i < distanceMaps.length; i++) {
			const nextDistance = distanceMaps[i].get(node);
			if (nextDistance === undefined) {
				shared = false;
				break;
			}
			maxDistance = Math.max(maxDistance, nextDistance);
			totalDistance += nextDistance;
		}
		if (shared) {
			candidates.push({ node, maxDistance, totalDistance });
		}
	}

	if (candidates.length === 0) return -1;

	candidates.sort((left, right) => {
		if (left.maxDistance !== right.maxDistance) {
			return left.maxDistance - right.maxDistance;
		}
		if (left.totalDistance !== right.totalDistance) {
			return left.totalDistance - right.totalDistance;
		}
		return left.node - right.node;
	});

	return candidates[0].node;
}

function getConfirmBranchCount(
	step: ScriptStep,
	handles: Map<string | null, number[]> | undefined,
): number {
	let maxHandleIndex = -1;
	for (const handle of handles?.keys() ?? []) {
		if (!handle || !handle.startsWith('btn_')) continue;
		const rawIndex = Number.parseInt(handle.slice(4), 10);
		if (!Number.isNaN(rawIndex)) {
			maxHandleIndex = Math.max(maxHandleIndex, rawIndex);
		}
	}

	if (step.kind === 'confirm_dialog' && step.button_branches && step.button_branches.length > 0) {
		return Math.max(step.button_branches.length, maxHandleIndex + 1);
	}

	return maxHandleIndex + 1;
}

export type SerializedCanvasGraph = {
	nestedSteps: ScriptStep[];
	flatSteps: ScriptStep[];
	orderedIds: string[];
	remappedEdges: Edge[];
	remappedPositions: PositionsMap;
	orphanedCount: number;
	orphanedSteps: ScriptStep[];
};

function remapEdgesToOrderedIds(edges: Edge[], orderedIds: string[]): Edge[] {
	const nextIndexByOldId = new Map(
		orderedIds.map((oldId, newIndex) => [oldId, newIndex] as const),
	);

	return edges
		.map((edge) => {
			const nextSourceIndex = nextIndexByOldId.get(edge.source);
			const nextTargetIndex = nextIndexByOldId.get(edge.target);
			if (nextSourceIndex === undefined || nextTargetIndex === undefined) {
				return null;
			}

			const suffix = edge.sourceHandle ? `-${edge.sourceHandle}` : '';
			return {
				...edge,
				id: `e-${nextSourceIndex}-${nextTargetIndex}${suffix}`,
				source: `step-${nextSourceIndex}`,
				target: `step-${nextTargetIndex}`,
			};
		})
		.filter((edge): edge is Edge => edge !== null);
}

/**
 * 将当前画布图序列化为稳定的嵌套树，并同步产出 canonical 顺序下的节点/边/位置。
 * 顺序规则与 flattenControlFlowTree 完全镜像，保证 graph -> tree -> graph 可幂等。
 */
export function serializeControlFlowGraph(
	steps: ScriptStep[],
	edges: Edge[],
	positions: PositionsMap,
	primaryRootId?: string | null,
): SerializedCanvasGraph {
	const n = steps.length;
	if (n === 0) {
		return {
			nestedSteps: [],
			flatSteps: [],
			orderedIds: [],
			remappedEdges: [],
			remappedPositions: {},
			orphanedCount: 0,
			orphanedSteps: [],
		};
	}

	const edgeMap = buildHandleEdgeMap(edges, n);
	const inDegree = new Map<number, number>();
	for (let i = 0; i < n; i++) {
		inDegree.set(i, 0);
	}
	for (const edge of edges) {
		const ti = parseInt(edge.target.replace('step-', ''), 10);
		if (!Number.isNaN(ti) && ti >= 0 && ti < n) {
			inDegree.set(ti, (inDegree.get(ti) ?? 0) + 1);
		}
	}

	const visited = new Set<number>();
	const orderedIds: string[] = [];

	function collectChain(startIdx: number, stopAt: number): ScriptStep[] {
		const result: ScriptStep[] = [];
		let cur = startIdx;

		while (cur >= 0 && cur < n && cur !== stopAt && !visited.has(cur)) {
			visited.add(cur);
			orderedIds.push(`step-${cur}`);
			const step = steps[cur];
			const handles = edgeMap.get(cur);

			if (step.kind === 'condition') {
				const thenTarget = getFirstHandleTarget(handles, 'then');
				const elseTarget = getFirstHandleTarget(handles, 'else');
				const nextTarget = getFirstHandleTarget(handles, null);
				const continuation =
					nextTarget >= 0
						? nextTarget
						: findNearestSharedSuccessor([thenTarget, elseTarget], edgeMap);

				const thenSteps = thenTarget >= 0 ? collectChain(thenTarget, continuation) : [];
				const elseSteps = elseTarget >= 0 ? collectChain(elseTarget, continuation) : [];

				result.push({
					...step,
					then_steps: thenSteps,
					else_steps: elseSteps,
				});

				cur = continuation;
				continue;
			}

			if (step.kind === 'confirm_dialog') {
				const branchCount = getConfirmBranchCount(step, handles);
				if (branchCount > 0) {
					const nextTarget = getFirstHandleTarget(handles, null);
					const branchTargets = Array.from(
						{ length: branchCount },
						(_, index) => getFirstHandleTarget(handles, `btn_${index}`),
					);
					const continuation =
						nextTarget >= 0
							? nextTarget
							: findNearestSharedSuccessor(
									branchTargets.filter((target) => target >= 0),
									edgeMap,
							  );
					const buttonBranches = branchTargets.map((target) =>
						target >= 0 ? collectChain(target, continuation) : [],
					);

					result.push({
						...step,
						button_branches: buttonBranches,
					});

					cur = continuation;
					continue;
				}
			}

			if (step.kind === 'loop') {
				const bodyTarget = getFirstHandleTarget(handles, 'body');
				const nextTarget = getFirstHandleTarget(handles, null);
				const bodySteps =
					bodyTarget >= 0 ? collectChain(bodyTarget, cur) : [];

				result.push({
					...step,
					body_steps: bodySteps,
				});

				cur = nextTarget;
				continue;
			}

			result.push(step);
			cur = getFirstHandleTarget(handles, null);
		}

		return result;
	}

	const primaryRootIndex =
		typeof primaryRootId === 'string' && primaryRootId.startsWith('step-')
			? Number.parseInt(primaryRootId.replace('step-', ''), 10)
			: -1;
	const rootIndices = Array.from({ length: n }, (_, index) => index).filter(
		(index) => (inDegree.get(index) ?? 0) === 0,
	);
	rootIndices.sort((left, right) => {
		if (left === primaryRootIndex) return -1;
		if (right === primaryRootIndex) return 1;
		return left - right;
	});

	// 仅从 Start 连接的主根节点开始收集可达步骤（执行路径）
	const nestedSteps: ScriptStep[] = [];
	if (primaryRootIndex >= 0 && !visited.has(primaryRootIndex)) {
		nestedSteps.push(...collectChain(primaryRootIndex, -1));
	}

	// 其余根节点和不可达节点归为孤立步骤（不参与执行，仅保留在 canvas 中）
	const orphanedSteps: ScriptStep[] = [];
	for (const root of rootIndices) {
		if (visited.has(root)) continue;
		orphanedSteps.push(...collectChain(root, -1));
	}
	for (let index = 0; index < n; index++) {
		if (visited.has(index)) continue;
		orphanedSteps.push(...collectChain(index, -1));
	}
	const orphanedCount = orphanedSteps.length;

	const flatSteps = orderedIds.map((oldId) => {
		const oldIndex = Number.parseInt(oldId.replace('step-', ''), 10);
		return steps[oldIndex];
	});
	const remappedEdges = remapEdgesToOrderedIds(edges, orderedIds);
	const remappedPositions: PositionsMap = {};
	orderedIds.forEach((oldId, newIndex) => {
		const position = positions[oldId];
		if (!position) return;
		remappedPositions[`step-${newIndex}`] = position;
	});

	return {
		nestedSteps,
		flatSteps,
		orderedIds,
		remappedEdges,
		remappedPositions,
		orphanedCount,
		orphanedSteps,
	};
}

/**
 * 将画布 DAG 图转换为正确嵌套的步骤树。
 * 处理 Condition 节点的 then_steps/else_steps 和 Loop 节点的 body_steps。
 *
 * 核心逻辑：以 DFS 方式从起始节点遍历图，遇到 Condition/Loop 节点时
 * 递归收集其子图步骤，正确填入嵌套数组后继续主流程。
 *
 * 时间复杂度：O(V + E)
 * 空间复杂度：O(V)
 *
 * @param steps - 平铺步骤列表（step index 与画布节点 ID 对应）
 * @param edges - 画布边列表
 * @returns 正确嵌套的步骤数组
 */
export function resolveControlFlowGraph(
	steps: ScriptStep[],
	edges: Edge[],
): ScriptStep[] {
	return serializeControlFlowGraph(steps, edges, {}).nestedSteps;
}

// ─── Start Node Helpers ──────────────────────────────────────────────────────

export const START_NODE_ID = 'start';

/** 默认起点节点位置：在第一个步骤左上方 */
export function defaultStartPosition(positions: PositionsMap): { x: number; y: number } {
	const firstPos = positions['step-0'];
	return firstPos
		? { x: firstPos.x + 60, y: firstPos.y - 100 }
		: { x: 180, y: 20 };
}

/** 创建起点节点对象 */
export function buildStartNode(position: { x: number; y: number }): Node {
	return {
		id: START_NODE_ID,
		type: 'start',
		position,
		data: {},
		deletable: false,
		selectable: false,
		draggable: true,
	};
}

/** 创建起点到第一个根节点的边 */
export function buildStartEdge(rootStepId: string): Edge {
	return {
		id: `e-start-${rootStepId}`,
		source: START_NODE_ID,
		target: rootStepId,
		type: 'smoothstep',
		deletable: true,
	};
}

export function getStartEdgeTarget(edges: Edge[]): string | null {
	return edges.find((edge) => edge.source === START_NODE_ID)?.target ?? null;
}

/** 从边数组中移除起点相关边（保存前调用） */
export function stripStartEdges(edges: Edge[]): Edge[] {
	return edges.filter(
		(e) => e.source !== START_NODE_ID && e.target !== START_NODE_ID,
	);
}

export function buildCanvasDataJson(
	positions: PositionsMap,
	edges: Edge[],
	orphanedSteps?: ScriptStep[],
): string {
	const stepEdges = stripStartEdges(edges);
	const payload: StoredCanvasData = {
		positions,
		edges: stepEdges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandle ?? null,
		})),
		startEdgeTarget: getStartEdgeTarget(edges),
		...(orphanedSteps && orphanedSteps.length > 0 ? { orphanedSteps } : {}),
	};
	return JSON.stringify(payload);
}

/** 找到第一个入度为 0 的步骤节点 ID */
export function findRootStepId(edges: Edge[], stepCount: number): string | null {
	if (stepCount === 0) return null;
	const inDeg = new Set<string>();
	for (const e of edges) {
		if (e.source !== START_NODE_ID) inDeg.add(e.target);
	}
	for (let i = 0; i < stepCount; i++) {
		if (!inDeg.has(`step-${i}`)) return `step-${i}`;
	}
	return 'step-0';
}
