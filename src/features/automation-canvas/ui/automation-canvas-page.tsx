import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	type NodeChange,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
} from '@xyflow/react';
import { ArrowLeft, Loader2, Minus, Play, Plus, Square, Trash2, Variable } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { AutomationScript, ScriptStep, ScriptVarDef, StepResult } from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import {
	updateAutomationScript,
	updateScriptCanvasPositions,
	updateScriptVariablesSchema,
} from '@/entities/automation/api/automation-api';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { RunDialog } from '@/features/automation/ui/run-dialog';

// ─── Step kind → display label / group ───────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
	navigate: '导航', wait: '等待', evaluate: 'JS 求值', click: '点击',
	type: '输入', screenshot: '截图', magic: 'Magic', cdp: 'CDP 原始',
	wait_for_user: '等待人工', condition: '条件分支', loop: '循环',
	break: 'Break', continue: 'Continue',
	ai_prompt: 'AI Prompt', ai_extract: 'AI 提取', ai_agent: 'AI Agent',
	cdp_navigate: '导航', cdp_reload: '刷新', cdp_evaluate: 'JS 求值',
	cdp_click: '点击', cdp_type: '输入', cdp_scroll_to: '滚动',
	cdp_wait_for_selector: '等待元素', cdp_get_text: '获取文本',
	cdp_get_attribute: '获取属性', cdp_set_input_value: '设置输入',
	cdp_screenshot: '截图',
	magic_set_bounds: '设置窗口尺寸', magic_get_bounds: '获取窗口尺寸',
	magic_set_maximized: '最大化', magic_set_minimized: '最小化',
	magic_set_closed: '关闭窗口', magic_set_restored: '还原窗口',
	magic_set_fullscreen: '全屏', magic_set_bg_color: '设置背景色',
	magic_set_toolbar_text: '设置工具栏文本', magic_set_app_top_most: '置顶',
	magic_set_master_indicator_visible: '指示器可见性',
	magic_open_new_tab: '打开新标签', magic_close_tab: '关闭标签',
	magic_activate_tab: '激活标签', magic_activate_tab_by_index: '激活标签(索引)',
	magic_close_inactive_tabs: '关闭非活跃标签', magic_open_new_window: '打开新窗口',
	magic_type_string: '输入文本',
	magic_get_browsers: '获取浏览器', magic_get_active_browser: '获取活跃浏览器',
	magic_get_tabs: '获取标签列表', magic_get_active_tabs: '获取活跃标签',
	magic_get_switches: '获取开关', magic_get_host_name: '获取主机名',
	magic_get_mac_address: '获取MAC地址',
	magic_get_bookmarks: '获取书签', magic_create_bookmark: '创建书签',
	magic_create_bookmark_folder: '创建书签文件夹', magic_update_bookmark: '更新书签',
	magic_move_bookmark: '移动书签', magic_remove_bookmark: '删除书签',
	magic_bookmark_current_tab: '收藏当前页', magic_unbookmark_current_tab: '取消收藏',
	magic_is_current_tab_bookmarked: '是否已收藏', magic_export_bookmark_state: '导出书签状态',
	magic_get_managed_cookies: '获取Cookie', magic_export_cookie_state: '导出Cookie状态',
	magic_get_managed_extensions: '获取扩展', magic_trigger_extension_action: '触发扩展动作',
	magic_close_extension_popup: '关闭扩展弹窗',
	magic_toggle_sync_mode: '切换同步模式', magic_get_sync_mode: '获取同步模式',
	magic_get_is_master: '是否主屏', magic_get_sync_status: '获取同步状态',
	magic_capture_app_shell: '截图(应用外壳)',
};

const KIND_GROUPS: Record<string, string> = {
	navigate: 'CDP', wait: '通用', evaluate: 'CDP', click: 'CDP',
	type: 'CDP', screenshot: 'CDP', magic: 'Magic', cdp: 'CDP',
	wait_for_user: '人工介入', condition: '控制流', loop: '控制流',
	break: '控制流', continue: '控制流',
	ai_prompt: 'AI', ai_extract: 'AI', ai_agent: 'AI',
};
const CDP_KINDS = ['cdp_navigate', 'cdp_reload', 'cdp_evaluate', 'cdp_click', 'cdp_type',
	'cdp_scroll_to', 'cdp_wait_for_selector', 'cdp_get_text', 'cdp_get_attribute',
	'cdp_set_input_value', 'cdp_screenshot'];
