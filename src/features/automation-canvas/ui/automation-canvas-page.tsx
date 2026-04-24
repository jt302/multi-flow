/**
 * automation-canvas-page.tsx
 * 自动化脚本画布页面。
 * 使用页面级 canvas store，将 React Flow 热路径与外围面板拆开，避免拖拽时整页重渲染。
 */

import '@xyflow/react/dist/style.css';

import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	type OnSelectionChangeFunc,
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	useReactFlow,
} from '@xyflow/react';
import {
	type MutableRefObject,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import type {
	AutomationScript,
	RunDelayConfig,
	ScriptStep,
	StepResult,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { RunDialog } from '@/features/automation/ui/run-dialog';

import { resolveCanvasDeleteTargets } from '../model/canvas-delete-shortcut';
import { START_NODE_ID } from '../model/canvas-helpers';
import type { StepNodeData } from '../model/canvas-node-data';
import { type CanvasStoreApi, createCanvasStore, useCanvasStore } from '../model/canvas-store';
import { CanvasToolbar } from './canvas-toolbar';
import { NODE_TYPES } from './step-node';
import { StepPalette } from './step-palette';
import { StepPropertiesPanel } from './step-properties-panel';
import { VariablesSchemaDialog } from './variables-schema-dialog';

type InnerProps = {
	canvasStore: CanvasStoreApi;
	script: AutomationScript;
	activeProfiles: ProfileItem[];
	allProfiles: ProfileItem[];
	isRunning: boolean;
	activeRunId: string | null;
	onRun: (
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) => void;
	onDebugRun: (profileId: string, initialVars: Record<string, string>) => void;
	onCancel: () => void;
};

function CanvasToolbarHost({
	canvasStore,
	scriptName,
	isRunning,
	activeRunId,
	onOpenRunDialog,
	onCancel,
	onOpenVariables,
}: {
	canvasStore: CanvasStoreApi;
	scriptName: string;
	isRunning: boolean;
	activeRunId: string | null;
	onOpenRunDialog: () => void;
	onCancel: () => void;
	onOpenVariables: () => void;
}) {
	const stepCount = useCanvasStore(canvasStore, (state) => state.steps.length);
	const saving = useCanvasStore(canvasStore, (state) => state.saving);
	const savedAt = useCanvasStore(canvasStore, (state) => state.savedAt);
	const stepDelayMs = useCanvasStore(canvasStore, (state) => state.stepDelayMs);
	const varsDefs = useCanvasStore(canvasStore, (state) => state.varsDefs);
	const setStepDelayMs = useCanvasStore(canvasStore, (state) => state.setStepDelayMs);
	const saveNow = useCanvasStore(canvasStore, (state) => state.saveNow);

	return (
		<CanvasToolbar
			scriptName={scriptName}
			stepCount={stepCount}
			saving={saving}
			savedAt={savedAt}
			stepDelayMs={stepDelayMs}
			onStepDelayChange={setStepDelayMs}
			isRunning={isRunning}
			activeRunId={activeRunId}
			onOpenRunDialog={onOpenRunDialog}
			onCancel={onCancel}
			onOpenVariables={onOpenVariables}
			varsDefs={varsDefs}
			onSave={() => void saveNow()}
		/>
	);
}

function StepPaletteHost({
	canvasStore,
	collapsed,
	onToggleCollapse,
}: {
	canvasStore: CanvasStoreApi;
	collapsed: boolean;
	onToggleCollapse: () => void;
}) {
	const addStep = useCanvasStore(canvasStore, (state) => state.addStep);
	const { screenToFlowPosition } = useReactFlow();

	return (
		<StepPalette
			onAddStep={(kind) => {
				const element = document.querySelector('.react-flow');
				const rect = element?.getBoundingClientRect();
				const center = rect
					? screenToFlowPosition({
							x: rect.x + rect.width / 2,
							y: rect.y + rect.height / 2,
						})
					: undefined;
				void addStep(kind, center);
			}}
			collapsed={collapsed}
			onToggleCollapse={onToggleCollapse}
		/>
	);
}

function CanvasViewport({
	canvasStore,
	lastClickedEdgeRef,
}: {
	canvasStore: CanvasStoreApi;
	lastClickedEdgeRef: MutableRefObject<string | null>;
}) {
	const { fitView, getEdges } = useReactFlow();
	const nodes = useCanvasStore(canvasStore, (state) => state.nodes);
	const edges = useCanvasStore(canvasStore, (state) => state.edges);
	const onNodesChange = useCanvasStore(canvasStore, (state) => state.onNodesChange);
	const onEdgesChange = useCanvasStore(canvasStore, (state) => state.onEdgesChange);
	const onConnect = useCanvasStore(canvasStore, (state) => state.onConnect);
	const onNodeClick = useCanvasStore(canvasStore, (state) => state.onNodeClick);
	const onPaneClick = useCanvasStore(canvasStore, (state) => state.onPaneClick);

	const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep', interactionWidth: 40 }), []);

	const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
		({ nodes: selectedNodes, edges: selectedEdges }) => {
			const selectedStepNodes = selectedNodes.filter((node) => node.id !== START_NODE_ID);
			lastClickedEdgeRef.current = selectedEdges.length === 1 ? selectedEdges[0].id : null;

			if (selectedStepNodes.length >= 2) {
				const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
				const allEdges = getEdges();
				const edgeChanges = allEdges
					.filter((edge) => edge.source !== START_NODE_ID)
					.filter((edge) => {
						const shouldSelect =
							selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target);
						return edge.selected !== shouldSelect;
					})
					.map((edge) => ({
						id: edge.id,
						type: 'select' as const,
						selected: selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
					}));
				if (edgeChanges.length > 0) {
					onEdgesChange(edgeChanges);
				}
			}

			if (selectedStepNodes.length !== 1) {
				canvasStore.getState().setSelectedIndex(null);
			}
		},
		[canvasStore, getEdges, lastClickedEdgeRef, onEdgesChange],
	);

	const handleEdgeClick = useCallback(
		(_: ReactMouseEvent, edge: { id: string }) => {
			lastClickedEdgeRef.current = edge.id;
			canvasStore.getState().setSelectedIndex(null);
		},
		[canvasStore, lastClickedEdgeRef],
	);

	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		<div className="flex-1 overflow-hidden">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={NODE_TYPES}
				defaultEdgeOptions={defaultEdgeOptions}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onSelectionChange={handleSelectionChange}
				onConnect={onConnect}
				onNodeClick={(event, node) => {
					lastClickedEdgeRef.current = null;
					onNodeClick(event, node);
				}}
				onEdgeClick={handleEdgeClick}
				onPaneClick={() => {
					lastClickedEdgeRef.current = null;
					onPaneClick();
				}}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				deleteKeyCode={null}
				selectionOnDrag
				panOnDrag={[1, 2]}
				selectionMode={SelectionMode.Partial}
				connectionLineType={'smoothstep' as never}
				proOptions={{ hideAttribution: true }}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={20}
					size={1}
					color="var(--muted-foreground)"
					style={{ opacity: 0.15 }}
				/>
				<Controls showInteractive={false} />
				<MiniMap
					pannable
					zoomable
					style={{ width: 140, height: 100 }}
					maskColor="var(--background)"
				/>
			</ReactFlow>
		</div>
	);
}

