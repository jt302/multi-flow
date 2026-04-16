/**
 * automation-canvas-page.tsx
 * 自动化脚本画布页面（薄组合层）
 * 所有业务逻辑委托给 useCanvasState hook，UI 子组件已拆分到各自模块。
 */

import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	type OnSelectionChangeFunc,
	useReactFlow,
} from '@xyflow/react';

import type {
	AutomationScript,
	RunDelayConfig,
	ScriptStep,
	StepResult,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { RunDialog } from '@/features/automation/ui/run-dialog';

import { resolveCanvasDeleteTargets } from '../model/canvas-delete-shortcut';
import { useCanvasState } from '../model/use-canvas-state';
import { CanvasToolbar } from './canvas-toolbar';
import { StepPalette } from './step-palette';
import { StepPropertiesPanel } from './step-properties-panel';
import { START_NODE_ID } from '../model/canvas-helpers';
import { NODE_TYPES, type StepNodeData } from './step-node';
import { VariablesSchemaDialog } from './variables-schema-dialog';

// ─── InnerCanvas（需在 ReactFlowProvider 内部） ───────────────────────────────

type InnerProps = {
	script: AutomationScript;
	activeProfiles: ProfileItem[];
	allProfiles: ProfileItem[];
	isRunning: boolean;
	activeRunId: string | null;
	liveStatuses: Record<number, string>;
	onRun: (
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) => void;
	onDebugRun: (profileId: string, initialVars: Record<string, string>) => void;
	onCancel: () => void;
};

function InnerCanvas({
	script,
	activeProfiles,
	allProfiles,
	isRunning,
	activeRunId,
	liveStatuses,
	onRun,
	onDebugRun,
	onCancel,
}: InnerProps) {
	const { fitView, getNodes, getEdges, screenToFlowPosition } = useReactFlow();

	// 对话框 UI 状态（非业务逻辑，不放入 hook）
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);
	const [panelWidth, setPanelWidth] = useState(() => {
		const saved = localStorage.getItem('mf_canvas_panel_width');
		return saved ? Math.max(256, Math.min(600, Number(saved))) : 320;
	});
	const [paletteCollapsed, setPaletteCollapsed] = useState(false);

	// 边默认选项：增大交互宽度，使连接线更容易选中
	const defaultEdgeOptions = useMemo(
		() => ({ type: 'smoothstep', interactionWidth: 40 }),
		[],
	);

	// 所有业务状态和操作来自 hook
	const {
		steps,
		nodes,
		edges,
		selectedIndex,
		setSelectedIndex,
		saving,
		savedAt,
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
		saveNow,
	} = useCanvasState(script, liveStatuses);

	// ── 键盘快捷键 ─────────────────────────────────────────────────────────
	const clipboardRef = useRef<ScriptStep[]>([]);
	const lastClickedEdgeRef = useRef<string | null>(null);

	// 全局保存/删除快捷键保持页面任意位置都可触发，避免 Tauri 下画布焦点丢失时删线失效
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
			const mod = e.metaKey || e.ctrlKey;

			if (mod && e.key === 's') {
				e.preventDefault();
				void saveNow();
				return;
			}

			if (e.key !== 'Backspace' && e.key !== 'Delete') {
				return;
			}

			const { nodeIds, edgeIds } = resolveCanvasDeleteTargets(
				getNodes(),
				getEdges(),
				lastClickedEdgeRef.current,
			);
			if (nodeIds.length > 0) {
				e.preventDefault();
				onNodesChange(nodeIds.map((id) => ({ id, type: 'remove' as const })));
				lastClickedEdgeRef.current = null;
				return;
			}
			if (edgeIds.length > 0) {
				e.preventDefault();
				onEdgesChange(edgeIds.map((id) => ({ id, type: 'remove' as const })));
				lastClickedEdgeRef.current = null;
			}
		};
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [getEdges, getNodes, onEdgesChange, onNodesChange, saveNow]);

	// React onKeyDown 仅处理复制/粘贴等非删除快捷键
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey;
			const tag = (e.target as HTMLElement).tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

			if (mod && e.key === 'a') {
				e.preventDefault();
				onNodesChange(
					nodes.map((n) => ({
						id: n.id,
						type: 'select' as const,
						selected: true,
					})),
				);
				return;
			}
			if (mod && e.key === 'c') {
				const sel = getNodes().filter((n) => n.selected);
				if (sel.length === 0) return;
				clipboardRef.current = sel.map((n) =>
					structuredClone((n.data as StepNodeData).step),
				);
				return;
			}
			if (mod && e.key === 'v') {
				if (clipboardRef.current.length === 0) return;
				e.preventDefault();
				void pasteSteps(clipboardRef.current.map((s) => structuredClone(s)));
				return;
			}
			if (mod && e.key === 'd') {
				e.preventDefault();
				if (selectedIndex === null || !steps[selectedIndex]) return;
				void pasteSteps([structuredClone(steps[selectedIndex])]);
				return;
			}
		},
		[nodes, steps, selectedIndex, pasteSteps, onNodesChange, getNodes],
	);

	const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
		({ nodes: selectedNodes, edges: selectedEdges }) => {
			const selectedStepNodes = selectedNodes.filter(
				(node) => node.id !== START_NODE_ID,
			);
			lastClickedEdgeRef.current =
				selectedEdges.length === 1 ? selectedEdges[0].id : null;

			// 框选时自动关联选中连接这些节点之间的边
			if (selectedStepNodes.length >= 2) {
				const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
				const allEdges = getEdges();
				const edgeChanges = allEdges
					.filter((e) => e.source !== START_NODE_ID)
					.filter((e) => {
						const shouldSelect =
							selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target);
						return e.selected !== shouldSelect;
					})
					.map((e) => ({
						id: e.id,
						type: 'select' as const,
						selected:
							selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target),
					}));
				if (edgeChanges.length > 0) {
					onEdgesChange(edgeChanges);
				}
			}

			// 框选/取消选择时关闭属性面板（单击打开由 onNodeClick 处理）
			if (selectedStepNodes.length !== 1) {
				setSelectedIndex(null);
			}
			// 注意：不在这里设置 selectedIndex —— 只有 onNodeClick 才打开属性面板
			// 这样框选经过单个节点时不会弹出面板
		},
		[setSelectedIndex, getEdges, onEdgesChange],
	);

	const handleEdgeClick = useCallback(
		(_: React.MouseEvent, edge: { id: string }) => {
			lastClickedEdgeRef.current = edge.id;
			setSelectedIndex(null);
		},
		[setSelectedIndex],
	);

	// 挂载后执行一次 fitView
	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			className="flex flex-col h-screen outline-none"
			tabIndex={-1}
			onKeyDown={handleKeyDown}
		>
			{/* 顶部工具栏 */}
			<CanvasToolbar
				scriptName={script.name}
				stepCount={steps.length}
				saving={saving}
				savedAt={savedAt}
				stepDelayMs={stepDelayMs}
				onStepDelayChange={setStepDelayMs}
				isRunning={isRunning}
				activeRunId={activeRunId}
				onOpenRunDialog={() => setRunDialogOpen(true)}
				onCancel={onCancel}
				onOpenVariables={() => setVarsDialogOpen(true)}
				varsDefs={varsDefs}
				onSave={() => void saveNow()}
			/>

			{/* 运行对话框 */}
			<RunDialog
				open={runDialogOpen}
				onOpenChange={setRunDialogOpen}
				activeProfiles={activeProfiles}
				allProfiles={allProfiles}
				associatedProfileIds={script.associatedProfileIds}
				isRunning={isRunning}
				disabled={steps.length === 0}
				defaultVars={varsDefs.map((v) => ({
					key: v.name,
					value: v.defaultValue,
				}))}
				scriptSettings={script.settings}
				onRun={onRun}
				onDebugRun={onDebugRun}
			/>

			{/* 变量 Schema 对话框 */}
			<VariablesSchemaDialog
				open={varsDialogOpen}
				onOpenChange={setVarsDialogOpen}
				scriptId={script.id}
				initialVars={varsDefs}
				onSaved={setVarsDefs}
			/>

			{/* 主体：步骤面板 + 画布 + 属性面板 */}
			<div className="flex flex-1 overflow-hidden">
				{/* 左侧：步骤调色板 */}
				<StepPalette
					onAddStep={(kind) => {
						const el = document.querySelector('.react-flow');
						const rect = el?.getBoundingClientRect();
						const center = rect
							? screenToFlowPosition({
									x: rect.x + rect.width / 2,
									y: rect.y + rect.height / 2,
								})
							: undefined;
						void addStep(kind, center);
					}}
					collapsed={paletteCollapsed}
					onToggleCollapse={() => setPaletteCollapsed((p) => !p)}
				/>

				{/* 中间：ReactFlow 画布 */}
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
						selectionOnDrag={true}
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

				{/* 右侧：可拖拽分隔条 + 步骤属性面板（选中时显示） */}
				{selectedIndex !== null && steps[selectedIndex] && (
					<>
						<div
							className="w-px cursor-col-resize bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors flex-shrink-0"
							onMouseDown={(e) => {
								e.preventDefault();
								const startX = e.clientX;
								const startW = panelWidth;
								let latestW = startW;
								const onMove = (ev: MouseEvent) => {
									const delta = startX - ev.clientX;
									latestW = Math.max(256, Math.min(600, startW + delta));
									setPanelWidth(latestW);
								};
								const onUp = () => {
									window.removeEventListener('mousemove', onMove);
									window.removeEventListener('mouseup', onUp);
									localStorage.setItem(
										'mf_canvas_panel_width',
										String(latestW),
									);
								};
								window.addEventListener('mousemove', onMove);
								window.addEventListener('mouseup', onUp);
							}}
						/>
						<div
							style={{ width: panelWidth }}
							className="flex-shrink-0 bg-background flex flex-col min-h-0"
						>
							<StepPropertiesPanel
								step={steps[selectedIndex]}
								onUpdate={(s) => void updateStep(selectedIndex, s)}
								onDelete={() => void deleteStep(selectedIndex)}
								varsDefs={varsDefs}
								stepIndex={selectedIndex}
								allSteps={steps}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

// ─── 页面出口（ReactFlowProvider 包裹） ───────────────────────────────────────

type Props = {
	script: AutomationScript;
	activeProfiles: ProfileItem[];
	allProfiles: ProfileItem[];
	isRunning: boolean;
	activeRunId: string | null;
	liveStepResults: StepResult[];
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
	onRun,
	onDebugRun,
	onCancel,
}: Props) {
	// 将 StepResult[] 转为 index → status 映射，传给 InnerCanvas
	const liveStatuses = useMemo<Record<number, string>>(() => {
		const map: Record<number, string> = {};
		for (const r of liveStepResults) map[r.index] = r.status;
		return map;
	}, [liveStepResults]);

	return (
		<ReactFlowProvider>
			<InnerCanvas
				script={script}
				activeProfiles={activeProfiles}
				allProfiles={allProfiles}
				isRunning={isRunning}
				activeRunId={activeRunId}
				liveStatuses={liveStatuses}
				onRun={onRun}
				onDebugRun={onDebugRun}
				onCancel={onCancel}
			/>
		</ReactFlowProvider>
	);
}