CDP_KINDS.forEach((k) => { KIND_GROUPS[k] = 'CDP'; });
const MAGIC_KINDS = Object.keys(KIND_LABELS).filter((k) => k.startsWith('magic_'));
MAGIC_KINDS.forEach((k) => { KIND_GROUPS[k] = 'Magic'; });

const GROUP_COLORS: Record<string, string> = {
	CDP: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
	Magic: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
	AI: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
	控制流: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
	人工介入: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
	通用: 'bg-muted border-border text-muted-foreground',
};

const STEP_STATUS_RING: Record<string, string> = {
	running: 'ring-2 ring-blue-500 ring-offset-1',
	success: 'ring-2 ring-green-500 ring-offset-1',
	failed: 'ring-2 ring-red-500 ring-offset-1',
	waiting_human: 'ring-2 ring-amber-400 ring-offset-1 animate-pulse',
};

// ─── Custom node ──────────────────────────────────────────────────────────────

type StepNodeData = { step: ScriptStep; index: number; stepStatus?: string };

function getStepSummary(step: ScriptStep): string {
	const s = step as Record<string, unknown>;
	if (s.url) return String(s.url).slice(0, 40);
	if (s.prompt) return String(s.prompt).slice(0, 40);
	if (s.expression) return String(s.expression).slice(0, 40);
	if (s.selector) return String(s.selector).slice(0, 40);
	if (s.message) return String(s.message).slice(0, 40);
	if (s.ms !== undefined) return `${s.ms}ms`;
	if (s.initial_message) return String(s.initial_message).slice(0, 40);
	return '';
}

function StepNodeComponent({ data }: { data: StepNodeData }) {
	const { step, index, stepStatus } = data;
	const kind = step.kind;
	const label = KIND_LABELS[kind] ?? kind;
	const group = KIND_GROUPS[kind] ?? '通用';
	const colorClass = GROUP_COLORS[group] ?? GROUP_COLORS['通用'];
	const ringClass = stepStatus ? (STEP_STATUS_RING[stepStatus] ?? '') : '';
	const summary = getStepSummary(step);

	return (
		<div className={`min-w-[160px] max-w-[220px] rounded-lg border bg-background shadow-sm px-3 py-2 cursor-pointer ${ringClass}`}>
			<div className="flex items-center gap-1.5 mb-1">
				<span className="text-[10px] text-muted-foreground font-mono">#{index + 1}</span>
				<span className={`text-[10px] font-medium px-1 rounded border ${colorClass}`}>{group}</span>
			</div>
			<div className="text-xs font-semibold truncate">{label}</div>
			{summary && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{summary}</div>}
		</div>
	);
}

const NODE_TYPES = { step: StepNodeComponent };

// ─── Step palette groups ───────────────────────────────────────────────────────

const PALETTE_GROUPS: { label: string; kinds: string[] }[] = [
	{ label: 'CDP', kinds: ['cdp_navigate', 'cdp_reload', 'cdp_click', 'cdp_type', 'cdp_evaluate', 'cdp_get_text', 'cdp_wait_for_selector', 'cdp_scroll_to', 'cdp_screenshot'] },
	{ label: '通用', kinds: ['wait', 'wait_for_user'] },
	{ label: '控制流', kinds: ['condition', 'loop', 'break', 'continue'] },
	{ label: 'AI', kinds: ['ai_prompt', 'ai_extract', 'ai_agent'] },
	{ label: 'Magic', kinds: ['magic_get_browsers', 'magic_open_new_tab', 'magic_close_tab', 'magic_activate_tab', 'magic_get_tabs', 'magic_set_bounds', 'magic_get_bounds', 'magic_set_maximized', 'magic_set_minimized', 'magic_capture_app_shell'] },
];