function StepPropertiesSidebarHost({
	canvasStore,
	panelWidth,
	onPanelWidthChange,
}: {
	canvasStore: CanvasStoreApi;
	panelWidth: number;
	onPanelWidthChange: (width: number) => void;
}) {
	const selectedIndex = useCanvasStore(canvasStore, (state) => state.selectedIndex);
	const steps = useCanvasStore(canvasStore, (state) => state.steps);
	const varsDefs = useCanvasStore(canvasStore, (state) => state.varsDefs);
	const updateStep = useCanvasStore(canvasStore, (state) => state.updateStep);
	const deleteStep = useCanvasStore(canvasStore, (state) => state.deleteStep);

	if (selectedIndex === null || !steps[selectedIndex]) {
		return null;
	}

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: 这里是拖拽调整大小的手柄，不是点击按钮。 */}
			<div
				className="w-px cursor-col-resize bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors flex-shrink-0"
				onMouseDown={(event) => {
					event.preventDefault();
					const startX = event.clientX;
					const startWidth = panelWidth;
					let latestWidth = startWidth;
					const handleMove = (moveEvent: MouseEvent) => {
						const delta = startX - moveEvent.clientX;
						latestWidth = Math.max(256, Math.min(600, startWidth + delta));
						onPanelWidthChange(latestWidth);
					};
					const handleUp = () => {
						window.removeEventListener('mousemove', handleMove);
						window.removeEventListener('mouseup', handleUp);
						localStorage.setItem('mf_canvas_panel_width', String(latestWidth));
					};
					window.addEventListener('mousemove', handleMove);
					window.addEventListener('mouseup', handleUp);
				}}
			/>
			<div
				style={{ width: panelWidth }}
				className="flex-shrink-0 bg-background flex flex-col min-h-0"
			>
				<StepPropertiesPanel
					step={steps[selectedIndex]}
					onUpdate={(step) => void updateStep(selectedIndex, step)}
					onDelete={() => void deleteStep(selectedIndex)}
					varsDefs={varsDefs}
					stepIndex={selectedIndex}
					allSteps={steps}
				/>
			</div>
		</>
	);
}

