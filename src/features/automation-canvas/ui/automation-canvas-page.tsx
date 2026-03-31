import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
	Background,
	BackgroundVariant,
	Controls,
	Handle,
	Position,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	useReactFlow,
} from '@xyflow/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
	ArrowLeft,
	CheckCircle,
	ChevronDown,
	FolderOpen,
	Loader2,
	Minus,
	Play,
	Plus,
	Square,
	Trash2,
	Variable,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

import type {
	AutomationScript,
	ScriptStep,
	ScriptVarDef,
	StepResult,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import {
	emitScriptUpdated,
	updateAutomationScript,
	updateScriptCanvasPositions,
	updateScriptVariablesSchema,
} from '@/entities/automation/api/automation-api';
import {
	GROUP_COLORS,
	KIND_GROUPS,
	KIND_LABELS,
	PALETTE_DOT_COLORS,
	PALETTE_GROUPS,
	defaultStep,
	getStepSummaryText,
} from '@/entities/automation/model/step-registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';
import { RunDialog } from '@/features/automation/ui/run-dialog';

const STEP_STATUS_RING: Record<string, string> = {
	running: 'ring-2 ring-blue-500 ring-offset-1',
	success: 'ring-2 ring-green-500 ring-offset-1',
	failed: 'ring-2 ring-red-500 ring-offset-1',
	waiting_human: 'ring-2 ring-amber-400 ring-offset-1 animate-pulse',
};

// ─── Custom node ──────────────────────────────────────────────────────────────

type StepNodeData = { step: ScriptStep; index: number; stepStatus?: string };

const HANDLE_CLS =
	'!w-2.5 !h-2.5 !bg-muted-foreground/40 hover:!bg-primary !border-0 !rounded-full';

function StepNodeComponent({
	data,
	selected,
}: {
	data: StepNodeData;
	selected?: boolean;
}) {
	const { step, index, stepStatus } = data;
	const kind = step.kind;
	const label = KIND_LABELS[kind] ?? kind;
	const group = KIND_GROUPS[kind] ?? '通用';
	const colorClass = GROUP_COLORS[group] ?? GROUP_COLORS['通用'];
	const ringClass = stepStatus ? (STEP_STATUS_RING[stepStatus] ?? '') : '';
	const selectedClass = selected ? 'ring-2 ring-primary ring-offset-2' : '';
	const summary = getStepSummaryText(step);
	const isCondition = kind === 'condition';

	return (
		<div
			className={`relative min-w-[160px] max-w-[220px] rounded-lg border bg-background shadow-sm px-3 py-2 cursor-pointer ${selectedClass} ${ringClass}`}
		>
			<Handle type="target" position={Position.Top} className={HANDLE_CLS} />
			<div className="flex items-center gap-1.5 mb-1">
				<span className="text-[10px] text-muted-foreground font-mono">
					#{index + 1}
				</span>
				<span
					className={`text-[10px] font-medium px-1 rounded border ${colorClass}`}
				>
					{group}
				</span>
			</div>
			<div className="text-xs font-semibold truncate">{label}</div>
			{summary && (
				<div className="text-[10px] text-muted-foreground truncate mt-0.5">
					{summary}
				</div>
			)}
			{isCondition ? (
				<>
					<div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground select-none">
						<span className="pl-3">then</span>
						<span className="pr-3">else</span>
					</div>
					<Handle
						type="source"
						position={Position.Bottom}
						id="then"
						style={{ left: '30%' }}
						className={HANDLE_CLS}
					/>
					<Handle
						type="source"
						position={Position.Bottom}
						id="else"
						style={{ left: '70%' }}
						className={HANDLE_CLS}
					/>
				</>
			) : (
				<Handle
					type="source"
					position={Position.Bottom}
					className={HANDLE_CLS}
				/>
			)}
		</div>
	);
}

const NODE_TYPES = { step: StepNodeComponent };

// ─── Properties panel ────────────────────────────────────────────────────────

function StepPropertiesPanel({
	step,
	onUpdate,
	onDelete,
	varsDefs,
	stepIndex,
	allSteps,
}: {
	step: ScriptStep;
	onUpdate: (step: ScriptStep) => void;
	onDelete: () => void;
	varsDefs: ScriptVarDef[];
	stepIndex: number;
	allSteps: ScriptStep[];
}) {
	const s = step as Record<string, unknown>;
	const kind = step.kind;
	// 计算可用变量
	const availableVars: { name: string; source: string }[] = [
		// 脚本级变量
		...varsDefs.map((v) => ({ name: v.name, source: '脚本变量' })),
		// 前置步骤输出变量
		...allSteps.slice(0, stepIndex).flatMap((stepItem, i) => {
			const stepRecord = stepItem as Record<string, unknown>;
			const results: { name: string; source: string }[] = [];
			if (
				typeof stepRecord['output_key'] === 'string' &&
				stepRecord['output_key']
			) {
				results.push({
					name: stepRecord['output_key'] as string,
					source: `步骤 ${i + 1}`,
				});
			}
			if (
				typeof stepRecord['output_key_base64'] === 'string' &&
				stepRecord['output_key_base64']
			) {
				results.push({
					name: stepRecord['output_key_base64'] as string,
					source: `步骤 ${i + 1}`,
				});
			}
			if (
				typeof stepRecord['iter_var'] === 'string' &&
				stepRecord['iter_var']
			) {
				results.push({
					name: stepRecord['iter_var'] as string,
					source: `步骤 ${i + 1}`,
				});
			}
			return results;
		}),
	];

	function tf(key: string, label: string, multi = false) {
		const value = String(s[key] ?? '');
		const inputId = `tf-${key}`;

		function insertVar(varName: string) {
			const insertion = `{{${varName}}}`;
			const el = document.getElementById(inputId) as
				| HTMLInputElement
				| HTMLTextAreaElement
				| null;
			if (el) {
				const start = el.selectionStart ?? value.length;
				const end = el.selectionEnd ?? value.length;
				const newVal = value.slice(0, start) + insertion + value.slice(end);
				onUpdate({ ...step, [key]: newVal } as ScriptStep);
				// 异步设置光标位置
				setTimeout(() => {
					el.focus();
					el.setSelectionRange(
						start + insertion.length,
						start + insertion.length,
					);
				}, 0);
			} else {
				// fallback: append at end
				onUpdate({ ...step, [key]: value + insertion } as ScriptStep);
			}
		}

		const varButton =
			availableVars.length > 0 ? (
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 flex-shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
							title="插入变量"
						>
							<Variable className="h-3.5 w-3.5" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-52 p-1" align="end">
						<div className="text-xs text-muted-foreground px-2 py-1 font-medium">
							选择变量
						</div>
						{availableVars.map((v, i) => (
							<button
								key={`${v.name}-${v.source}-${i}`}
								type="button"
								className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent cursor-pointer flex items-center justify-between gap-2"
								onClick={() => insertVar(v.name)}
							>
								<span className="font-mono text-blue-500 truncate">{`{{${v.name}}}`}</span>
								<span className="text-muted-foreground flex-shrink-0">
									{v.source}
								</span>
							</button>
						))}
					</PopoverContent>
				</Popover>
			) : null;

		return (
			<div key={key} className="space-y-1">
				<Label className="text-xs">{label}</Label>
				{multi ? (
					<div className="relative">
						<Textarea
							id={inputId}
							value={value}
							onChange={(e) =>
								onUpdate({ ...step, [key]: e.target.value } as ScriptStep)
							}
							className="text-xs min-h-[60px] pr-8"
						/>
						{varButton && (
							<div className="absolute top-1 right-1">{varButton}</div>
						)}
					</div>
				) : (
					<div className="flex gap-1">
						<Input
							id={inputId}
							value={value}
							onChange={(e) =>
								onUpdate({ ...step, [key]: e.target.value } as ScriptStep)
							}
							className="h-8 text-xs flex-1"
						/>
						{varButton}
					</div>
				)}
			</div>
		);
	}

	function nf(key: string, label: string) {
		return (
			<div key={key} className="space-y-1">
				<Label className="text-xs">{label}</Label>
				<Input
					type="number"
					value={Number(s[key] ?? 0)}
					onChange={(e) =>
						onUpdate({ ...step, [key]: Number(e.target.value) } as ScriptStep)
					}
					className="h-8 text-xs"
				/>
			</div>
		);
	}

	function sf(label = '元素选择器', optional = false) {
		const sType = String(s['selector_type'] ?? 'css');
		const placeholder =
			sType === 'xpath'
				? '//div[@id="main"]'
				: sType === 'text'
					? '按文本内容匹配'
					: optional
						? 'CSS 选择器（留空则按坐标）'
						: 'CSS 选择器';
		return (
			<div key="selector" className="space-y-1">
				<Label className="text-xs">{label}</Label>
				<div className="flex gap-1.5">
					<Select
						value={sType}
						onValueChange={(v) =>
							onUpdate({ ...step, selector_type: v } as ScriptStep)
						}
					>
						<SelectTrigger className="h-8 w-[80px] text-xs flex-shrink-0 cursor-pointer">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="css">CSS</SelectItem>
							<SelectItem value="xpath">XPath</SelectItem>
							<SelectItem value="text">Text</SelectItem>
						</SelectContent>
					</Select>
					<Input
						value={String(s['selector'] ?? '')}
						onChange={(e) =>
							onUpdate({ ...step, selector: e.target.value } as ScriptStep)
						}
						placeholder={placeholder}
						className="h-8 text-xs font-mono flex-1"
					/>
				</div>
			</div>
		);
	}

	function outputKeyField(key: string, label: string) {
		const value = String(s[key] ?? '');
		return (
			<div key={key} className="space-y-1">
				<Label className="text-xs">{label}</Label>
				<div className="flex gap-1">
					<Input
						value={value}
						onChange={(e) =>
							onUpdate({ ...step, [key]: e.target.value } as ScriptStep)
						}
						placeholder="新变量名或选择已有"
						className="h-8 text-xs flex-1"
					/>
					{availableVars.length > 0 && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-8 w-8 flex-shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
									title="选择已有变量"
								>
									<ChevronDown className="h-3.5 w-3.5" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-52 p-1" align="end">
								<div className="text-xs text-muted-foreground px-2 py-1 font-medium">
									选择已有变量
								</div>
								{availableVars.map((v) => (
									<button
										key={`${v.name}-${v.source}`}
										type="button"
										className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent cursor-pointer flex items-center justify-between gap-2"
										onClick={() =>
											onUpdate({ ...step, [key]: v.name } as ScriptStep)
										}
									>
										<span className="font-mono text-blue-500 truncate">
											{v.name}
										</span>
										<span className="text-muted-foreground flex-shrink-0 text-[10px]">
											{v.source}
										</span>
									</button>
								))}
							</PopoverContent>
						</Popover>
					)}
				</div>
			</div>
		);
	}
	const okf = () => outputKeyField('output_key', '输出变量名');

	const fields: React.ReactNode[] = [];
	if (kind === 'navigate' || kind === 'cdp_navigate') {
		fields.push(tf('url', 'URL'));
		fields.push(okf());
	} else if (kind === 'wait') {
		fields.push(nf('ms', '等待毫秒数'));
	} else if (kind === 'evaluate' || kind === 'cdp_evaluate') {
		fields.push(tf('expression', 'JS 表达式', true));
		fields.push(okf());
	} else if (kind === 'click' || kind === 'cdp_click') {
		fields.push(sf());
	} else if (kind === 'type' || kind === 'cdp_type') {
		fields.push(sf());
		fields.push(tf('text', '输入文本'));
	} else if (kind === 'cdp_get_text') {
		fields.push(sf());
		fields.push(okf());
	} else if (kind === 'cdp_wait_for_selector') {
		fields.push(sf());
		fields.push(nf('timeout_ms', '超时毫秒数'));
	} else if (kind === 'cdp_wait_for_page_load') {
		fields.push(nf('timeout_ms', '超时毫秒数'));
	} else if (kind === 'cdp_scroll_to') {
		fields.push(sf('元素选择器（可选）', true));
	} else if (kind === 'cdp_screenshot') {
		fields.push(outputKeyField('output_key_base64', 'Base64 变量名'));
		const pathValue = String(s['output_path'] ?? '');
		fields.push(
			<div key="output_path" className="space-y-1">
				<Label className="text-xs">保存路径</Label>
				<div className="flex gap-1">
					<Input
						value={pathValue}
						onChange={(e) =>
							onUpdate({ ...step, output_path: e.target.value } as ScriptStep)
						}
						placeholder="~/Desktop/screenshot.png"
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title="选择保存路径"
						onClick={async () => {
							const selected = await saveDialog({
								defaultPath: pathValue || 'screenshot.png',
								filters: [
									{ name: '图片文件', extensions: ['png', 'jpeg', 'jpg'] },
								],
							});
							if (selected) {
								onUpdate({
									...step,
									output_path:
										typeof selected === 'string' ? selected : selected,
								} as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
	} else if (kind === 'wait_for_user') {
		fields.push(tf('message', '提示消息', true));
		fields.push(tf('input_label', '输入框标签（留空则无输入框）'));
		fields.push(okf());
		fields.push(nf('timeout_ms', '超时毫秒数（0=不超时）'));
	} else if (kind === 'condition') {
		fields.push(tf('condition_expr', '条件表达式'));
	} else if (kind === 'loop') {
		fields.push(nf('count', '循环次数'));
		fields.push(tf('iter_var', '迭代变量名（可选）'));
	} else if (kind === 'ai_prompt') {
		fields.push(tf('prompt', 'Prompt（支持 {{变量}}）', true));
		fields.push(tf('image_var', '图片变量名（可选）'));
		fields.push(okf());
	} else if (kind === 'ai_extract') {
		fields.push(tf('prompt', 'Prompt（支持 {{变量}}）', true));
	} else if (kind === 'ai_agent') {
		fields.push(tf('system_prompt', '系统提示词', true));
		fields.push(tf('initial_message', '初始消息（支持 {{变量}}）', true));
		fields.push(nf('max_steps', '最大循环轮次'));
		fields.push(okf());
	} else if (kind === 'magic_open_new_tab') {
		fields.push(tf('url', 'URL'));
		fields.push(okf());
	} else if (kind === 'magic_set_bounds') {
		fields.push(nf('x', 'X'));
		fields.push(nf('y', 'Y'));
		fields.push(nf('width', '宽度'));
		fields.push(nf('height', '高度'));
	} else if (
		[
			'magic_get_browsers',
			'magic_get_bounds',
			'magic_capture_app_shell',
		].includes(kind)
	) {
		fields.push(okf());
	}

	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
				<span className="text-xs font-semibold">
					{KIND_LABELS[kind] ?? kind}
				</span>
				<Button
					size="sm"
					variant="ghost"
					className="h-6 w-6 p-0 cursor-pointer text-destructive hover:text-destructive"
					onClick={onDelete}
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto min-h-0 p-3">
				<div className="space-y-3">
					{fields.length > 0 ? (
						fields
					) : (
						<p className="text-xs text-muted-foreground">此步骤无可编辑字段</p>
					)}
				</div>
			</div>
		</div>
	);
}

// ─── Node / edge builders ─────────────────────────────────────────────────────

type PositionsMap = Record<string, { x: number; y: number }>;

function buildNodes(
	steps: ScriptStep[],
	positions: PositionsMap,
	liveStatuses: Record<number, string>,
): Node[] {
	return steps.map((step, i) => {
		const id = `step-${i}`;
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

function buildDefaultEdges(count: number): Edge[] {
	return Array.from({ length: count - 1 }, (_, i) => ({
		id: `e-${i}-${i + 1}`,
		source: `step-${i}`,
		target: `step-${i + 1}`,
		type: 'smoothstep',
	}));
}

type StoredEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
};

function parseCanvasData(
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

/**
 * 根据画布边对 steps 进行拓扑排序（BFS）
 * 返回重排后的数组、旧index→新index映射、以及孤立节点数量
 */
function topologySortSteps(
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
		// 取最小 index 的根节点（稳定排序）
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

function validateSteps(stepList: ScriptStep[]): string[] {
	const errs: string[] = [];
	stepList.forEach((step, i) => {
		const s = step as Record<string, unknown>;
		const label = `步骤 ${i + 1}（${KIND_LABELS[step.kind] ?? step.kind}）`;
		const empty = (k: string) => !String(s[k] ?? '').trim();
		if (
			['navigate', 'cdp_navigate', 'magic_open_new_tab'].includes(step.kind) &&
			empty('url')
		)
			errs.push(`${label}：URL 不能为空`);
		if (
			[
				'click',
				'cdp_click',
				'cdp_wait_for_selector',
				'cdp_get_text',
				'cdp_scroll_to',
			].includes(step.kind) &&
			empty('selector')
		)
			errs.push(`${label}：选择器不能为空`);
		if (['type', 'cdp_type'].includes(step.kind)) {
			if (empty('selector')) errs.push(`${label}：选择器不能为空`);
			if (empty('text')) errs.push(`${label}：输入文本不能为空`);
		}
		if (['evaluate', 'cdp_evaluate'].includes(step.kind) && empty('expression'))
			errs.push(`${label}：JS 表达式不能为空`);
		if (step.kind === 'ai_prompt' && empty('prompt'))
			errs.push(`${label}：Prompt 不能为空`);
		if (step.kind === 'ai_extract' && empty('prompt'))
			errs.push(`${label}：Prompt 不能为空`);
		if (step.kind === 'ai_agent' && empty('system_prompt'))
			errs.push(`${label}：系统提示词不能为空`);
		if (step.kind === 'cdp_get_attribute') {
			if (empty('selector')) errs.push(`${label}：选择器不能为空`);
			if (empty('attribute')) errs.push(`${label}：属性名不能为空`);
		}
		if (step.kind === 'cdp_set_input_value') {
			if (empty('selector')) errs.push(`${label}：选择器不能为空`);
			if (empty('value')) errs.push(`${label}：值不能为空`);
		}
		if (step.kind === 'cdp_screenshot' && empty('output_path'))
			errs.push(`${label}：保存路径不能为空`);
	});
	return errs;
}

// ─── Variables Schema Dialog ──────────────────────────────────────────────────

function VariablesSchemaDialog({
	open,
	onOpenChange,
	scriptId,
	initialVars,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	scriptId: string;
	initialVars: ScriptVarDef[];
	onSaved: (vars: ScriptVarDef[]) => void;
}) {
	const [vars, setVars] = useState<ScriptVarDef[]>(initialVars);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open) setVars(initialVars);
	}, [open, initialVars]);

	function addVar() {
		setVars((prev) => [...prev, { name: '', defaultValue: '' }]);
	}

	function removeVar(i: number) {
		setVars((prev) => prev.filter((_, idx) => idx !== i));
	}

	function setName(i: number, name: string) {
		setVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, name } : v)));
	}

	function setDefault(i: number, defaultValue: string) {
		setVars((prev) =>
			prev.map((v, idx) => (idx === i ? { ...v, defaultValue } : v)),
		);
	}

	async function handleSave() {
		setSaving(true);
		try {
			const cleaned = vars.filter((v) => v.name.trim());
			await updateScriptVariablesSchema(scriptId, JSON.stringify(cleaned));
			onSaved(cleaned);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>脚本变量</DialogTitle>
				</DialogHeader>
				<div className="space-y-2 py-1">
					<p className="text-xs text-muted-foreground">
						定义脚本预期的变量名和默认值，运行时会自动预填到初始变量栏。在步骤中使用{' '}
						<code className="bg-muted px-1 rounded">{'{{变量名}}'}</code> 引用。
					</p>
					{vars.length > 0 && (
						<div className="space-y-1.5">
							{vars.map((v, i) => (
								<div key={i} className="flex items-center gap-1.5">
									<Input
										placeholder="变量名"
										value={v.name}
										onChange={(e) => setName(i, e.target.value)}
										className="h-7 text-xs font-mono"
									/>
									<span className="text-muted-foreground text-xs flex-shrink-0">
										=
									</span>
									<Input
										placeholder="默认值（可选）"
										value={v.defaultValue}
										onChange={(e) => setDefault(i, e.target.value)}
										className="h-7 text-xs"
									/>
									<button
										type="button"
										onClick={() => removeVar(i)}
										className="text-muted-foreground hover:text-destructive cursor-pointer flex-shrink-0"
									>
										<Minus className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
						</div>
					)}
					<button
						type="button"
						onClick={addVar}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
					>
						<Plus className="h-3 w-3" />
						添加变量
					</button>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="cursor-pointer"
					>
						取消
					</Button>
					<Button
						onClick={() => void handleSave()}
						disabled={saving}
						className="cursor-pointer"
					>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Inner canvas (requires ReactFlowProvider context) ───────────────────────

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
	const navigate = useNavigate();
	const { fitView } = useReactFlow();
	const [steps, setSteps] = useState<ScriptStep[]>(script.steps);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [stepDelayMs, setStepDelayMs] = useState<number>(
		() => script.settings?.stepDelayMs ?? 0,
	);
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);
	const [closeWarningOpen, setCloseWarningOpen] = useState(false);
	const [closeWarningItems, setCloseWarningItems] = useState<string[]>([]);
	const [varsDefs, setVarsDefs] = useState<ScriptVarDef[]>(() => {
		try {
			return script.variablesSchemaJson
				? JSON.parse(script.variablesSchemaJson)
				: [];
		} catch {
			return [];
		}
	});
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// 当页面在独立新窗口中（history 只有一条记录）时隐藏返回按钮
	const isStandaloneWindow = window.history.length <= 1;

	useEffect(() => {
		setStepDelayMs(script.settings?.stepDelayMs ?? 0);
	}, [script.id, script.settings?.stepDelayMs]);

	const [{ positions: initPos, edges: initEdges }] = useState(() =>
		parseCanvasData(script.canvasPositionsJson, script.steps.length),
	);
	// nodes 存在 state 中，用 applyNodeChanges 驱动，避免拖拽时重建数组导致节点消失
	const [nodes, setNodes] = useState<Node[]>(() =>
		buildNodes(script.steps, initPos, {}),
	);
	const [edges, setEdges] = useState<Edge[]>(initEdges);
	const positionsRef = useRef<PositionsMap>(initPos);
	const edgesRef = useRef<Edge[]>(initEdges);

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

	const saveScript = useCallback(
		async (newSteps: ScriptStep[]) => {
			setSaving(true);
			try {
				// 拓扑排序
				const currentEdges = edgesRef.current;
				const { reorderedSteps, indexMap, orphanedCount } = topologySortSteps(
					newSteps,
					currentEdges,
				);

				// 如果顺序有变化，同步更新本地状态
				const orderChanged = reorderedSteps.some((s, i) => s !== newSteps[i]);
				if (orderChanged) {
					// 更新 steps state
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

					if (selectedIndex !== null) {
						const mappedIndex = indexMap.get(selectedIndex);
						setSelectedIndex(mappedIndex ?? null);
					}

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
			selectedIndex,
			stepDelayMs,
			scheduleCanvasSave,
		],
	);

	useEffect(() => {
		if (!savedAt) return;
		const t = setTimeout(() => setSavedAt(null), 3000);
		return () => clearTimeout(t);
	}, [savedAt]);

	useEffect(() => {
		const win = getCurrentWindow();
		let unlisten: (() => void) | undefined;
		void win
			.onCloseRequested(async (event) => {
				const errs = validateSteps(steps);
				if (errs.length > 0) {
					event.preventDefault();
					setCloseWarningItems(errs);
					setCloseWarningOpen(true);
				}
			})
			.then((fn) => {
				unlisten = fn;
			});
		return () => {
			unlisten?.();
		};
	}, [steps]);

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
								(e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
							)
							.map((e) => {
								const si = parseInt(e.source.replace('step-', ''), 10);
								const ti = parseInt(e.target.replace('step-', ''), 10);
								const sShift = sortedRemoved.filter((ri) => ri < si).length;
								const tShift = sortedRemoved.filter((ri) => ri < ti).length;
								return {
									...e,
									source: sShift > 0 ? `step-${si - sShift}` : e.source,
									target: tShift > 0 ? `step-${ti - tShift}` : e.target,
								};
							});
						edgesRef.current = remapped;
						// 清理并重映射 positions
						const newPos = { ...positionsRef.current };
						for (const idx of removedIndices) delete newPos[`step-${idx}`];
						for (let j = steps.length - 1; j >= 0; j--) {
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
			// 用 applyNodeChanges 驱动视图，避免自己重建节点数组打断拖拽
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

	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			setEdges((prev) => {
				const next = applyEdgeChanges(changes, prev);
				edgesRef.current = next;
				scheduleCanvasSave(positionsRef.current, next);
				// 检测因边删除导致的孤立节点
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

	const onConnect = useCallback(
		(connection: Connection) => {
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

	const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
		const idx = parseInt(node.id.replace('step-', ''), 10);
		setSelectedIndex(isNaN(idx) ? null : idx);
	}, []);

	const onPaneClick = useCallback(() => setSelectedIndex(null), []);

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
			await saveScript(newSteps);
		},
		[steps, saveScript, scheduleCanvasSave],
	);

	const updateStep = useCallback(
		async (index: number, step: ScriptStep) => {
			const newSteps = steps.map((s, i) => (i === index ? step : s));
			setSteps(newSteps);
			// 更新对应节点的 data
			setNodes((prev) =>
				prev.map((n) =>
					n.id === `step-${index}`
						? { ...n, data: { ...(n.data as StepNodeData), step } }
						: n,
				),
			);
			await saveScript(newSteps);
		},
		[steps, saveScript],
	);

	const deleteStep = useCallback(
		async (index: number) => {
			const newSteps = steps.filter((_, i) => i !== index);
			setSteps(newSteps);
			setSelectedIndex(null);
			const deletedId = `step-${index}`;
			// 重新映射节点 id 和 data.index
			setNodes((prev) => {
				return prev
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
					});
			});
			// 重新映射边
			setEdges((prev) => {
				const remapped = prev
					.filter((e) => e.source !== deletedId && e.target !== deletedId)
					.map((e) => {
						const si = parseInt(e.source.replace('step-', ''), 10);
						const ti = parseInt(e.target.replace('step-', ''), 10);
						return {
							...e,
							source: si > index ? `step-${si - 1}` : e.source,
							target: ti > index ? `step-${ti - 1}` : e.target,
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

	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		<div className="flex flex-col h-screen">
			{/* Toolbar */}
			<div className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 bg-background z-10">
				{!isStandaloneWindow && (
					<Button
						size="sm"
						variant="ghost"
						className="h-8 px-2 cursor-pointer"
						onClick={() => navigate('/automation')}
					>
						<ArrowLeft className="h-3.5 w-3.5 mr-1" />
						返回
					</Button>
				)}
				<div className="flex-1 min-w-0 flex items-center gap-2">
					<span className="text-sm font-semibold truncate">{script.name}</span>
				</div>
				<span className="text-xs text-muted-foreground">
					{steps.length} 个步骤
				</span>
				<Button
					size="sm"
					variant="ghost"
					className="h-8 px-2 cursor-pointer"
					onClick={() => setVarsDialogOpen(true)}
					title="脚本变量"
				>
					<Variable className="h-3.5 w-3.5 mr-1" />
					变量{varsDefs.length > 0 && ` (${varsDefs.length})`}
				</Button>
				<div className="flex items-center gap-1.5">
					<Label className="text-xs text-muted-foreground whitespace-nowrap">
						步骤延迟
					</Label>
					<Input
						type="number"
						min={0}
						max={9999}
						value={stepDelayMs}
						onChange={(e) => {
							const raw = Number(e.target.value);
							const val = Number.isFinite(raw)
								? Math.min(9999, Math.max(0, raw))
								: 0;
							setStepDelayMs(val);
							setSaving(true);
							void updateAutomationScript(script.id, {
								name: script.name,
								description: script.description ?? undefined,
								steps,
								settings: val > 0 ? { stepDelayMs: val } : undefined,
							})
								.then(() => {
									void emitScriptUpdated(script.id);
									setSavedAt(Date.now());
								})
								.finally(() => {
									setSaving(false);
								});
						}}
						className="h-7 w-20 text-xs"
					/>
					<span className="text-xs text-muted-foreground">ms</span>
				</div>
				<span className="flex items-center gap-1 text-xs text-muted-foreground">
					{saving ? (
						<>
							<Loader2 className="h-3 w-3 animate-spin" />
							保存中...
						</>
					) : savedAt && Date.now() - savedAt < 3000 ? (
						<>
							<CheckCircle className="h-3 w-3 text-green-500" />
							已保存
						</>
					) : null}
				</span>
				{isRunning ? (
					<Button
						size="sm"
						variant="destructive"
						className="h-8 cursor-pointer"
						onClick={onCancel}
					>
						<Square className="h-3.5 w-3.5 mr-1" />
						取消
					</Button>
				) : (
					<Button
						size="sm"
						className="h-8 cursor-pointer"
						disabled={steps.length === 0}
						onClick={() => setRunDialogOpen(true)}
					>
						<Play className="h-3.5 w-3.5 mr-1" />
						运行
					</Button>
				)}
				{activeRunId && (
					<Badge variant="outline" className="text-xs font-mono">
						{isRunning ? (
							<>
								<Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
								运行中
							</>
						) : (
							'已完成'
						)}
					</Badge>
				)}
			</div>
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
			<VariablesSchemaDialog
				open={varsDialogOpen}
				onOpenChange={setVarsDialogOpen}
				scriptId={script.id}
				initialVars={varsDefs}
				onSaved={setVarsDefs}
			/>
			<Dialog open={closeWarningOpen} onOpenChange={setCloseWarningOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>步骤配置不完整</DialogTitle>
					</DialogHeader>
					<div className="py-2 space-y-1 max-h-48 overflow-auto">
						{closeWarningItems.map((item, i) => (
							<p key={i} className="text-sm text-red-500">
								{item}
							</p>
						))}
					</div>
					<DialogFooter className="gap-2">
						<Button
							variant="ghost"
							onClick={() => setCloseWarningOpen(false)}
							className="cursor-pointer"
						>
							返回编辑
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								void getCurrentWindow().close();
							}}
							className="cursor-pointer"
						>
							忽略并关闭
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="flex flex-1 overflow-hidden">
				{/* Left: Palette */}
				<div className="w-44 border-r flex-shrink-0 bg-background flex flex-col min-h-0">
					<div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground border-b uppercase tracking-wide flex-shrink-0">
						添加步骤
					</div>
					<div className="flex-1 overflow-y-auto min-h-0">
						<div className="p-2 space-y-3">
							{PALETTE_GROUPS.map((group) => (
								<div key={group.label}>
									<div className="px-0.5 mb-1.5">
										<span
											className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border ${GROUP_COLORS[group.label] ?? GROUP_COLORS['通用']}`}
										>
											{group.label}
										</span>
									</div>
									{group.kinds.map((kind) => (
										<button
											key={kind}
											type="button"
											className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer flex items-center gap-2 mb-0.5 group/item"
											onClick={() => void addStep(kind)}
										>
											<span
												className={`w-1 h-3.5 rounded-full flex-shrink-0 opacity-30 group-hover/item:opacity-60 transition-opacity ${PALETTE_DOT_COLORS[group.label] ?? 'bg-muted-foreground/50'}`}
											/>
											<span className="truncate">
												{KIND_LABELS[kind] ?? kind}
											</span>
										</button>
									))}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Center: Canvas */}
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

				{/* Right: Properties */}
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

// ─── Page export ──────────────────────────────────────────────────────────────

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
