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
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	useReactFlow,
} from '@xyflow/react';

import type {
	AutomationScript,
	ScriptStep,
	StepResult,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { RunDialog } from '@/features/automation/ui/run-dialog';

import { useCanvasState } from '../model/use-canvas-state';
import { CanvasToolbar } from './canvas-toolbar';
import { StepPalette } from './step-palette';
import { StepPropertiesPanel } from './step-properties-panel';
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
	onRun: (profileIds: string[], initialVars: Record<string, string>) => void;
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
	const { fitView, getNodes } = useReactFlow();

	// 对话框 UI 状态（非业务逻辑，不放入 hook）
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);
	const [panelWidth, setPanelWidth] = useState(320);

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

	// ── 键盘快捷键：复制 / 粘贴 / 全选 / 复制节点 ──────────────────────────
	const clipboardRef = useRef<ScriptStep[]>([]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey;

			// Cmd+S 保存（不受焦点限制）
			if (mod && e.key === 's') {
				e.preventDefault();
				void saveNow();
				return;
			}

			const tag = (e.target as HTMLElement).tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

			if (mod && e.key === 'a') {
				e.preventDefault();
				onNodesChange(
					nodes.map((n) => ({ id: n.id, type: 'select' as const, selected: true })),
				);
				return;
			}
			if (mod && e.key === 'c') {
				const sel = getNodes().filter((n) => n.selected);
				if (sel.length === 0) return;
				clipboardRef.current = sel.map((n) => structuredClone((n.data as StepNodeData).step));
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

			// Backspace/Delete: 删除选中的边
			if (e.key === 'Backspace' || e.key === 'Delete') {
				const selectedEdges = edges.filter((edge) => edge.selected);
				if (selectedEdges.length > 0) {
					onEdgesChange(
						selectedEdges.map((edge) => ({ id: edge.id, type: 'remove' as const })),
					);
				}
			}
		},
		[nodes, edges, steps, selectedIndex, pasteSteps, onNodesChange, onEdgesChange, getNodes, saveNow],
	);

	// 挂载后执行一次 fitView
	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div className="flex flex-col h-screen outline-none" tabIndex={-1} onKeyDown={handleKeyDown}>
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
				<StepPalette onAddStep={(kind) => void addStep(kind)} />

				{/* 中间：ReactFlow 画布 */}
				<div className="flex-1 overflow-hidden">
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={NODE_TYPES}
						defaultEdgeOptions={defaultEdgeOptions}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						onNodeClick={onNodeClick}
						onPaneClick={onPaneClick}
						fitView
						fitViewOptions={{ padding: 0.2 }}
						deleteKeyCode="Backspace"
						selectionOnDrag={true}
						panOnDrag={[1, 2]}
						selectionMode={SelectionMode.Partial}
						connectionLineType={'smoothstep' as never}
						proOptions={{ hideAttribution: true }}
					>
						<Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--muted-foreground)" style={{ opacity: 0.3 }} />
						<Controls />
					</ReactFlow>
				</div>

				{/* 右侧：可拖拽分隔条 + 步骤属性面板（选中时显示） */}
				{selectedIndex !== null && steps[selectedIndex] && (
					<>
						<div
							className="w-1 cursor-col-resize bg-border/50 hover:bg-primary/40 active:bg-primary/60 transition-colors flex-shrink-0"
							onMouseDown={(e) => {
								e.preventDefault();
								const startX = e.clientX;
								const startW = panelWidth;
								const onMove = (ev: MouseEvent) => {
									const delta = startX - ev.clientX;
									setPanelWidth(Math.max(256, Math.min(600, startW + delta)));
								};
								const onUp = () => {
									window.removeEventListener('mousemove', onMove);
									window.removeEventListener('mouseup', onUp);
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
	onRun: (profileIds: string[], initialVars: Record<string, string>) => void;
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