function InnerCanvas({
	canvasStore,
	script,
	activeProfiles,
	allProfiles,
	isRunning,
	activeRunId,
	onRun,
	onDebugRun,
	onCancel,
}: InnerProps) {
	const { getEdges, getNodes } = useReactFlow();
	const varsDefs = useCanvasStore(canvasStore, (state) => state.varsDefs);
	const setVarsDefs = useCanvasStore(canvasStore, (state) => state.setVarsDefs);
	const stepCount = useCanvasStore(canvasStore, (state) => state.steps.length);

	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);
	const [panelWidth, setPanelWidth] = useState(() => {
		const saved = localStorage.getItem('mf_canvas_panel_width');
		return saved ? Math.max(256, Math.min(600, Number(saved))) : 320;
	});
	const [paletteCollapsed, setPaletteCollapsed] = useState(false);

	const clipboardRef = useRef<ScriptStep[]>([]);
	const lastClickedEdgeRef = useRef<string | null>(null);

	useEffect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			const tag = (event.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
				return;
			}
			const mod = event.metaKey || event.ctrlKey;

			if (mod && event.key === 's') {
				event.preventDefault();
				void canvasStore.getState().saveNow();
				return;
			}

			if (event.key !== 'Backspace' && event.key !== 'Delete') {
				return;
			}

			const { nodeIds, edgeIds } = resolveCanvasDeleteTargets(
				getNodes(),
				getEdges(),
				lastClickedEdgeRef.current,
			);
			if (nodeIds.length > 0) {
				event.preventDefault();
				canvasStore
					.getState()
					.onNodesChange(nodeIds.map((id) => ({ id, type: 'remove' as const })));
				lastClickedEdgeRef.current = null;
				return;
			}
			if (edgeIds.length > 0) {
				event.preventDefault();
				canvasStore
					.getState()
					.onEdgesChange(edgeIds.map((id) => ({ id, type: 'remove' as const })));
				lastClickedEdgeRef.current = null;
			}
		};

		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [canvasStore, getEdges, getNodes]);

	useEffect(() => {
		const handleBeforeUnload = () => {
			void canvasStore.getState().flushPendingPersistence();
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			void canvasStore.getState().dispose();
		};
	}, [canvasStore]);

	const handleKeyDown = useCallback(
		(event: ReactKeyboardEvent) => {
			const mod = event.metaKey || event.ctrlKey;
			const tag = (event.target as HTMLElement).tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
				return;
			}

			if (mod && event.key === 'a') {
				event.preventDefault();
				canvasStore.getState().onNodesChange(
					getNodes().map((node) => ({
						id: node.id,
						type: 'select' as const,
						selected: true,
					})),
				);
				return;
			}

			if (mod && event.key === 'c') {
				const selectedNodes = getNodes().filter((node) => node.selected);
				if (selectedNodes.length === 0) {
					return;
				}
				clipboardRef.current = selectedNodes.map((node) =>
					structuredClone((node.data as StepNodeData).step),
				);
				return;
			}

			if (mod && event.key === 'v') {
				if (clipboardRef.current.length === 0) {
					return;
				}
				event.preventDefault();
				void canvasStore
					.getState()
					.pasteSteps(clipboardRef.current.map((step) => structuredClone(step)));
				return;
			}

			if (mod && event.key === 'd') {
				event.preventDefault();
				const { selectedIndex, steps, pasteSteps } = canvasStore.getState();
				if (selectedIndex === null || !steps[selectedIndex]) {
					return;
				}
				void pasteSteps([structuredClone(steps[selectedIndex])]);
			}
		},
		[canvasStore, getNodes],
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 画布根节点需要接收编辑器快捷键。
		<div className="flex flex-col h-screen outline-none" tabIndex={-1} onKeyDown={handleKeyDown}>
			<CanvasToolbarHost
				canvasStore={canvasStore}
				scriptName={script.name}
				isRunning={isRunning}
				activeRunId={activeRunId}
				onOpenRunDialog={() => setRunDialogOpen(true)}
				onCancel={onCancel}
				onOpenVariables={() => setVarsDialogOpen(true)}
			/>

			<RunDialog
				open={runDialogOpen}
				onOpenChange={setRunDialogOpen}
				activeProfiles={activeProfiles}
				allProfiles={allProfiles}
				associatedProfileIds={script.associatedProfileIds}
				isRunning={isRunning}
				disabled={stepCount === 0}
				defaultVars={varsDefs.map((variable) => ({
					key: variable.name,
					value: variable.defaultValue,
				}))}
				scriptSettings={script.settings}
				onRun={onRun}
				onDebugRun={onDebugRun}
			/>

			<VariablesSchemaDialog
				open={varsDialogOpen}
				onOpenChange={setVarsDialogOpen}
				scriptId={script.id}
				initialVars={varsDefs}
				onSaved={setVarsDefs}
			/>

			<div className="flex flex-1 overflow-hidden">
				<StepPaletteHost
					canvasStore={canvasStore}
					collapsed={paletteCollapsed}
					onToggleCollapse={() => setPaletteCollapsed((collapsed) => !collapsed)}
				/>
				<CanvasViewport canvasStore={canvasStore} lastClickedEdgeRef={lastClickedEdgeRef} />
				<StepPropertiesSidebarHost
					canvasStore={canvasStore}
					panelWidth={panelWidth}
					onPanelWidthChange={setPanelWidth}
				/>
			</div>
		</div>
	);
}

