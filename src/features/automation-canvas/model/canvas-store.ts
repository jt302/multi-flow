import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import i18next from 'i18next';
import type React from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
	emitScriptUpdated,
	saveAutomationCanvasGraph,
	updateScriptCanvasPositions,
} from '@/entities/automation/api/automation-api';
import { isTerminalStepKind } from '@/entities/automation/model/step-flow';
import { defaultStep, KIND_LABELS } from '@/entities/automation/model/step-registry';
import type {
	AutomationScript,
	ScriptSettings,
	ScriptStep,
	ScriptVarDef,
} from '@/entities/automation/model/types';
import {
	buildCanvasDataJson,
	buildNodes,
	buildStartEdge,
	buildStartNode,
	defaultStartPosition,
	findRootStepId,
	flattenControlFlowTree,
	getStartEdgeTarget,
	type PositionsMap,
	parseCanvasData,
	START_NODE_ID,
	serializeControlFlowGraph,
	stripStartEdges,
} from './canvas-helpers';
import {
	buildStepCanvasNode,
	buildStepNodeData,
	rebuildIndexedNode,
	type StepNodeData,
	syncNodeStatuses,
} from './canvas-node-data';

export type CanvasStoreState = {
	steps: ScriptStep[];
	nodes: Node[];
	edges: Edge[];
	selectedIndex: number | null;
	saving: boolean;
	savedAt: number | null;
	stepDelayMs: number;
	varsDefs: ScriptVarDef[];
};

export type CanvasStoreActions = {
	setSelectedIndex: (index: number | null) => void;
	setStepDelayMs: (value: number) => void;
	setVarsDefs: (varsDefs: ScriptVarDef[]) => void;
	addStep: (kind: string, viewportCenter?: { x: number; y: number }) => Promise<void>;
	updateStep: (index: number, step: ScriptStep) => Promise<void>;
	pasteSteps: (steps: ScriptStep[]) => Promise<void>;
	deleteStep: (index: number) => Promise<void>;
	onNodesChange: (changes: NodeChange[]) => void;
	onEdgesChange: (changes: EdgeChange[]) => void;
	onConnect: (connection: Connection) => void;
	onNodeClick: (_event: React.MouseEvent, node: Node) => void;
	onPaneClick: () => void;
	saveNow: () => Promise<void>;
	syncLiveStatuses: (liveStatuses: Record<number, string>) => void;
	syncConcurrentCounts: (counts: Record<number, number>) => void;
	flushPendingPersistence: () => Promise<void>;
	dispose: () => Promise<void>;
};

export type CanvasStore = CanvasStoreState & CanvasStoreActions;
export type CanvasStoreApi = StoreApi<CanvasStore>;

type CanvasStoreDeps = {
	saveAutomationCanvasGraph?: typeof saveAutomationCanvasGraph;
	updateScriptCanvasPositions?: typeof updateScriptCanvasPositions;
	emitScriptUpdated?: typeof emitScriptUpdated;
	toastWarning?: typeof toast.warning;
	setTimeoutFn?: typeof setTimeout;
	clearTimeoutFn?: typeof clearTimeout;
	queueMicrotaskFn?: typeof queueMicrotask;
};

function parseVarsDefs(variablesSchemaJson: string | null): ScriptVarDef[] {
	try {
		return variablesSchemaJson ? JSON.parse(variablesSchemaJson) : [];
	} catch {
		return [];
	}
}

function getStepIndexFromNodeId(nodeId: string): number {
	return Number.parseInt(nodeId.replace('step-', ''), 10);
}

