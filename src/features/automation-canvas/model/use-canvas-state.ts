/**
 * use-canvas-state.ts
 * 画布核心状态 Hook，封装所有与脚本步骤、节点、边相关的状态和操作。
 * 用于 InnerCanvas 组件，将业务逻辑从 UI 层中分离。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Position, addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import { toast } from 'sonner';

import type {
	AutomationScript,
	ScriptStep,
	ScriptVarDef,
	ScriptSettings,
} from '@/entities/automation/model/types';
import {
	emitScriptUpdated,
	saveAutomationCanvasGraph,
	updateScriptCanvasPositions,
} from '@/entities/automation/api/automation-api';
import { defaultStep, KIND_LABELS } from '@/entities/automation/model/step-registry';

import type { StepNodeData } from '../ui/step-node';
import {
	buildCanvasDataJson,
	buildNodes,
	buildStartEdge,
	buildStartNode,
	defaultStartPosition,
	findRootStepId,
	flattenControlFlowTree,
	getStartEdgeTarget,
	parseCanvasData,
	serializeControlFlowGraph,
	START_NODE_ID,
	stripStartEdges,
} from './canvas-helpers';
import type { PositionsMap } from './canvas-helpers';

// ─── Hook 返回类型 ─────────────────────────────────────────────────────────────

export type CanvasStateReturn = {
	steps: ScriptStep[];
	nodes: Node[];
	edges: Edge[];
	selectedIndex: number | null;
	setSelectedIndex: (i: number | null) => void;
	saving: boolean;
	setSaving: (v: boolean) => void;
	savedAt: number | null;
	setSavedAt: (v: number | null) => void;
	stepDelayMs: number;
	setStepDelayMs: (v: number) => void;
	varsDefs: ScriptVarDef[];
	setVarsDefs: (vars: ScriptVarDef[]) => void;
	addStep: (kind: string, viewportCenter?: { x: number; y: number }) => Promise<void>;
	updateStep: (index: number, step: ScriptStep) => Promise<void>;
	pasteSteps: (steps: ScriptStep[]) => Promise<void>;
	deleteStep: (index: number) => Promise<void>;
	onNodesChange: (changes: NodeChange[]) => void;
	onEdgesChange: (changes: EdgeChange[]) => void;
	onConnect: (connection: Connection) => void;
	onNodeClick: (_: React.MouseEvent, node: Node) => void;
	onPaneClick: () => void;
	saveScript: (newSteps: ScriptStep[]) => Promise<void>;
	saveNow: () => Promise<void>;
	scheduleCanvasSave: (pos: PositionsMap, edgs: Edge[]) => void;
};

// ─── Hook 实现 ─────────────────────────────────────────────────────────────────

/**
 * 画布状态管理 Hook
 *
 * @param script - 当前自动化脚本（含步骤、画布位置、变量定义等）
 * @param liveStatuses - 实时步骤运行状态映射（step index → status string）
 * @returns 画布所有状态和操作方法
 */