function defaultStep(kind: string): ScriptStep {
	const map: Record<string, ScriptStep> = {
		wait: { kind: 'wait', ms: 1000 },
		wait_for_user: { kind: 'wait_for_user', message: '' },
		condition: { kind: 'condition', condition_expr: '', then_steps: [], else_steps: [] },
		loop: { kind: 'loop', mode: 'count', count: 3, body_steps: [] },
		break: { kind: 'break' },
		continue: { kind: 'continue' },
		ai_prompt: { kind: 'ai_prompt', prompt: '' },
		ai_extract: { kind: 'ai_extract', prompt: '', output_key_map: [] },
		ai_agent: { kind: 'ai_agent', system_prompt: '', initial_message: '', max_steps: 10 },
		cdp_navigate: { kind: 'cdp_navigate', url: 'https://' },
		cdp_reload: { kind: 'cdp_reload' },
		cdp_evaluate: { kind: 'cdp_evaluate', expression: '' },
		cdp_click: { kind: 'cdp_click', selector: '' },
		cdp_type: { kind: 'cdp_type', selector: '', text: '' },
		cdp_scroll_to: { kind: 'cdp_scroll_to' },
		cdp_wait_for_selector: { kind: 'cdp_wait_for_selector', selector: '' },
		cdp_get_text: { kind: 'cdp_get_text', selector: '' },
		cdp_screenshot: { kind: 'cdp_screenshot' },
		magic_get_browsers: { kind: 'magic_get_browsers' },
		magic_open_new_tab: { kind: 'magic_open_new_tab', url: 'https://' },
		magic_close_tab: { kind: 'magic_close_tab', tab_id: 0 },
		magic_activate_tab: { kind: 'magic_activate_tab', tab_id: 0 },
		magic_get_tabs: { kind: 'magic_get_tabs', browser_id: 0 },
		magic_set_bounds: { kind: 'magic_set_bounds', x: 0, y: 0, width: 800, height: 600 },
		magic_get_bounds: { kind: 'magic_get_bounds' },
		magic_set_maximized: { kind: 'magic_set_maximized' },
		magic_set_minimized: { kind: 'magic_set_minimized' },
		magic_capture_app_shell: { kind: 'magic_capture_app_shell' },
	};
	return map[kind] ?? ({ kind } as unknown as ScriptStep);
}

// ─── Properties panel ────────────────────────────────────────────────────────

function StepPropertiesPanel({
	step,
	onUpdate,
	onDelete,
}: {
	step: ScriptStep;
	onUpdate: (step: ScriptStep) => void;
	onDelete: () => void;
}) {
	const s = step as Record<string, unknown>;
	const kind = step.kind;

	function tf(key: string, label: string, multi = false) {
		const value = String(s[key] ?? '');
		return (
			<div key={key} className="space-y-1">
				<Label className="text-xs">{label}</Label>
				{multi ? (
					<Textarea
						value={value}
						onChange={(e) => onUpdate({ ...step, [key]: e.target.value } as ScriptStep)}
						className="text-xs min-h-[60px]"
					/>
				) : (
					<Input
						value={value}
						onChange={(e) => onUpdate({ ...step, [key]: e.target.value } as ScriptStep)}
						className="h-8 text-xs"
					/>
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
					onChange={(e) => onUpdate({ ...step, [key]: Number(e.target.value) } as ScriptStep)}
					className="h-8 text-xs"
				/>
			</div>
		);
	}

	const okf = () => tf('output_key', '输出变量名');

	const fields: React.ReactNode[] = [];
	if (kind === 'navigate' || kind === 'cdp_navigate') { fields.push(tf('url', 'URL')); fields.push(okf()); }
	else if (kind === 'wait') { fields.push(nf('ms', '等待毫秒数')); }
	else if (kind === 'evaluate' || kind === 'cdp_evaluate') { fields.push(tf('expression', 'JS 表达式', true)); fields.push(okf()); }
	else if (kind === 'click' || kind === 'cdp_click') { fields.push(tf('selector', 'CSS 选择器')); }
	else if (kind === 'type' || kind === 'cdp_type') { fields.push(tf('selector', 'CSS 选择器')); fields.push(tf('text', '输入文本')); }
	else if (kind === 'cdp_get_text') { fields.push(tf('selector', 'CSS 选择器')); fields.push(okf()); }
	else if (kind === 'cdp_wait_for_selector') { fields.push(tf('selector', 'CSS 选择器')); fields.push(nf('timeout_ms', '超时毫秒数')); }
	else if (kind === 'cdp_scroll_to') { fields.push(tf('selector', 'CSS 选择器（可选）')); }
	else if (kind === 'cdp_screenshot') { fields.push(tf('output_key_base64', 'Base64 变量名')); fields.push(tf('output_path', '保存路径（可选）')); }
	else if (kind === 'wait_for_user') {
		fields.push(tf('message', '提示消息', true));
		fields.push(tf('input_label', '输入框标签（留空则无输入框）'));
		fields.push(okf());
		fields.push(nf('timeout_ms', '超时毫秒数（0=不超时）'));
	}
	else if (kind === 'condition') { fields.push(tf('condition_expr', '条件表达式')); }
	else if (kind === 'loop') { fields.push(nf('count', '循环次数')); fields.push(tf('iter_var', '迭代变量名（可选）')); }
	else if (kind === 'ai_prompt') { fields.push(tf('prompt', 'Prompt（支持 {{变量}}）', true)); fields.push(tf('image_var', '图片变量名（可选）')); fields.push(okf()); }
	else if (kind === 'ai_extract') { fields.push(tf('prompt', 'Prompt（支持 {{变量}}）', true)); }
	else if (kind === 'ai_agent') {
		fields.push(tf('system_prompt', '系统提示词', true));
		fields.push(tf('initial_message', '初始消息（支持 {{变量}}）', true));
		fields.push(nf('max_steps', '最大循环轮次'));
		fields.push(okf());
	}
	else if (kind === 'magic_open_new_tab') { fields.push(tf('url', 'URL')); fields.push(okf()); }
	else if (kind === 'magic_set_bounds') { fields.push(nf('x', 'X')); fields.push(nf('y', 'Y')); fields.push(nf('width', '宽度')); fields.push(nf('height', '高度')); }
	else if (['magic_get_browsers', 'magic_get_bounds', 'magic_capture_app_shell'].includes(kind)) { fields.push(okf()); }

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<span className="text-xs font-semibold">{KIND_LABELS[kind] ?? kind}</span>
				<Button size="sm" variant="ghost" className="h-6 w-6 p-0 cursor-pointer text-destructive hover:text-destructive" onClick={onDelete}>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>
			<ScrollArea className="flex-1 p-3">
				<div className="space-y-3">
					{fields.length > 0 ? fields : <p className="text-xs text-muted-foreground">此步骤无可编辑字段</p>}
				</div>
			</ScrollArea>
		</div>
	);
}

// ─── Node / edge builders ─────────────────────────────────────────────────────

type PositionsMap = Record<string, { x: number; y: number }>;

function buildNodes(steps: ScriptStep[], positions: PositionsMap, liveStatuses: Record<number, string>): Node[] {
	return steps.map((step, i) => {
		const id = `step-${i}`;
		const pos = positions[id] ?? { x: 120, y: i * 120 + 60 };
		return {
			id,
			type: 'step',
			position: pos,
			width: 220,
			height: 70,
			data: { step, index: i, stepStatus: liveStatuses[i] } as StepNodeData,
		};
	});
}

function buildEdges(count: number): Edge[] {
	return Array.from({ length: count - 1 }, (_, i) => ({
		id: `e-${i}-${i + 1}`,
		source: `step-${i}`,
		target: `step-${i + 1}`,
		type: 'smoothstep',
	}));
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
		setVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, defaultValue } : v)));
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
						定义脚本预期的变量名和默认值，运行时会自动预填到初始变量栏。在步骤中使用 <code className="bg-muted px-1 rounded">{'{{变量名}}'}</code> 引用。
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
									<span className="text-muted-foreground text-xs flex-shrink-0">=</span>
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
						<Plus className="h-3 w-3" />添加变量
					</button>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
						取消
					</Button>
					<Button onClick={() => void handleSave()} disabled={saving} className="cursor-pointer">
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

