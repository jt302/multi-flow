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
} from '@/entities/automation/model/types';
import {
	emitScriptUpdated,
	updateAutomationScript,
	updateScriptCanvasPositions,
} from '@/entities/automation/api/automation-api';
import { defaultStep } from '@/entities/automation/model/step-registry';

import type { StepNodeData } from '../ui/step-node';
import {
	buildNodes,
	parseCanvasData,
	topologySortSteps,
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
	addStep: (kind: string) => Promise<void>;
	updateStep: (index: number, step: ScriptStep) => Promise<void>;
	pasteSteps: (steps: ScriptStep[]) => Promise<void>;
	deleteStep: (index: number) => Promise<void>;
	onNodesChange: (changes: NodeChange[]) => void;
	onEdgesChange: (changes: EdgeChange[]) => void;
	onConnect: (connection: Connection) => void;
	onNodeClick: (_: React.MouseEvent, node: Node) => void;
	onPaneClick: () => void;
	saveScript: (newSteps: ScriptStep[]) => Promise<void>;
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
	const [steps, setSteps] = useState<ScriptStep[]>(script.steps);
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

	// ── 画布节点/边状态 ────────────────────────────────────────────────────────
	const [{ positions: initPos, edges: initEdges }] = useState(() =>
		parseCanvasData(script.canvasPositionsJson, script.steps.length),
	);

	// nodes 存在 state 中，用 applyNodeChanges 驱动，避免拖拽时重建数组导致节点消失
	const [nodes, setNodes] = useState<Node[]>(() =>
		buildNodes(script.steps, initPos, {}),
	);
	const [edges, setEdges] = useState<Edge[]>(initEdges);

	// refs 用于在 callback 中读取最新值，避免闭包陈旧问题
	const positionsRef = useRef<PositionsMap>(initPos);
	const edgesRef = useRef<Edge[]>(initEdges);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ── liveStatuses 同步 ──────────────────────────────────────────────────────
	// liveStatuses 变化时同步到 nodes.data（不触发节点重建）
	useEffect(() => {
		setNodes((prev) =>
			prev.map((n) => {
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

	// ── 画布持久化（防抖 500ms） ────────────────────────────────────────────────
	const scheduleCanvasSave = useCallback(
		(pos: PositionsMap, edgs: Edge[]) => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				const data = {
					positions: pos,
					edges: edgs.map((e) => ({
						id: e.id,
						source: e.source,
						target: e.target,
						sourceHandle: e.sourceHandle ?? null,
					})),
				};
				void updateScriptCanvasPositions(script.id, JSON.stringify(data));
			}, 500);
		},
		[script.id],
	);

	// ── 脚本保存（含拓扑排序） ─────────────────────────────────────────────────
	const saveScript = useCallback(
		async (newSteps: ScriptStep[]) => {
			setSaving(true);
			try {
				const currentEdges = edgesRef.current;
				const { reorderedSteps, indexMap, orphanedCount } = topologySortSteps(
					newSteps,
					currentEdges,
				);

				// 若顺序有变化，同步更新本地状态并重映射 nodes/edges/positions
				const orderChanged = reorderedSteps.some((s, i) => s !== newSteps[i]);
				if (orderChanged) {
					setSteps(reorderedSteps);

					// 重映射 nodes id 和 data.index
					setNodes((prev) =>
						prev.map((node) => {
							const oldIdx = parseInt(node.id.replace('step-', ''), 10);
							if (isNaN(oldIdx)) return node;
							const newIdx = indexMap.get(oldIdx);
							if (newIdx === undefined || newIdx === oldIdx) return node;
							return {
								...node,
								id: `step-${newIdx}`,
								data: { ...(node.data as StepNodeData), index: newIdx },
							};
						}),
					);

					// 重映射 edges source/target
					const remappedEdges = currentEdges.map((e) => {
						const si = parseInt(e.source.replace('step-', ''), 10);
						const ti = parseInt(e.target.replace('step-', ''), 10);
						const newSi = indexMap.get(si);
						const newTi = indexMap.get(ti);
						return {
							...e,
							source: newSi !== undefined ? `step-${newSi}` : e.source,
							target: newTi !== undefined ? `step-${newTi}` : e.target,
						};
					});
					setEdges(remappedEdges);
					edgesRef.current = remappedEdges;

					// 重映射 positions
					const newPos: PositionsMap = {};
					for (const [oldKey, pos] of Object.entries(positionsRef.current)) {
						const oldIdx = parseInt(oldKey.replace('step-', ''), 10);
						const newIdx = isNaN(oldIdx) ? undefined : indexMap.get(oldIdx);
						const newKey = newIdx !== undefined ? `step-${newIdx}` : oldKey;
						newPos[newKey] = pos;
					}
					positionsRef.current = newPos;
					scheduleCanvasSave(newPos, remappedEdges);

					// 同步更新选中 index
					setSelectedIndex((prev) => {
						if (prev === null) return null;
						return indexMap.get(prev) ?? null;
					});

					if (orphanedCount > 0) {
						toast.warning(
							`${orphanedCount} 个步骤未连接到流程中，已追加到末尾执行`,
						);
					}
				}

				await updateAutomationScript(script.id, {
					name: script.name,
					description: script.description ?? undefined,
					steps: reorderedSteps,
					settings: stepDelayMs > 0 ? { stepDelayMs } : undefined,
				});
				void emitScriptUpdated(script.id);
				setSavedAt(Date.now());
			} finally {
				setSaving(false);
			}
		},
		[
			script.id,
			script.name,
			script.description,
			stepDelayMs,
			scheduleCanvasSave,
		],
	);

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
					const sortedRemoved = [...removedIndices].sort((a, b) => a - b);
					setSteps((currentSteps) => {
						const newSteps = currentSteps.filter(
							(_, i) => !removedIndices.has(i),
						);
						void saveScript(newSteps);
						return newSteps;
					});
					setSelectedIndex(null);

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

					// 重映射边
					setEdges((prev) => {
						const deletedIds = new Set(removeChanges.map((c) => c.id));
						const remapped = prev
							.filter(
								(e) =>
									!deletedIds.has(e.source) && !deletedIds.has(e.target),
							)
							.map((e) => {
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
						edgesRef.current = remapped;

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
						return remapped;
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
		[scheduleCanvasSave, saveScript, steps],
	);

	// ── 边变化处理 ─────────────────────────────────────────────────────────────
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			setEdges((prev) => {
				const next = applyEdgeChanges(changes, prev);
				edgesRef.current = next;
				scheduleCanvasSave(positionsRef.current, next);

				// 检测因边删除导致的孤立节点，给出 warning
				const hasRemovals = changes.some((c) => c.type === 'remove');
				if (hasRemovals && steps.length > 1) {
					const connected = new Set<string>();
					for (const e of next) {
						connected.add(e.source);
						connected.add(e.target);
					}
					const isolated = steps
						.map((_, i) => `step-${i}`)
						.filter((id) => !connected.has(id));
					if (isolated.length > 0) {
						const labels = isolated.map((id) => {
							const idx = parseInt(id.replace('step-', ''), 10);
							const s = steps[idx];
							return s ? `步骤 ${idx + 1}` : id;
						});
						toast.warning(
							`以下步骤未连接到流程中，运行时仍会被执行：${labels.join('、')}`,
						);
					}
				}
				return next;
			});
		},
		[scheduleCanvasSave, steps],
	);

	// ── 连接处理 ───────────────────────────────────────────────────────────────
	const onConnect = useCallback(
		(connection: Connection) => {
			// 禁止节点自连接
			if (connection.source === connection.target) return;
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
		},
		[scheduleCanvasSave],
	);

	// ── 节点/面板点击 ──────────────────────────────────────────────────────────
	const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
		const idx = parseInt(node.id.replace('step-', ''), 10);
		setSelectedIndex(isNaN(idx) ? null : idx);
	}, []);

	const onPaneClick = useCallback(() => setSelectedIndex(null), []);

	// ── 步骤增删改 ─────────────────────────────────────────────────────────────
	const addStep = useCallback(
		async (kind: string) => {
			const step = defaultStep(kind);
			const newIndex = steps.length;
			const newSteps = [...steps, step];
			setSteps(newSteps);

			// 新节点放在最后一个节点的正下方
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

			// 自动连线：新步骤与前一步骤之间添加边
			if (newIndex > 0) {
				const connection: Edge = {
					id: `e-${newIndex - 1}-${newIndex}`,
					source: `step-${newIndex - 1}`,
					target: `step-${newIndex}`,
					type: 'smoothstep',
				};
				setEdges((prev) => {
					const next = addEdge(connection, prev);
					edgesRef.current = next;
					scheduleCanvasSave(positionsRef.current, next);
					return next;
				});
			}
			await saveScript(newSteps);
		},
		[steps, saveScript, scheduleCanvasSave],
	);

	// updateStep 的保存防抖：属性面板编辑时每次按键都会触发 updateStep，
	// 使用防抖避免高频保存导致工具栏"保存中/已保存"状态快速切换闪动
	const updateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingStepsRef = useRef<ScriptStep[] | null>(null);

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
			// 防抖保存：300ms 内连续编辑只触发最后一次
			pendingStepsRef.current = newSteps;
			if (updateSaveTimerRef.current) clearTimeout(updateSaveTimerRef.current);
			updateSaveTimerRef.current = setTimeout(() => {
				const toSave = pendingStepsRef.current;
				pendingStepsRef.current = null;
				if (toSave) void saveScript(toSave);
			}, 300);
		},
		[steps, saveScript],
	);

	// ── 粘贴步骤（批量添加完整步骤，用于快捷键复制粘贴） ───────────────────
	const pasteSteps = useCallback(
		async (stepsToAdd: ScriptStep[]) => {
			if (stepsToAdd.length === 0) return;
			let currentSteps = steps;
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

				// 自动连线
				if (newIndex > 0) {
					const connection: Edge = {
						id: `e-${newIndex - 1}-${newIndex}`,
						source: `step-${newIndex - 1}`,
						target: `step-${newIndex}`,
						type: 'smoothstep',
					};
					setEdges((prev) => {
						const next = addEdge(connection, prev);
						edgesRef.current = next;
						scheduleCanvasSave(positionsRef.current, next);
						return next;
					});
				}
			}
			setSteps(currentSteps);
			await saveScript(currentSteps);
		},
		[steps, saveScript, scheduleCanvasSave],
	);

	const deleteStep = useCallback(
		async (index: number) => {
			const newSteps = steps.filter((_, i) => i !== index);
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

			// 重新映射边
			setEdges((prev) => {
				const remapped = prev
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

				// 清理并重映射 positions
				const newPos = { ...positionsRef.current };
				delete newPos[deletedId];
				for (let j = index + 1; j <= steps.length; j++) {
					const oldKey = `step-${j}`;
					if (newPos[oldKey]) {
						newPos[`step-${j - 1}`] = newPos[oldKey];
						delete newPos[oldKey];
					}
				}
				positionsRef.current = newPos;
				scheduleCanvasSave(newPos, remapped);
				return remapped;
			});
			await saveScript(newSteps);
		},
		[steps, saveScript, scheduleCanvasSave],
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
		scheduleCanvasSave,
	};
}
