/**
 * automation-canvas-page.tsx
 * 自动化脚本画布页面（薄组合层）
 * 所有业务逻辑委托给 useCanvasState hook，UI 子组件已拆分到各自模块。
 */

import '@xyflow/react/dist/style.css';

import { useEffect, useMemo, useState } from 'react';

import {
	Background,
	BackgroundVariant,
	Controls,
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	useReactFlow,
} from '@xyflow/react';

import type { AutomationScript, StepResult } from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { RunDialog } from '@/features/automation/ui/run-dialog';

import { useCanvasState } from '../model/use-canvas-state';
import { CanvasToolbar } from './canvas-toolbar';
import { StepPalette } from './step-palette';
import { StepPropertiesPanel } from './step-properties-panel';
import { NODE_TYPES } from './step-node';
import { VariablesSchemaDialog } from './variables-schema-dialog';

// ─── InnerCanvas（需在 ReactFlowProvider 内部） ───────────────────────────────

type InnerProps = {
	script: AutomationScript;
	activeProfiles: ProfileItem[];
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
	isRunning,
	activeRunId,
	liveStatuses,
	onRun,
	onDebugRun,
	onCancel,
}: InnerProps) {
	const { fitView } = useReactFlow();

	// 对话框 UI 状态（非业务逻辑，不放入 hook）
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);

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
		deleteStep,
		onNodesChange,
		onEdgesChange,
		onConnect,
		onNodeClick,
		onPaneClick,
	} = useCanvasState(script, liveStatuses);

	// 挂载后执行一次 fitView
	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		<div className="flex flex-col h-screen">
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
			/>

			{/* 运行对话框 */}
			<RunDialog
				open={runDialogOpen}
				onOpenChange={setRunDialogOpen}
				activeProfiles={activeProfiles}
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
					>
						<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
						<Controls />
					</ReactFlow>
				</div>

				{/* 右侧：步骤属性面板（选中时显示） */}
				{selectedIndex !== null && steps[selectedIndex] && (
					<div className="w-64 border-l flex-shrink-0 bg-background flex flex-col min-h-0">
						<StepPropertiesPanel
							step={steps[selectedIndex]}
							onUpdate={(s) => void updateStep(selectedIndex, s)}
							onDelete={() => void deleteStep(selectedIndex)}
							varsDefs={varsDefs}
							stepIndex={selectedIndex}
							allSteps={steps}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── 页面出口（ReactFlowProvider 包裹） ───────────────────────────────────────

type Props = {
	script: AutomationScript;
	activeProfiles: ProfileItem[];
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