export function useCanvasState(
	script: AutomationScript,
	liveStatuses: Record<number, string>,
): CanvasStateReturn {
	// ── 基础状态 ──────────────────────────────────────────────────────────────
	// 将后端返回的嵌套控制流树展平为扁平节点（resolveControlFlowGraph 的逆操作）
	// 避免重新打开编辑器时条件分支/循环体的嵌套步骤丢失
	// 将后端返回的嵌套控制流树展平 + 从 canvas 数据恢复孤立步骤
	const [{ initFlatSteps, reconstructedEdges, parsedCanvas }] = useState(() => {
		const { flatSteps, edges } = flattenControlFlowTree(script.steps);
		const canvas = parseCanvasData(script.canvasPositionsJson, flatSteps.length);
		// 合并孤立步骤（从 canvasPositionsJson 恢复）到 flat 步骤列表末尾
		const allSteps = canvas.orphanedSteps && canvas.orphanedSteps.length > 0
			? [...flatSteps, ...canvas.orphanedSteps]
			: flatSteps;
		return { initFlatSteps: allSteps, reconstructedEdges: edges, parsedCanvas: canvas };
	});
	const [steps, setSteps] = useState<ScriptStep[]>(initFlatSteps);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [stepDelayMs, setStepDelayMs] = useState<number>(
		() => script.settings?.stepDelayMs ?? 0,
	);
	const [varsDefs, setVarsDefs] = useState<ScriptVarDef[]>(() => {
		try {
			return script.variablesSchemaJson
				? JSON.parse(script.variablesSchemaJson)
				: [];
		} catch {
			return [];
		}
	});

	// 当脚本ID或设置变化时同步 stepDelayMs
	useEffect(() => {
		setStepDelayMs(script.settings?.stepDelayMs ?? 0);
	}, [script.id, script.settings?.stepDelayMs]);

	// 从 canvasPositionsJson 读取位置和边：
	// - 有保存数据（新格式）：优先使用保存的边，与用户操作时的拓扑完全一致
	// - 无数据或旧格式：回退到 flattenControlFlowTree 重建的边（首次加载）
	const { positions: initPos, edges: canvasEdges, edgesFromSave, startEdgeTarget } = parsedCanvas;
	const initEdges = edgesFromSave ? canvasEdges : reconstructedEdges;
	const initialStartEdgeTarget =
		startEdgeTarget === undefined
			? findRootStepId(initEdges, initFlatSteps.length)
			: startEdgeTarget;
	const initialEdgesWithStart = initialStartEdgeTarget
		? [buildStartEdge(initialStartEdgeTarget), ...initEdges]
		: initEdges;

	// nodes 存在 state 中，用 applyNodeChanges 驱动，避免拖拽时重建数组导致节点消失
	const [nodes, setNodes] = useState<Node[]>(() => {
		const stepNodes = buildNodes(initFlatSteps, initPos, {});
		const startPos = initPos[START_NODE_ID] ?? defaultStartPosition(initPos);
		return [buildStartNode(startPos), ...stepNodes];
	});
	const [edges, setEdges] = useState<Edge[]>(() => initialEdgesWithStart);

	// refs 用于在 callback 中读取最新值，避免闭包陈旧问题
	const positionsRef = useRef<PositionsMap>(initPos);
	const edgesRef = useRef<Edge[]>(initialEdgesWithStart);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ── liveStatuses 同步 ──────────────────────────────────────────────────────
	// liveStatuses 变化时同步到 nodes.data（不触发节点重建）
	useEffect(() => {
		setNodes((prev) =>
			prev.map((n) => {
				if (n.id === START_NODE_ID) return n;
				const idx = parseInt(n.id.replace('step-', ''), 10);
				const status = liveStatuses[idx];
				if ((n.data as StepNodeData).stepStatus === status) return n;
				return {
					...n,
					data: { ...(n.data as StepNodeData), stepStatus: status },
				};
			}),
		);
	}, [liveStatuses]);

	// savedAt 超时清理
	useEffect(() => {
		if (!savedAt) return;
		const t = setTimeout(() => setSavedAt(null), 3000);
		return () => clearTimeout(t);
	}, [savedAt]);

	// 卸载时 flush 未完成的防抖画布保存，防止拖拽后快速关闭丢失位置
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
				void updateScriptCanvasPositions(
					script.id,
					buildCanvasDataJson(positionsRef.current, edgesRef.current),
				);
			}
		};
	}, [script.id]);

	// ── 画布持久化（防抖 500ms） ────────────────────────────────────────────────
	const scheduleCanvasSave = useCallback(
		(pos: PositionsMap, edgs: Edge[]) => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				void updateScriptCanvasPositions(script.id, buildCanvasDataJson(pos, edgs));
			}, 500);
		},
		[script.id],
	);

	const buildNextSettings = useCallback((): ScriptSettings | undefined => {
		const nextSettings: ScriptSettings = {
			...(script.settings ?? {}),
		};
		if (stepDelayMs > 0) {
			nextSettings.stepDelayMs = stepDelayMs;
		} else {
			delete nextSettings.stepDelayMs;
		}
		return Object.keys(nextSettings).length > 0 ? nextSettings : undefined;
	}, [script.settings, stepDelayMs]);

	// ── 脚本保存（含拓扑排序） ─────────────────────────────────────────────────
	const saveScript = useCallback(
		async (newSteps: ScriptStep[]) => {
			setSaving(true);
			try {
				// 保存前剥离 Start 节点相关边和位置
				const stepEdges = stripStartEdges(edgesRef.current);
				const stepPositions = { ...positionsRef.current };
				delete stepPositions[START_NODE_ID];
				const currentStartTarget = getStartEdgeTarget(edgesRef.current);

				const {
					nestedSteps,
					flatSteps,
					orderedIds,
					remappedEdges,
					remappedPositions,
					orphanedCount,
					orphanedSteps,
				} = serializeControlFlowGraph(
					newSteps,
					stepEdges,
					stepPositions,
					currentStartTarget,
				);
				const nextIndexByOldId = new Map(
					orderedIds.map((oldId, newIndex) => [oldId, newIndex] as const),
				);

				setSteps(flatSteps);
				setNodes((prev) => {
					const startNode = prev.find((n) => n.id === START_NODE_ID);
					const prevNodeById = new Map(prev.map((node) => [node.id, node]));
					const stepNodes = orderedIds.map((oldId, newIndex) => {
						const previousNode = prevNodeById.get(oldId);
						return {
							...(previousNode ?? {
								id: oldId,
								type: 'step',
								position: remappedPositions[`step-${newIndex}`] ?? { x: 120, y: newIndex * 120 + 60 },
							}),
							id: `step-${newIndex}`,
							type: 'step',
							position:
								remappedPositions[`step-${newIndex}`] ??
								previousNode?.position ??
								{ x: 120, y: newIndex * 120 + 60 },
							data: {
								...((previousNode?.data as StepNodeData | undefined) ?? {}),
								step: flatSteps[newIndex],
								index: newIndex,
								stepStatus: liveStatuses[newIndex],
							} as StepNodeData,
						};
					});
					return startNode ? [startNode, ...stepNodes] : stepNodes;
				});
				const rootId = findRootStepId(remappedEdges, flatSteps.length);
				const remappedStartTarget =
					currentStartTarget === null
						? null
						: nextIndexByOldId.has(currentStartTarget)
							? `step-${nextIndexByOldId.get(currentStartTarget)}`
							: rootId;
				const startEdge = remappedStartTarget ? buildStartEdge(remappedStartTarget) : null;
				const edgesWithStart = startEdge ? [startEdge, ...remappedEdges] : remappedEdges;
				setEdges(edgesWithStart);
				edgesRef.current = edgesWithStart;
				// 保留 Start 位置到 positionsRef
				const startPos = positionsRef.current[START_NODE_ID];
				positionsRef.current = startPos
					? { ...remappedPositions, [START_NODE_ID]: startPos }
					: remappedPositions;

				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
					saveTimerRef.current = null;
				}

				setSelectedIndex((prev) => {
					if (prev === null) return null;
					return nextIndexByOldId.get(`step-${prev}`) ?? null;
				});

				if (orphanedCount > 0) {
					const orphanedNames = flatSteps
						.slice(flatSteps.length - orphanedCount)
						.map((s) => KIND_LABELS[s.kind] || s.kind)
						.join('、');
					toast.warning(
						`${orphanedCount} 个步骤未连接到流程中：${orphanedNames}`,
						{
							duration: 8000,
							action: {
								label: '删除孤立步骤',
								onClick: () => {
									const kept = flatSteps.slice(0, flatSteps.length - orphanedCount);
									void saveScript(kept);
								},
							},
						},
					);
				}

				await saveAutomationCanvasGraph(script.id, {
					steps: nestedSteps,
					positionsJson: buildCanvasDataJson(positionsRef.current, edgesWithStart, orphanedSteps),
					settings: buildNextSettings(),
				});
				void emitScriptUpdated(script.id);
				setSavedAt(Date.now());
			} finally {
				setSaving(false);
			}
		},
		[
			buildCanvasDataJson,
			buildNextSettings,
			liveStatuses,
			script.id,
			serializeControlFlowGraph,
		],
	);

	// ── 防抖保存管理 ─────────────────────────────────────────────────────────
	// updateStep 的保存防抖：属性面板编辑时每次按键都会触发 updateStep，
	// 使用防抖避免高频保存导致工具栏"保存中/已保存"状态快速切换闪动
	const updateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingStepsRef = useRef<ScriptStep[] | null>(null);

	/**
	 * 取消待执行的防抖保存并返回最新 steps（含未保存的属性编辑）。
	 * 所有结构性操作（增/删/粘贴）必须在开头调用，防止：
	 * 1. 防抖保存用旧 steps 覆盖结构变更
	 * 2. 闭包陈旧导致丢失未保存的属性编辑
	 */
	const flushPendingEdits = useCallback((): ScriptStep[] => {
		if (updateSaveTimerRef.current) {
			clearTimeout(updateSaveTimerRef.current);
			updateSaveTimerRef.current = null;
		}
		const latest = pendingStepsRef.current ?? steps;
		pendingStepsRef.current = null;
		return latest;
	}, [steps]);

	/** 立即保存（手动触发 / Cmd+S / 窗口关闭） */
	const saveNow = useCallback(async () => {
		const currentSteps = flushPendingEdits();
		await saveScript(currentSteps);
	}, [flushPendingEdits, saveScript]);

	// 窗口关闭时自动保存未持久化的变更
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (pendingStepsRef.current || saveTimerRef.current) {
				const currentSteps = pendingStepsRef.current ?? steps;
				pendingStepsRef.current = null;
				const cleanEdges = stripStartEdges(edgesRef.current);
				const cleanPos = { ...positionsRef.current };
				delete cleanPos[START_NODE_ID];
				const serialized = serializeControlFlowGraph(
						currentSteps,
						cleanEdges,
						cleanPos,
						getStartEdgeTarget(edgesRef.current),
					);
				void saveAutomationCanvasGraph(script.id, {
					steps: serialized.nestedSteps,
					positionsJson: buildCanvasDataJson(positionsRef.current, edgesRef.current, serialized.orphanedSteps),
					settings: buildNextSettings(),
				});
			}
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			handleBeforeUnload(); // React unmount 时也 flush
		};
	}, [script.id, steps, buildNextSettings, serializeControlFlowGraph]);

	// ── 节点变化处理（含删除拦截） ─────────────────────────────────────────────
	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			// 拦截节点删除（Backspace 键）：同步 steps 状态并持久化到 DB
			const removeChanges = changes.filter((c) => c.type === 'remove');
			if (removeChanges.length > 0) {
				const removedIndices = new Set(
					removeChanges
						.map((c) => parseInt(c.id.replace('step-', ''), 10))
						.filter((i) => !isNaN(i)),
				);
				if (removedIndices.size > 0) {
					// 取消防抖保存，获取最新 steps（含未保存的属性编辑）
					const baseSteps = flushPendingEdits();
					const sortedRemoved = [...removedIndices].sort((a, b) => a - b);
					const newSteps = baseSteps.filter(
						(_, i) => !removedIndices.has(i),
					);
					setSteps(newSteps);
					setSelectedIndex(null);

					// 重映射边：同步更新 ref，确保 saveScript 读到正确的边
					const deletedIds = new Set(removeChanges.map((c) => c.id));
					const surviving = edgesRef.current.filter(
						(e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
					);
					// Start 节点边单独处理（不参与 step-N 重映射）
					const startEdges = surviving.filter((e) => e.source === START_NODE_ID || e.target === START_NODE_ID);
					const stepSurviving = surviving.filter((e) => e.source !== START_NODE_ID && e.target !== START_NODE_ID);
					const remappedStepEdges = stepSurviving.map((e) => {
						const si = parseInt(e.source.replace('step-', ''), 10);
						const ti = parseInt(e.target.replace('step-', ''), 10);
						const sShift = sortedRemoved.filter((ri) => ri < si).length;
						const tShift = sortedRemoved.filter((ri) => ri < ti).length;
						const newSi = sShift > 0 ? si - sShift : si;
						const newTi = tShift > 0 ? ti - tShift : ti;
						return {
							...e,
							id: `e-${newSi}-${newTi}`,
							source: `step-${newSi}`,
							target: `step-${newTi}`,
						};
					});
					// 重映射 Start 边的 target（可能指向被删除或被重编号的节点）
					const remappedStartEdges = startEdges
						.filter((e) => !deletedIds.has(e.target))
						.map((e) => {
							const ti = parseInt(e.target.replace('step-', ''), 10);
							if (isNaN(ti)) return e;
							const tShift = sortedRemoved.filter((ri) => ri < ti).length;
							const newTi = tShift > 0 ? ti - tShift : ti;
							return { ...e, id: `e-start-step-${newTi}`, target: `step-${newTi}` };
						});
					const remapped = [...remappedStartEdges, ...remappedStepEdges];
					edgesRef.current = remapped;
					setEdges(remapped);

					// 清理并重映射 positions
					const newPos = { ...positionsRef.current };
					for (const idx of removedIndices) delete newPos[`step-${idx}`];
					const existingKeys = Object.keys(newPos)
						.map((k) => parseInt(k.replace('step-', ''), 10))
						.filter((n) => !isNaN(n))
						.sort((a, b) => b - a); // 从大到小，防止覆盖
					for (const j of existingKeys) {
						const shift = sortedRemoved.filter((ri) => ri < j).length;
						if (shift > 0 && newPos[`step-${j}`]) {
							newPos[`step-${j - shift}`] = newPos[`step-${j}`];
							delete newPos[`step-${j}`];
						}
					}
					positionsRef.current = newPos;
					scheduleCanvasSave(newPos, remapped);

					// 视觉更新：删除节点并重映射 ID
					setNodes((prev) => {
						const afterRemove = applyNodeChanges(changes, prev) as Node[];
						return afterRemove.map((n) => {
							const i = parseInt(n.id.replace('step-', ''), 10);
							if (isNaN(i)) return n;
							const shift = sortedRemoved.filter((ri) => ri < i).length;
							if (shift === 0) return n;
							return {
								...n,
								id: `step-${i - shift}`,
								data: { ...(n.data as StepNodeData), index: i - shift },
							};
						});
					});

					queueMicrotask(() => {
						saveScript(newSteps).catch((err) =>
							console.error('[canvas] node deletion save failed:', err),
						);
					});
					return;
				}
			}

			// 普通变化（拖拽、选中等）：用 applyNodeChanges 驱动，避免打断拖拽
			setNodes((nds) => applyNodeChanges(changes, nds) as Node[]);

			// 拖拽结束时（dragging: false）才持久化位置
			for (const c of changes) {
				if (c.type === 'position' && c.position) {
					positionsRef.current = {
						...positionsRef.current,
						[c.id]: c.position,
					};
					if (!c.dragging) {
						scheduleCanvasSave(positionsRef.current, edgesRef.current);
					}
				}
			}
		},
		[flushPendingEdits, scheduleCanvasSave, saveScript],
	);

	// ── 边变化处理 ─────────────────────────────────────────────────────────────
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			const hasRemovals = changes.some((c) => c.type === 'remove');
			const isSelectOnly = changes.every((c) => c.type === 'select');
			setEdges((prev) => {
				const next = applyEdgeChanges(changes, prev);
				edgesRef.current = next;
				// 仅在结构变更时保存，选中/取消选中不触发保存
				if (!isSelectOnly) {
					scheduleCanvasSave(positionsRef.current, next);
				}
				return next;
			});
			if (hasRemovals) {
				queueMicrotask(() => {
					saveScript(flushPendingEdits()).catch((err) =>
						console.error('[canvas] edge removal save failed:', err),
					);
				});
			}
		},
		[scheduleCanvasSave, flushPendingEdits, saveScript],
	);

	// ── 连接处理 ───────────────────────────────────────────────────────────────
	const onConnect = useCallback(
		(connection: Connection) => {
			// 禁止节点自连接
			if (connection.source === connection.target) return;
			// Start 节点连线：只能有一条出边，替换旧的
			if (connection.source === START_NODE_ID) {
				setEdges((prev) => {
					const filtered = prev.filter((e) => e.source !== START_NODE_ID);
					const next = addEdge({ ...connection, type: 'smoothstep' }, filtered);
					edgesRef.current = next;
					scheduleCanvasSave(positionsRef.current, next);
					return next;
				});
				return;
			}
			setEdges((prev) => {
				// 移除目标节点上已有的同 targetHandle 入边（单入边约束）
				const filtered = prev.filter(
					(e) =>
						!(
							e.target === connection.target &&
							e.targetHandle === (connection.targetHandle ?? null)
						),
				);
				const next = addEdge({ ...connection, type: 'smoothstep' }, filtered);
				edgesRef.current = next;
				scheduleCanvasSave(positionsRef.current, next);
				return next;
			});
			// 新连线改变拓扑，延迟重排步骤数组
			queueMicrotask(() => {
				saveScript(flushPendingEdits()).catch((err) =>
					console.error('[canvas] connect save failed:', err),
				);
			});
		},
		[scheduleCanvasSave, flushPendingEdits, saveScript],
	);

	// ── 节点/面板点击 ──────────────────────────────────────────────────────────
	const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
		const idx = parseInt(node.id.replace('step-', ''), 10);
		setSelectedIndex(isNaN(idx) ? null : idx);
	}, []);

	const onPaneClick = useCallback(() => setSelectedIndex(null), []);

	// ── 步骤增删改 ─────────────────────────────────────────────────────────────
	const addStep = useCallback(
		async (kind: string, viewportCenter?: { x: number; y: number }) => {
			const baseSteps = flushPendingEdits();
			const step = defaultStep(kind);
			const newIndex = baseSteps.length;
			const newSteps = [...baseSteps, step];
			setSteps(newSteps);

			// 优先放在视口中心，否则放在最后一个节点正下方
			let newPos: { x: number; y: number };
			if (viewportCenter) {
				newPos = { x: viewportCenter.x - 90, y: viewportCenter.y - 30 };
			} else {
				const lastPos = positionsRef.current[`step-${newIndex - 1}`] ?? { x: 120, y: 0 };
				newPos = { x: lastPos.x, y: lastPos.y + 140 };
			}
			positionsRef.current = {
				...positionsRef.current,
				[`step-${newIndex}`]: newPos,
			};
			setNodes((prev) => [
				...prev,
				{
					id: `step-${newIndex}`,
					type: 'step',
					position: newPos,
					sourcePosition: Position.Bottom,
					targetPosition: Position.Top,
					data: {
						step,
						index: newIndex,
						stepStatus: undefined,
					} as StepNodeData,
				},
			]);

			// 自动连线：同步更新 ref 再保存，避免 setEdges 回调在 saveScript 之后才执行
			if (newIndex === 0) {
				// 第一个步骤：从 Start 节点连线
				const startEdge = buildStartEdge(`step-0`);
				const nextEdges = [startEdge, ...edgesRef.current.filter((e) => e.source !== START_NODE_ID)];
				edgesRef.current = nextEdges;
				setEdges(nextEdges);
				scheduleCanvasSave(positionsRef.current, nextEdges);
			} else {
				const connection: Edge = {
					id: `e-${newIndex - 1}-${newIndex}`,
					source: `step-${newIndex - 1}`,
					target: `step-${newIndex}`,
					type: 'smoothstep',
				};
				const nextEdges = addEdge(connection, edgesRef.current);
				edgesRef.current = nextEdges;
				setEdges(nextEdges);
				scheduleCanvasSave(positionsRef.current, nextEdges);
			}
			await saveScript(newSteps);
		},
		[flushPendingEdits, saveScript, scheduleCanvasSave],
	);

	const updateStep = useCallback(
		async (index: number, step: ScriptStep) => {
			const newSteps = steps.map((s, i) => (i === index ? step : s));
			setSteps(newSteps);
			// 同步更新对应节点的 data（即时反映到画布）
			setNodes((prev) =>
				prev.map((n) =>
					n.id === `step-${index}`
						? { ...n, data: { ...(n.data as StepNodeData), step } }
						: n,
				),
			);
			// 弹窗节点：按钮删除时清理连接到已移除 btn_N handle 的边
			if (step.kind === 'confirm_dialog') {
				const btnCount = step.buttons?.length ?? 0;
				const nodeId = `step-${index}`;
				const invalidEdges = edgesRef.current.filter((e) => {
					if (e.source !== nodeId || !e.sourceHandle) return false;
					if (!e.sourceHandle.startsWith('btn_')) return false;
					const btnIdx = parseInt(e.sourceHandle.replace('btn_', ''), 10);
					return btnIdx >= btnCount;
				});
				if (invalidEdges.length > 0) {
					const invalidIds = new Set(invalidEdges.map((e) => e.id));
					const cleaned = edgesRef.current.filter((e) => !invalidIds.has(e.id));
					edgesRef.current = cleaned;
					setEdges(cleaned);
					scheduleCanvasSave(positionsRef.current, cleaned);
				}
			}
			// 防抖保存：300ms 内连续编辑只触发最后一次
			pendingStepsRef.current = newSteps;
			if (updateSaveTimerRef.current) clearTimeout(updateSaveTimerRef.current);
			updateSaveTimerRef.current = setTimeout(() => {
				const toSave = pendingStepsRef.current;
				pendingStepsRef.current = null;
				if (toSave) void saveScript(toSave);
			}, 300);
		},
		[steps, saveScript, scheduleCanvasSave],
	);

	// ── 粘贴步骤（批量添加完整步骤，用于快捷键复制粘贴） ───────────────────
	const pasteSteps = useCallback(
		async (stepsToAdd: ScriptStep[]) => {
			if (stepsToAdd.length === 0) return;
			let currentSteps = flushPendingEdits();
			for (const step of stepsToAdd) {
				const newIndex = currentSteps.length;
				currentSteps = [...currentSteps, step];

				// 新节点位置
				const lastPos = positionsRef.current[`step-${newIndex - 1}`] ?? {
					x: 120,
					y: 0,
				};
				const newPos = { x: lastPos.x, y: lastPos.y + 140 };
				positionsRef.current = {
					...positionsRef.current,
					[`step-${newIndex}`]: newPos,
				};
				setNodes((prev) => [
					...prev,
					{
						id: `step-${newIndex}`,
						type: 'step',
						position: newPos,
						sourcePosition: Position.Bottom,
						targetPosition: Position.Top,
						data: {
							step,
							index: newIndex,
							stepStatus: undefined,
						} as StepNodeData,
					},
				]);

				// 自动连线：同步更新 ref
				if (newIndex > 0) {
					const connection: Edge = {
						id: `e-${newIndex - 1}-${newIndex}`,
						source: `step-${newIndex - 1}`,
						target: `step-${newIndex}`,
						type: 'smoothstep',
					};
					const nextEdges = addEdge(connection, edgesRef.current);
					edgesRef.current = nextEdges;
					setEdges(nextEdges);
					scheduleCanvasSave(positionsRef.current, nextEdges);
				}
			}
			setSteps(currentSteps);
			await saveScript(currentSteps);
		},
		[flushPendingEdits, saveScript, scheduleCanvasSave],
	);

	const deleteStep = useCallback(
		async (index: number) => {
			const baseSteps = flushPendingEdits();
			const newSteps = baseSteps.filter((_, i) => i !== index);
			setSteps(newSteps);
			setSelectedIndex(null);
			const deletedId = `step-${index}`;

			// 重新映射节点 id 和 data.index
			setNodes((prev) =>
				prev
					.filter((n) => n.id !== deletedId)
					.map((n) => {
						const i = parseInt(n.id.replace('step-', ''), 10);
						if (i <= index) return n;
						const newId = `step-${i - 1}`;
						return {
							...n,
							id: newId,
							data: { ...(n.data as StepNodeData), index: i - 1 },
						};
					}),
			);

			// 重新映射边：同步更新 ref，确保 saveScript 读到正确的边
			const remapped = edgesRef.current
				.filter((e) => e.source !== deletedId && e.target !== deletedId)
				.map((e) => {
					const si = parseInt(e.source.replace('step-', ''), 10);
					const ti = parseInt(e.target.replace('step-', ''), 10);
					const newSi = si > index ? si - 1 : si;
					const newTi = ti > index ? ti - 1 : ti;
					return {
						...e,
						id: `e-${newSi}-${newTi}`,
						source: `step-${newSi}`,
						target: `step-${newTi}`,
					};
				});
			edgesRef.current = remapped;
			setEdges(remapped);

			// 清理并重映射 positions
			const newPos = { ...positionsRef.current };
			delete newPos[deletedId];
			for (let j = index + 1; j <= baseSteps.length; j++) {
				const oldKey = `step-${j}`;
				if (newPos[oldKey]) {
					newPos[`step-${j - 1}`] = newPos[oldKey];
					delete newPos[oldKey];
				}
			}
			positionsRef.current = newPos;
			scheduleCanvasSave(newPos, remapped);

			await saveScript(newSteps);
		},
		[flushPendingEdits, saveScript, scheduleCanvasSave],
	);

	// ─────────────────────────────────────────────────────────────────────────────
	return {
		steps,
		nodes,
		edges,
		selectedIndex,
		setSelectedIndex,
		saving,
		setSaving,
		savedAt,
		setSavedAt,
		stepDelayMs,
		setStepDelayMs,
		varsDefs,
		setVarsDefs,
		addStep,
		updateStep,
		pasteSteps,
		deleteStep,
		onNodesChange,
		onEdgesChange,
		onConnect,
		onNodeClick,
		onPaneClick,
		saveScript,
		saveNow,
		scheduleCanvasSave,
	};
}