export function createCanvasStore(
	script: AutomationScript,
	initialLiveStatuses: Record<number, string> = {},
	deps: CanvasStoreDeps = {},
): CanvasStoreApi {
	const saveGraph = deps.saveAutomationCanvasGraph ?? saveAutomationCanvasGraph;
	const persistCanvasPositions = deps.updateScriptCanvasPositions ?? updateScriptCanvasPositions;
	const emitUpdated = deps.emitScriptUpdated ?? emitScriptUpdated;
	const toastWarning = deps.toastWarning ?? toast.warning;
	const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
	const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
	const queueMicrotaskFn = deps.queueMicrotaskFn ?? queueMicrotask;

	const { flatSteps, edges: reconstructedEdges } = flattenControlFlowTree(script.steps);
	const parsedCanvas = parseCanvasData(script.canvasPositionsJson, flatSteps);
	const initFlatSteps =
		parsedCanvas.orphanedSteps && parsedCanvas.orphanedSteps.length > 0
			? [...flatSteps, ...parsedCanvas.orphanedSteps]
			: flatSteps;
	const initPos = parsedCanvas.positions;
	const initEdges = parsedCanvas.edgesFromSave ? parsedCanvas.edges : reconstructedEdges;
	const initialStartEdgeTarget =
		parsedCanvas.startEdgeTarget === undefined
			? findRootStepId(initEdges, initFlatSteps.length)
			: parsedCanvas.startEdgeTarget;
	const initialEdgesWithStart = initialStartEdgeTarget
		? [buildStartEdge(initialStartEdgeTarget), ...initEdges]
		: initEdges;
	const initialNodes = (() => {
		const stepNodes = buildNodes(initFlatSteps, initPos, initialLiveStatuses);
		const startPos = initPos[START_NODE_ID] ?? defaultStartPosition(initPos);
		return [buildStartNode(startPos), ...stepNodes];
	})();

	let positionsRef: PositionsMap = initPos;
	let edgesRef: Edge[] = initialEdgesWithStart;
	let liveStatusesRef = { ...initialLiveStatuses };
	let saveTimerRef: ReturnType<typeof setTimeout> | null = null;
	let updateSaveTimerRef: ReturnType<typeof setTimeout> | null = null;
	let savedAtTimerRef: ReturnType<typeof setTimeout> | null = null;
	let pendingStepsRef: ScriptStep[] | null = null;

	const store = createStore<CanvasStore>()((set, get) => {
		const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
			if (timer) {
				clearTimeoutFn(timer);
			}
		};

		const scheduleSavedAtClear = () => {
			clearTimer(savedAtTimerRef);
			savedAtTimerRef = setTimeoutFn(() => {
				savedAtTimerRef = null;
				set({ savedAt: null });
			}, 3000);
		};

		const buildNextSettings = (): ScriptSettings | undefined => {
			const nextSettings: ScriptSettings = {
				...(script.settings ?? {}),
			};
			if (get().stepDelayMs > 0) {
				nextSettings.stepDelayMs = get().stepDelayMs;
			} else {
				delete nextSettings.stepDelayMs;
			}
			return Object.keys(nextSettings).length > 0 ? nextSettings : undefined;
		};

		const scheduleCanvasSave = (positions: PositionsMap, edges: Edge[]) => {
			clearTimer(saveTimerRef);
			saveTimerRef = setTimeoutFn(() => {
				saveTimerRef = null;
				void persistCanvasPositions(script.id, buildCanvasDataJson(positions, edges));
			}, 500);
		};

		const flushPendingEdits = (): ScriptStep[] => {
			clearTimer(updateSaveTimerRef);
			updateSaveTimerRef = null;
			const latest = pendingStepsRef ?? get().steps;
			pendingStepsRef = null;
			return latest;
		};

		const saveScript = async (newSteps: ScriptStep[]) => {
			set({ saving: true });
			try {
				const stepEdges = stripStartEdges(edgesRef);
				const stepPositions = { ...positionsRef };
				delete stepPositions[START_NODE_ID];
				const currentStartTarget = getStartEdgeTarget(edgesRef);

				const {
					nestedSteps,
					flatSteps: nextFlatSteps,
					orderedIds,
					remappedEdges,
					remappedPositions,
					orphanedCount,
					orphanedSteps,
				} = serializeControlFlowGraph(newSteps, stepEdges, stepPositions, currentStartTarget);
				const nextIndexByOldId = new Map(
					orderedIds.map((oldId, newIndex) => [oldId, newIndex] as const),
				);
				const rootId = findRootStepId(remappedEdges, nextFlatSteps.length);
				const remappedStartTarget =
					currentStartTarget === null
						? null
						: nextIndexByOldId.has(currentStartTarget)
							? `step-${nextIndexByOldId.get(currentStartTarget)}`
							: rootId;
				const startEdge = remappedStartTarget ? buildStartEdge(remappedStartTarget) : null;
				const nextEdges = startEdge ? [startEdge, ...remappedEdges] : remappedEdges;
				const startPos = positionsRef[START_NODE_ID];

				edgesRef = nextEdges;
				positionsRef = startPos
					? { ...remappedPositions, [START_NODE_ID]: startPos }
					: remappedPositions;

				clearTimer(saveTimerRef);
				saveTimerRef = null;

				set((state) => {
					const prevNodeById = new Map(state.nodes.map((node) => [node.id, node] as const));
					const startNode = prevNodeById.get(START_NODE_ID);
					const stepNodes = orderedIds.map((oldId, newIndex) => {
						const previousNode = prevNodeById.get(oldId) as Node<StepNodeData> | undefined;
						const node = buildStepCanvasNode(
							nextFlatSteps[newIndex],
							newIndex,
							remappedPositions[`step-${newIndex}`] ??
								previousNode?.position ?? { x: 120, y: newIndex * 120 + 60 },
							liveStatusesRef[newIndex],
						);
						if (previousNode?.selected) {
							node.selected = true;
						}
						return node;
					});

					return {
						steps: nextFlatSteps,
						nodes: startNode ? [startNode, ...stepNodes] : stepNodes,
						edges: nextEdges,
						selectedIndex:
							state.selectedIndex === null
								? null
								: (nextIndexByOldId.get(`step-${state.selectedIndex}`) ?? null),
					};
				});

				if (orphanedCount > 0) {
					const orphanedNames = nextFlatSteps
						.slice(nextFlatSteps.length - orphanedCount)
						.map((stepItem) => KIND_LABELS[stepItem.kind] || stepItem.kind)
						.join('、');
					toastWarning(
						i18next.t('canvas:orphan.warning', {
							count: orphanedCount,
							names: orphanedNames,
						}),
						{
							duration: 8000,
							action: {
								label: i18next.t('canvas:orphan.deleteAction'),
								onClick: () => {
									const kept = nextFlatSteps.slice(0, nextFlatSteps.length - orphanedCount);
									void saveScript(kept);
								},
							},
						},
					);
				}

				await saveGraph(script.id, {
					steps: nestedSteps,
					positionsJson: buildCanvasDataJson(positionsRef, nextEdges, orphanedSteps),
					settings: buildNextSettings(),
				});
				void emitUpdated(script.id);
				set({ savedAt: Date.now() });
				scheduleSavedAtClear();
			} finally {
				set({ saving: false });
			}
		};

		const flushPendingPersistence = async () => {
			if (!pendingStepsRef && !saveTimerRef) {
				return;
			}

			clearTimer(saveTimerRef);
			saveTimerRef = null;
			clearTimer(updateSaveTimerRef);
			updateSaveTimerRef = null;

			const currentSteps = pendingStepsRef ?? get().steps;
			pendingStepsRef = null;
			const cleanEdges = stripStartEdges(edgesRef);
			const cleanPositions = { ...positionsRef };
			delete cleanPositions[START_NODE_ID];
			const serialized = serializeControlFlowGraph(
				currentSteps,
				cleanEdges,
				cleanPositions,
				getStartEdgeTarget(edgesRef),
			);
			await saveGraph(script.id, {
				steps: serialized.nestedSteps,
				positionsJson: buildCanvasDataJson(positionsRef, edgesRef, serialized.orphanedSteps),
				settings: buildNextSettings(),
			});
		};

		return {
			steps: initFlatSteps,
			nodes: initialNodes,
			edges: initialEdgesWithStart,
			selectedIndex: null,
			saving: false,
			savedAt: null,
			stepDelayMs: script.settings?.stepDelayMs ?? 0,
			varsDefs: parseVarsDefs(script.variablesSchemaJson),
			setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
			setStepDelayMs: (stepDelayMs) => set({ stepDelayMs }),
			setVarsDefs: (varsDefs) => set({ varsDefs }),
			addStep: async (kind, viewportCenter) => {
				const baseSteps = flushPendingEdits();
				const lastStep = baseSteps[baseSteps.length - 1];
				if (lastStep && isTerminalStepKind(lastStep.kind)) {
					toastWarning(
						i18next.t('canvas:palette.terminalStepLocked', {
							step: KIND_LABELS[lastStep.kind] ?? lastStep.kind,
						}),
					);
					return;
				}

				const step = defaultStep(kind);
				const newIndex = baseSteps.length;
				const newSteps = [...baseSteps, step];
				let newPosition: { x: number; y: number };
				if (viewportCenter) {
					newPosition = { x: viewportCenter.x - 90, y: viewportCenter.y - 30 };
				} else {
					const lastPosition = positionsRef[`step-${newIndex - 1}`] ?? { x: 120, y: 0 };
					newPosition = { x: lastPosition.x, y: lastPosition.y + 140 };
				}

				positionsRef = {
					...positionsRef,
					[`step-${newIndex}`]: newPosition,
				};

				set((state) => ({
					steps: newSteps,
					nodes: [
						...state.nodes,
						buildStepCanvasNode(step, newIndex, newPosition, liveStatusesRef[newIndex]),
					],
				}));

				if (newIndex === 0) {
					const startEdge = buildStartEdge('step-0');
					const nextEdges = [
						startEdge,
						...edgesRef.filter((edge) => edge.source !== START_NODE_ID),
					];
					edgesRef = nextEdges;
					set({ edges: nextEdges });
					scheduleCanvasSave(positionsRef, nextEdges);
				} else {
					const connection: Edge = {
						id: `e-${newIndex - 1}-${newIndex}`,
						source: `step-${newIndex - 1}`,
						target: `step-${newIndex}`,
						type: 'smoothstep',
					};
					const nextEdges = addEdge(connection, edgesRef);
					edgesRef = nextEdges;
					set({ edges: nextEdges });
					scheduleCanvasSave(positionsRef, nextEdges);
				}

				await saveScript(newSteps);
			},
			updateStep: async (index, step) => {
				const newSteps = get().steps.map((stepItem, stepIndex) =>
					stepIndex === index ? step : stepItem,
				);
				set((state) => ({
					steps: newSteps,
					nodes: state.nodes.map((node) =>
						node.id === `step-${index}`
							? {
									...node,
									data: buildStepNodeData(step, index, liveStatusesRef[index]),
								}
							: node,
					),
				}));

				if (step.kind === 'confirm_dialog') {
					const buttonCount = step.buttons?.length ?? 0;
					const nodeId = `step-${index}`;
					const invalidEdges = edgesRef.filter((edge) => {
						if (edge.source !== nodeId || !edge.sourceHandle) {
							return false;
						}
						if (!edge.sourceHandle.startsWith('btn_')) {
							return false;
						}
						const buttonIndex = Number.parseInt(edge.sourceHandle.replace('btn_', ''), 10);
						return buttonIndex >= buttonCount;
					});
					if (invalidEdges.length > 0) {
						const invalidIds = new Set(invalidEdges.map((edge) => edge.id));
						const cleanedEdges = edgesRef.filter((edge) => !invalidIds.has(edge.id));
						edgesRef = cleanedEdges;
						set({ edges: cleanedEdges });
						scheduleCanvasSave(positionsRef, cleanedEdges);
					}
				}

				pendingStepsRef = newSteps;
				clearTimer(updateSaveTimerRef);
				updateSaveTimerRef = setTimeoutFn(() => {
					updateSaveTimerRef = null;
					const toSave = pendingStepsRef;
					pendingStepsRef = null;
					if (toSave) {
						void saveScript(toSave);
					}
				}, 300);
			},
			pasteSteps: async (stepsToAdd) => {
				if (stepsToAdd.length === 0) {
					return;
				}

				let currentSteps = flushPendingEdits();
				const lastStep = currentSteps[currentSteps.length - 1];
				if (lastStep && isTerminalStepKind(lastStep.kind)) {
					toastWarning(
						i18next.t('canvas:palette.terminalStepLocked', {
							step: KIND_LABELS[lastStep.kind] ?? lastStep.kind,
						}),
					);
					return;
				}

				let nextNodes = get().nodes;
				let nextEdges = edgesRef;
				for (const step of stepsToAdd) {
					const newIndex = currentSteps.length;
					currentSteps = [...currentSteps, step];
					const lastPosition = positionsRef[`step-${newIndex - 1}`] ?? { x: 120, y: 0 };
					const newPosition = { x: lastPosition.x, y: lastPosition.y + 140 };
					positionsRef = {
						...positionsRef,
						[`step-${newIndex}`]: newPosition,
					};
					nextNodes = [
						...nextNodes,
						buildStepCanvasNode(step, newIndex, newPosition, liveStatusesRef[newIndex]),
					];
					if (newIndex > 0) {
						const connection: Edge = {
							id: `e-${newIndex - 1}-${newIndex}`,
							source: `step-${newIndex - 1}`,
							target: `step-${newIndex}`,
							type: 'smoothstep',
						};
						nextEdges = addEdge(connection, nextEdges);
					}
				}

				edgesRef = nextEdges;
				set({
					steps: currentSteps,
					nodes: nextNodes,
					edges: nextEdges,
				});
				scheduleCanvasSave(positionsRef, nextEdges);
				await saveScript(currentSteps);
			},
			deleteStep: async (index) => {
				const baseSteps = flushPendingEdits();
				const newSteps = baseSteps.filter((_, stepIndex) => stepIndex !== index);
				const deletedId = `step-${index}`;

				const remappedEdges = edgesRef
					.filter((edge) => edge.source !== deletedId && edge.target !== deletedId)
					.map((edge) => {
						const sourceIndex = getStepIndexFromNodeId(edge.source);
						const targetIndex = getStepIndexFromNodeId(edge.target);
						const nextSourceIndex = sourceIndex > index ? sourceIndex - 1 : sourceIndex;
						const nextTargetIndex = targetIndex > index ? targetIndex - 1 : targetIndex;
						return {
							...edge,
							id: `e-${nextSourceIndex}-${nextTargetIndex}`,
							source: `step-${nextSourceIndex}`,
							target: `step-${nextTargetIndex}`,
						};
					});
				edgesRef = remappedEdges;

				const nextPositions = { ...positionsRef };
				delete nextPositions[deletedId];
				for (let stepIndex = index + 1; stepIndex <= baseSteps.length; stepIndex++) {
					const oldKey = `step-${stepIndex}`;
					if (nextPositions[oldKey]) {
						nextPositions[`step-${stepIndex - 1}`] = nextPositions[oldKey];
						delete nextPositions[oldKey];
					}
				}
				positionsRef = nextPositions;

				set((state) => ({
					steps: newSteps,
					selectedIndex: null,
					edges: remappedEdges,
					nodes: state.nodes
						.filter((node) => node.id !== deletedId)
						.map((node) => {
							if (!node.id.startsWith('step-')) {
								return node;
							}
							const nodeIndex = getStepIndexFromNodeId(node.id);
							if (nodeIndex <= index) {
								return nodeIndex === index
									? node
									: rebuildIndexedNode(
											node as Node<StepNodeData>,
											newSteps[nodeIndex],
											nodeIndex,
											liveStatusesRef[nodeIndex],
										);
							}
							return rebuildIndexedNode(
								node as Node<StepNodeData>,
								newSteps[nodeIndex - 1],
								nodeIndex - 1,
								liveStatusesRef[nodeIndex - 1],
							);
						}),
				}));

				scheduleCanvasSave(nextPositions, remappedEdges);
				await saveScript(newSteps);
			},
			onNodesChange: (changes) => {
				const removeChanges = changes.filter((change) => change.type === 'remove');
				if (removeChanges.length > 0) {
					const removedIndices = new Set(
						removeChanges
							.map((change) => getStepIndexFromNodeId(change.id))
							.filter((index) => !Number.isNaN(index)),
					);
					if (removedIndices.size > 0) {
						const baseSteps = flushPendingEdits();
						const sortedRemoved = [...removedIndices].sort((left, right) => left - right);
						const newSteps = baseSteps.filter((_, index) => !removedIndices.has(index));
						const deletedIds = new Set(removeChanges.map((change) => change.id));
						const survivingEdges = edgesRef.filter(
							(edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
						);
						const startEdges = survivingEdges.filter(
							(edge) => edge.source === START_NODE_ID || edge.target === START_NODE_ID,
						);
						const stepEdges = survivingEdges.filter(
							(edge) => edge.source !== START_NODE_ID && edge.target !== START_NODE_ID,
						);
						const remappedStepEdges = stepEdges.map((edge) => {
							const sourceIndex = getStepIndexFromNodeId(edge.source);
							const targetIndex = getStepIndexFromNodeId(edge.target);
							const sourceShift = sortedRemoved.filter((index) => index < sourceIndex).length;
							const targetShift = sortedRemoved.filter((index) => index < targetIndex).length;
							const nextSourceIndex = sourceShift > 0 ? sourceIndex - sourceShift : sourceIndex;
							const nextTargetIndex = targetShift > 0 ? targetIndex - targetShift : targetIndex;
							return {
								...edge,
								id: `e-${nextSourceIndex}-${nextTargetIndex}`,
								source: `step-${nextSourceIndex}`,
								target: `step-${nextTargetIndex}`,
							};
						});
						const remappedStartEdges = startEdges
							.filter((edge) => !deletedIds.has(edge.target))
							.map((edge) => {
								const targetIndex = getStepIndexFromNodeId(edge.target);
								if (Number.isNaN(targetIndex)) {
									return edge;
								}
								const targetShift = sortedRemoved.filter((index) => index < targetIndex).length;
								const nextTargetIndex = targetShift > 0 ? targetIndex - targetShift : targetIndex;
								return {
									...edge,
									id: `e-start-step-${nextTargetIndex}`,
									target: `step-${nextTargetIndex}`,
								};
							});
						const remappedEdges = [...remappedStartEdges, ...remappedStepEdges];
						const nextPositions = { ...positionsRef };
						for (const index of removedIndices) {
							delete nextPositions[`step-${index}`];
						}
						const existingKeys = Object.keys(nextPositions)
							.map((key) => getStepIndexFromNodeId(key))
							.filter((index) => !Number.isNaN(index))
							.sort((left, right) => right - left);
						for (const index of existingKeys) {
							const shift = sortedRemoved.filter((removed) => removed < index).length;
							if (shift > 0 && nextPositions[`step-${index}`]) {
								nextPositions[`step-${index - shift}`] = nextPositions[`step-${index}`];
								delete nextPositions[`step-${index}`];
							}
						}

						edgesRef = remappedEdges;
						positionsRef = nextPositions;
						set((state) => {
							const afterRemove = applyNodeChanges(changes, state.nodes) as Node[];
							return {
								steps: newSteps,
								selectedIndex: null,
								edges: remappedEdges,
								nodes: afterRemove.map((node) => {
									if (!node.id.startsWith('step-')) {
										return node;
									}
									const nodeIndex = getStepIndexFromNodeId(node.id);
									const shift = sortedRemoved.filter((removed) => removed < nodeIndex).length;
									const nextIndex = shift > 0 ? nodeIndex - shift : nodeIndex;
									return rebuildIndexedNode(
										node as Node<StepNodeData>,
										newSteps[nextIndex],
										nextIndex,
										liveStatusesRef[nextIndex],
									);
								}),
							};
						});
						scheduleCanvasSave(nextPositions, remappedEdges);
						queueMicrotaskFn(() => {
							void saveScript(newSteps).catch(() => {});
						});
						return;
					}
				}

				set((state) => ({
					nodes: applyNodeChanges(changes, state.nodes) as Node[],
				}));

				for (const change of changes) {
					if (change.type === 'position' && change.position) {
						positionsRef = {
							...positionsRef,
							[change.id]: change.position,
						};
						if (!change.dragging) {
							scheduleCanvasSave(positionsRef, edgesRef);
						}
					}
				}
			},
			onEdgesChange: (changes) => {
				const hasRemovals = changes.some((change) => change.type === 'remove');
				const isSelectOnly = changes.every((change) => change.type === 'select');
				set((state) => {
					const nextEdges = applyEdgeChanges(changes, state.edges);
					edgesRef = nextEdges;
					if (!isSelectOnly) {
						scheduleCanvasSave(positionsRef, nextEdges);
					}
					return { edges: nextEdges };
				});
				if (hasRemovals) {
					queueMicrotaskFn(() => {
						void saveScript(flushPendingEdits()).catch(() => {});
					});
				}
			},
			onConnect: (connection) => {
				if (connection.source === connection.target) {
					return;
				}
				if (connection.source && connection.source !== START_NODE_ID) {
					const sourceIndex = getStepIndexFromNodeId(connection.source);
					const sourceStep = get().steps[sourceIndex];
					if (sourceStep && isTerminalStepKind(sourceStep.kind)) {
						toastWarning(
							i18next.t('canvas:connection.terminalStepNoOutput', {
								step: KIND_LABELS[sourceStep.kind] ?? sourceStep.kind,
							}),
						);
						return;
					}
				}
				if (connection.source === START_NODE_ID) {
					set((state) => {
						const filtered = state.edges.filter((edge) => edge.source !== START_NODE_ID);
						const nextEdges = addEdge({ ...connection, type: 'smoothstep' }, filtered);
						edgesRef = nextEdges;
						scheduleCanvasSave(positionsRef, nextEdges);
						return { edges: nextEdges };
					});
					return;
				}
				set((state) => {
					const filtered = state.edges.filter(
						(edge) =>
							!(
								edge.target === connection.target &&
								edge.targetHandle === (connection.targetHandle ?? null)
							),
					);
					const nextEdges = addEdge({ ...connection, type: 'smoothstep' }, filtered);
					edgesRef = nextEdges;
					scheduleCanvasSave(positionsRef, nextEdges);
					return { edges: nextEdges };
				});
				queueMicrotaskFn(() => {
					void saveScript(flushPendingEdits()).catch(() => {});
				});
			},
			onNodeClick: (_event, node) => {
				const index = getStepIndexFromNodeId(node.id);
				set({ selectedIndex: Number.isNaN(index) ? null : index });
			},
			onPaneClick: () => set({ selectedIndex: null }),
			saveNow: async () => {
				const currentSteps = flushPendingEdits();
				await saveScript(currentSteps);
			},
			syncLiveStatuses: (liveStatuses) => {
				liveStatusesRef = { ...liveStatuses };
				set((state) => ({
					nodes: syncNodeStatuses(state.nodes as Node<StepNodeData>[], liveStatuses) as Node[],
				}));
			},
			syncConcurrentCounts: (counts) => {
				set((state) => ({
					nodes: (state.nodes as Node<StepNodeData>[]).map((node) => {
						if (!node.id.startsWith('step-')) return node;
						const idx = (node.data as StepNodeData).index;
						const count = counts[idx] ?? 0;
						if ((node.data as StepNodeData).concurrentCount === count) return node;
						return {
							...node,
							data: { ...(node.data as StepNodeData), concurrentCount: count },
						};
					}) as Node[],
				}));
			},
			flushPendingPersistence,
			dispose: async () => {
				await flushPendingPersistence();
				clearTimer(savedAtTimerRef);
				savedAtTimerRef = null;
				clearTimer(updateSaveTimerRef);
				updateSaveTimerRef = null;
				clearTimer(saveTimerRef);
				saveTimerRef = null;
			},
		};
	});

	return store;
}

export function useCanvasStore<T>(store: CanvasStoreApi, selector: (state: CanvasStore) => T): T {
	return useStore(store, selector);
}