function InnerCanvas({ script, activeProfiles, isRunning, activeRunId, liveStatuses, onRun, onDebugRun, onCancel }: InnerProps) {
	const navigate = useNavigate();
	const { fitView } = useReactFlow();
	const [steps, setSteps] = useState<ScriptStep[]>(script.steps);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [runDialogOpen, setRunDialogOpen] = useState(false);
	const [varsDialogOpen, setVarsDialogOpen] = useState(false);
	const [varsDefs, setVarsDefs] = useState<ScriptVarDef[]>(() => {
		try { return script.variablesSchemaJson ? JSON.parse(script.variablesSchemaJson) : []; }
		catch { return []; }
	});
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// 当页面在独立新窗口中（history 只有一条记录）时隐藏返回按钮
	const isStandaloneWindow = window.history.length <= 1;

	const [positions, setPositions] = useState<PositionsMap>(() => {
		try { return script.canvasPositionsJson ? JSON.parse(script.canvasPositionsJson) : {}; }
		catch { return {}; }
	});
	const positionsRef = useRef<PositionsMap>(positions);

	const nodes = useMemo(() => buildNodes(steps, positions, liveStatuses), [steps, positions, liveStatuses]);
	const edges = useMemo(() => buildEdges(steps.length), [steps.length]);

	const saveScript = useCallback(async (newSteps: ScriptStep[]) => {
		setSaving(true);
		try {
			await updateAutomationScript(script.id, { name: script.name, description: script.description ?? undefined, steps: newSteps });
		} finally {
			setSaving(false);
		}
	}, [script.id, script.name, script.description]);

	const schedulePositionSave = useCallback((pos: PositionsMap) => {
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			void updateScriptCanvasPositions(script.id, JSON.stringify(pos));
		}, 500);
	}, [script.id]);

	const onNodesChange = useCallback((changes: NodeChange[]) => {
		const updates: PositionsMap = {};
		for (const c of changes) {
			if (c.type === 'position' && c.position) updates[c.id] = c.position;
		}
		if (Object.keys(updates).length > 0) {
			const next = { ...positionsRef.current, ...updates };
			positionsRef.current = next;
			setPositions(next);
			schedulePositionSave(next);
		}
	}, [schedulePositionSave]);

	const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
		const idx = parseInt(node.id.replace('step-', ''), 10);
		setSelectedIndex(isNaN(idx) ? null : idx);
	}, []);

	const onPaneClick = useCallback(() => setSelectedIndex(null), []);

	const addStep = useCallback(async (kind: string) => {
		const newSteps = [...steps, defaultStep(kind)];
		setSteps(newSteps);
		await saveScript(newSteps);
	}, [steps, saveScript]);

	const updateStep = useCallback(async (index: number, step: ScriptStep) => {
		const newSteps = steps.map((s, i) => i === index ? step : s);
		setSteps(newSteps);
		await saveScript(newSteps);
	}, [steps, saveScript]);

	const deleteStep = useCallback(async (index: number) => {
		const newSteps = steps.filter((_, i) => i !== index);
		setSteps(newSteps);
		setSelectedIndex(null);
		await saveScript(newSteps);
	}, [steps, saveScript]);

	useEffect(() => {
		void fitView({ padding: 0.2, duration: 300 });
	}, [fitView]);

	return (
		<div className="flex flex-col h-screen">
			{/* Toolbar */}
			<div className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 bg-background z-10">
				{!isStandaloneWindow && (
					<Button size="sm" variant="ghost" className="h-8 px-2 cursor-pointer" onClick={() => navigate('/automation')}>
						<ArrowLeft className="h-3.5 w-3.5 mr-1" />返回
					</Button>
				)}
				<div className="flex-1 min-w-0 flex items-center gap-2">
					<span className="text-sm font-semibold truncate">{script.name}</span>
					{saving && <span className="text-xs text-muted-foreground">保存中...</span>}
				</div>
				<span className="text-xs text-muted-foreground">{steps.length} 个步骤</span>
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
				{isRunning ? (
					<Button size="sm" variant="destructive" className="h-8 cursor-pointer" onClick={onCancel}>
						<Square className="h-3.5 w-3.5 mr-1" />取消
					</Button>
				) : (
					<Button size="sm" className="h-8 cursor-pointer" disabled={steps.length === 0} onClick={() => setRunDialogOpen(true)}>
						<Play className="h-3.5 w-3.5 mr-1" />运行
					</Button>
				)}
				{activeRunId && (
					<Badge variant="outline" className="text-xs font-mono">
						{isRunning ? <><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />运行中</> : '已完成'}
					</Badge>
				)}
			</div>
			<RunDialog
				open={runDialogOpen}
				onOpenChange={setRunDialogOpen}
				activeProfiles={activeProfiles}
				isRunning={isRunning}
				disabled={steps.length === 0}
				defaultVars={varsDefs.map((v) => ({ key: v.name, value: v.defaultValue }))}
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
				{/* Left: Palette */}
				<div className="w-44 border-r flex-shrink-0 bg-background flex flex-col min-h-0">
					<div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground border-b uppercase tracking-wide">
						添加步骤
					</div>
					<ScrollArea className="flex-1">
						<div className="p-2 space-y-3">
							{PALETTE_GROUPS.map((group) => (
								<div key={group.label}>
									<div className="text-[10px] font-semibold text-muted-foreground mb-1">{group.label}</div>
									{group.kinds.map((kind) => (
										<button key={kind} type="button"
											className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent cursor-pointer truncate block"
											onClick={() => void addStep(kind)}
										>
											{KIND_LABELS[kind] ?? kind}
										</button>
									))}
								</div>
							))}
						</div>
					</ScrollArea>
				</div>

				{/* Center: Canvas */}
				<div className="flex-1 overflow-hidden">
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={NODE_TYPES}
						onNodesChange={onNodesChange}
						onNodeClick={onNodeClick}
						onPaneClick={onPaneClick}
						fitView
						fitViewOptions={{ padding: 0.2 }}
						deleteKeyCode={null}
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

export function AutomationCanvasPage({ script, activeProfiles, isRunning, activeRunId, liveStepResults, onRun, onDebugRun, onCancel }: Props) {
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