type Props = {
	script: AutomationScript;
	activeProfiles: ProfileItem[];
	allProfiles: ProfileItem[];
	isRunning: boolean;
	activeRunId: string | null;
	liveStepResults: StepResult[];
	/** step index → 当前并发执行的 profile 数量，用于节点角标 */
	concurrentCounts?: Record<number, number>;
	onRun: (
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) => void;
	onDebugRun: (profileId: string, initialVars: Record<string, string>) => void;
	onCancel: () => void;
};

export function AutomationCanvasPage({
	script,
	activeProfiles,
	allProfiles,
	isRunning,
	activeRunId,
	liveStepResults,
	concurrentCounts,
	onRun,
	onDebugRun,
	onCancel,
}: Props) {
	const canvasStore = useMemo(() => createCanvasStore(script), [script.id, script]);

	useEffect(() => {
		const liveStatuses: Record<number, string> = {};
		for (const result of liveStepResults) {
			liveStatuses[result.index] = result.status;
		}
		canvasStore.getState().syncLiveStatuses(liveStatuses);
	}, [canvasStore, liveStepResults]);

	useEffect(() => {
		if (concurrentCounts) {
			canvasStore.getState().syncConcurrentCounts(concurrentCounts);
		}
	}, [canvasStore, concurrentCounts]);

	return (
		<ReactFlowProvider>
			<InnerCanvas
				canvasStore={canvasStore}
				script={script}
				activeProfiles={activeProfiles}
				allProfiles={allProfiles}
				isRunning={isRunning}
				activeRunId={activeRunId}
				onRun={onRun}
				onDebugRun={onDebugRun}
				onCancel={onCancel}
			/>
		</ReactFlowProvider>
	);
}
