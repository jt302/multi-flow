import { useEffect } from 'react';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import type { AutomationScript, ScriptStep } from '@/entities/automation/model/types';
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type StepFormItem = ScriptStep & { _id?: string };

type FormValues = {
	name: string;
	description: string;
	steps: StepFormItem[];
};

type Props = {
	open: boolean;
	script: AutomationScript | null;
	onOpenChange: (open: boolean) => void;
	onSave: (name: string, description: string, steps: ScriptStep[]) => void;
	isSaving: boolean;
};

const STEP_KINDS = [
	// 基础
	{ value: 'navigate', label: '导航 navigate', group: '基础' },
	{ value: 'wait', label: '等待 wait', group: '基础' },
	{ value: 'evaluate', label: '执行JS evaluate', group: '基础' },
	{ value: 'click', label: '点击 click', group: '基础' },
	{ value: 'type', label: '输入 type', group: '基础' },
	{ value: 'screenshot', label: '截图 screenshot', group: '基础' },
	{ value: 'magic', label: 'Magic 原始指令', group: '基础' },
	{ value: 'cdp', label: 'CDP 原始调用', group: '基础' },
	// 控制流
	{ value: 'wait_for_user', label: '人工介入 wait_for_user', group: '控制流' },
	{ value: 'condition', label: '条件分支 condition', group: '控制流' },
	{ value: 'loop', label: '循环 loop', group: '控制流' },
	{ value: 'break', label: '跳出循环 break', group: '控制流' },
	{ value: 'continue', label: '继续下一轮 continue', group: '控制流' },
	// AI 步骤
	{ value: 'ai_prompt', label: 'AI 文本/视觉 Prompt', group: 'AI' },
	{ value: 'ai_extract', label: 'AI 结构化提取', group: 'AI' },
	// CDP 具名
	{ value: 'cdp_navigate', label: 'CDP 导航', group: 'CDP' },
	{ value: 'cdp_reload', label: 'CDP 刷新页面', group: 'CDP' },
	{ value: 'cdp_evaluate', label: 'CDP 执行JS', group: 'CDP' },
	{ value: 'cdp_click', label: 'CDP 点击', group: 'CDP' },
	{ value: 'cdp_type', label: 'CDP 输入', group: 'CDP' },
	{ value: 'cdp_scroll_to', label: 'CDP 滚动', group: 'CDP' },
	{ value: 'cdp_wait_for_selector', label: 'CDP 等待元素', group: 'CDP' },
	{ value: 'cdp_get_text', label: 'CDP 获取文本', group: 'CDP' },
	{ value: 'cdp_get_attribute', label: 'CDP 获取属性', group: 'CDP' },
	{ value: 'cdp_set_input_value', label: 'CDP 设置输入值', group: 'CDP' },
	{ value: 'cdp_screenshot', label: 'CDP 截图(增强)', group: 'CDP' },
	// 窗口外观
	{ value: 'magic_set_bounds', label: '设置窗口位置大小', group: '窗口外观' },
	{ value: 'magic_get_bounds', label: '获取窗口位置大小', group: '窗口外观' },
	{ value: 'magic_set_maximized', label: '最大化窗口', group: '窗口外观' },
	{ value: 'magic_set_minimized', label: '最小化窗口', group: '窗口外观' },
	{ value: 'magic_set_restored', label: '还原窗口', group: '窗口外观' },
	{ value: 'magic_set_fullscreen', label: '全屏', group: '窗口外观' },
	{ value: 'magic_set_closed', label: '关闭窗口', group: '窗口外观' },
	{ value: 'magic_set_bg_color', label: '设置背景色', group: '窗口外观' },
	{ value: 'magic_set_toolbar_text', label: '设置工具栏文字', group: '窗口外观' },
	{ value: 'magic_set_app_top_most', label: '激活窗口', group: '窗口外观' },
	{ value: 'magic_set_master_indicator_visible', label: '主控标记显示', group: '窗口外观' },
	// 标签页
	{ value: 'magic_open_new_tab', label: '新建标签页', group: '标签页' },
	{ value: 'magic_close_tab', label: '关闭标签页', group: '标签页' },
	{ value: 'magic_activate_tab', label: '激活标签页(by id)', group: '标签页' },
	{ value: 'magic_activate_tab_by_index', label: '激活标签页(by index)', group: '标签页' },
	{ value: 'magic_close_inactive_tabs', label: '关闭非活动标签页', group: '标签页' },
	{ value: 'magic_open_new_window', label: '新建窗口', group: '标签页' },
	{ value: 'magic_type_string', label: '键入文本', group: '标签页' },
	{ value: 'magic_capture_app_shell', label: '截图(整个窗口)', group: '标签页' },
	// 浏览器信息
	{ value: 'magic_get_browsers', label: '获取所有浏览器', group: '浏览器信息' },
	{ value: 'magic_get_active_browser', label: '获取活动浏览器', group: '浏览器信息' },
	{ value: 'magic_get_tabs', label: '获取标签页列表', group: '浏览器信息' },
	{ value: 'magic_get_active_tabs', label: '获取活动标签页', group: '浏览器信息' },
	{ value: 'magic_get_switches', label: '读取启动参数', group: '浏览器信息' },
	{ value: 'magic_get_host_name', label: '读取主机名', group: '浏览器信息' },
	{ value: 'magic_get_mac_address', label: '读取MAC地址', group: '浏览器信息' },
	// 书签
	{ value: 'magic_get_bookmarks', label: '获取书签树', group: '书签' },
	{ value: 'magic_create_bookmark', label: '创建书签', group: '书签' },
	{ value: 'magic_create_bookmark_folder', label: '创建书签文件夹', group: '书签' },
	{ value: 'magic_update_bookmark', label: '更新书签', group: '书签' },
	{ value: 'magic_move_bookmark', label: '移动书签', group: '书签' },
	{ value: 'magic_remove_bookmark', label: '删除书签', group: '书签' },
	{ value: 'magic_bookmark_current_tab', label: '收藏当前标签', group: '书签' },
	{ value: 'magic_unbookmark_current_tab', label: '取消收藏当前标签', group: '书签' },
	{ value: 'magic_is_current_tab_bookmarked', label: '查询当前标签是否已收藏', group: '书签' },
	{ value: 'magic_export_bookmark_state', label: '导出书签状态', group: '书签' },
	// Cookie
	{ value: 'magic_get_managed_cookies', label: '获取托管Cookie', group: 'Cookie' },
	{ value: 'magic_export_cookie_state', label: '导出Cookie状态', group: 'Cookie' },
	// 扩展
	{ value: 'magic_get_managed_extensions', label: '获取托管扩展', group: '扩展' },
	{ value: 'magic_trigger_extension_action', label: '触发扩展Action', group: '扩展' },
	{ value: 'magic_close_extension_popup', label: '关闭扩展Popup', group: '扩展' },
	// 同步模式
	{ value: 'magic_toggle_sync_mode', label: '切换同步角色', group: '同步模式' },
	{ value: 'magic_get_sync_mode', label: '获取同步状态', group: '同步模式' },
	{ value: 'magic_get_is_master', label: '查询是否主控', group: '同步模式' },
	{ value: 'magic_get_sync_status', label: '获取完整同步状态', group: '同步模式' },
];

function defaultStep(kind: string): ScriptStep {
	switch (kind) {
		case 'navigate': return { kind: 'navigate', url: 'https://' };
		case 'wait': return { kind: 'wait', ms: 1000 };
		case 'evaluate': return { kind: 'evaluate', expression: '' };
		case 'click': return { kind: 'click', selector: '' };
		case 'type': return { kind: 'type', selector: '', text: '' };
		case 'screenshot': return { kind: 'screenshot' };
		case 'magic': return { kind: 'magic', command: '', params: {} };
		case 'cdp': return { kind: 'cdp', method: '' };
		case 'wait_for_user': return { kind: 'wait_for_user', message: '' };
		case 'condition': return { kind: 'condition', condition_expr: '', then_steps: [], else_steps: [] };
		case 'loop': return { kind: 'loop', mode: 'count', count: 3, body_steps: [] };
		case 'break': return { kind: 'break' };
		case 'continue': return { kind: 'continue' };
		// AI 步骤
		case 'ai_prompt': return { kind: 'ai_prompt', prompt: '' };
		case 'ai_extract': return { kind: 'ai_extract', prompt: '', output_key_map: [{ jsonPath: '', varName: '' }] };
		// CDP 具名步骤
		case 'cdp_navigate': return { kind: 'cdp_navigate', url: 'https://' };
		case 'cdp_reload': return { kind: 'cdp_reload', ignore_cache: false };
		case 'cdp_evaluate': return { kind: 'cdp_evaluate', expression: '' };
		case 'cdp_click': return { kind: 'cdp_click', selector: '' };
		case 'cdp_type': return { kind: 'cdp_type', selector: '', text: '' };
		case 'cdp_scroll_to': return { kind: 'cdp_scroll_to' };
		case 'cdp_wait_for_selector': return { kind: 'cdp_wait_for_selector', selector: '' };
		case 'cdp_get_text': return { kind: 'cdp_get_text', selector: '' };
		case 'cdp_get_attribute': return { kind: 'cdp_get_attribute', selector: '', attribute: '' };
		case 'cdp_set_input_value': return { kind: 'cdp_set_input_value', selector: '', value: '' };
		case 'cdp_screenshot': return { kind: 'cdp_screenshot' };
		// Magic 具名步骤
		case 'magic_set_bounds': return { kind: 'magic_set_bounds', x: 0, y: 0, width: 1280, height: 800 };
		case 'magic_get_bounds': return { kind: 'magic_get_bounds' };
		case 'magic_set_maximized': return { kind: 'magic_set_maximized' };
		case 'magic_set_minimized': return { kind: 'magic_set_minimized' };
		case 'magic_set_closed': return { kind: 'magic_set_closed' };
		case 'magic_set_restored': return { kind: 'magic_set_restored' };
		case 'magic_set_fullscreen': return { kind: 'magic_set_fullscreen' };
		case 'magic_set_bg_color': return { kind: 'magic_set_bg_color', r: 255, g: 255, b: 255 };
		case 'magic_set_toolbar_text': return { kind: 'magic_set_toolbar_text', text: '' };
		case 'magic_set_app_top_most': return { kind: 'magic_set_app_top_most' };
		case 'magic_set_master_indicator_visible': return { kind: 'magic_set_master_indicator_visible', visible: true };
		case 'magic_open_new_tab': return { kind: 'magic_open_new_tab', url: 'https://' };
		case 'magic_close_tab': return { kind: 'magic_close_tab', tab_id: 0 };
		case 'magic_activate_tab': return { kind: 'magic_activate_tab', tab_id: 0 };
		case 'magic_activate_tab_by_index': return { kind: 'magic_activate_tab_by_index', index: 0 };
		case 'magic_close_inactive_tabs': return { kind: 'magic_close_inactive_tabs' };
		case 'magic_open_new_window': return { kind: 'magic_open_new_window' };
		case 'magic_type_string': return { kind: 'magic_type_string', text: '' };
		case 'magic_capture_app_shell': return { kind: 'magic_capture_app_shell', mode: 'inline' };
		case 'magic_get_browsers': return { kind: 'magic_get_browsers' };
		case 'magic_get_active_browser': return { kind: 'magic_get_active_browser' };
		case 'magic_get_tabs': return { kind: 'magic_get_tabs', browser_id: 0 };
		case 'magic_get_active_tabs': return { kind: 'magic_get_active_tabs' };
		case 'magic_get_switches': return { kind: 'magic_get_switches', key: '' };
		case 'magic_get_host_name': return { kind: 'magic_get_host_name' };
		case 'magic_get_mac_address': return { kind: 'magic_get_mac_address' };
		case 'magic_get_bookmarks': return { kind: 'magic_get_bookmarks' };
		case 'magic_create_bookmark': return { kind: 'magic_create_bookmark', parent_id: '', title: '', url: 'https://' };
		case 'magic_create_bookmark_folder': return { kind: 'magic_create_bookmark_folder', parent_id: '', title: '' };
		case 'magic_update_bookmark': return { kind: 'magic_update_bookmark', node_id: '' };
		case 'magic_move_bookmark': return { kind: 'magic_move_bookmark', node_id: '', new_parent_id: '' };
		case 'magic_remove_bookmark': return { kind: 'magic_remove_bookmark', node_id: '' };
		case 'magic_bookmark_current_tab': return { kind: 'magic_bookmark_current_tab' };
		case 'magic_unbookmark_current_tab': return { kind: 'magic_unbookmark_current_tab' };
		case 'magic_is_current_tab_bookmarked': return { kind: 'magic_is_current_tab_bookmarked' };
		case 'magic_export_bookmark_state': return { kind: 'magic_export_bookmark_state' };
		case 'magic_get_managed_cookies': return { kind: 'magic_get_managed_cookies' };
		case 'magic_export_cookie_state': return { kind: 'magic_export_cookie_state', mode: 'all' };
		case 'magic_get_managed_extensions': return { kind: 'magic_get_managed_extensions' };
		case 'magic_trigger_extension_action': return { kind: 'magic_trigger_extension_action', extension_id: '' };
		case 'magic_close_extension_popup': return { kind: 'magic_close_extension_popup' };
		case 'magic_toggle_sync_mode': return { kind: 'magic_toggle_sync_mode', role: 'master' };
		case 'magic_get_sync_mode': return { kind: 'magic_get_sync_mode' };
		case 'magic_get_is_master': return { kind: 'magic_get_is_master' };
		case 'magic_get_sync_status': return { kind: 'magic_get_sync_status' };
		default: return { kind: 'wait', ms: 1000 };
	}
}

export function ScriptEditorDialog({ open, script, onOpenChange, onSave, isSaving }: Props) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<FormValues>({
		defaultValues: { name: '', description: '', steps: [] },
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { fields, append, remove, update } = useFieldArray({ control: control as any, name: 'steps' });

	useEffect(() => {
		if (open) {
			reset({
				name: script?.name ?? '',
				description: script?.description ?? '',
				steps: (script?.steps ?? []) as StepFormItem[],
			});
		}
	}, [open, script, reset]);

	function onSubmit(values: FormValues) {
		onSave(values.name, values.description, values.steps as ScriptStep[]);
	}

	function handleAddStep() {
		append(defaultStep('navigate') as StepFormItem);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>{script ? '编辑脚本' : '新建脚本'}</DialogTitle>
				</DialogHeader>

				<form
					id="script-editor-form"
					onSubmit={handleSubmit(onSubmit)}
					className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1"
				>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>名称 *</Label>
							<Input
								{...register('name', { required: '请输入脚本名称' })}
								placeholder="脚本名称"
								className={errors.name ? 'border-destructive' : ''}
							/>
							{errors.name && (
								<p className="text-xs text-destructive">{errors.name.message}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label>描述</Label>
							<Input {...register('description')} placeholder="可选描述" />
						</div>
					</div>

					<div>
						<div className="flex items-center justify-between mb-2">
							<Label>步骤</Label>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-7 cursor-pointer"
								onClick={handleAddStep}
							>
								<Plus className="h-3.5 w-3.5 mr-1" />
								添加步骤
							</Button>
						</div>

						{fields.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
								点击「添加步骤」开始
							</p>
						) : (
							<div className="space-y-2">
								{fields.map((field, index) => {
									const kind = watch(`steps.${index}.kind`);
									return (
										<div key={field.id} className="flex items-start gap-2 p-3 border rounded-md bg-muted/30">
											<GripVertical className="h-4 w-4 text-muted-foreground mt-1.5 flex-shrink-0" />
											<div className="flex-1 space-y-2">
												<Select
													value={kind}
													onValueChange={(v) => {
														update(index, defaultStep(v) as StepFormItem);
													}}
												>
													<SelectTrigger className="h-8 text-xs cursor-pointer">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{STEP_KINDS.map((k) => (
															<SelectItem key={k.value} value={k.value} className="cursor-pointer">
																{k.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<StepFields index={index} kind={kind} register={register} />
											</div>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-destructive"
												onClick={() => remove(index)}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</form>

				<DialogFooter className="flex-shrink-0">
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						取消
					</Button>
					<Button
						type="submit"
						form="script-editor-form"
						disabled={isSaving}
						className="cursor-pointer"
					>
						{isSaving ? '保存中...' : '保存'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StepFields({
	index,
	kind,
	register,
}: {
	index: number;
	kind: string;
	register: ReturnType<typeof useForm<FormValues>>['register'];
}) {
	switch (kind) {
		case 'navigate':
			return (
				<Input
					{...register(`steps.${index}.url` as `steps.${number}.url`)}
					placeholder="https://example.com"
					className="h-8 text-xs"
				/>
			);
		case 'wait':
			return (
				<Input
					{...register(`steps.${index}.ms` as `steps.${number}.ms`, { valueAsNumber: true })}
					type="number"
					placeholder="毫秒"
					className="h-8 text-xs"
				/>
			);
		case 'evaluate':
			return (
				<Textarea
					{...register(`steps.${index}.expression` as `steps.${number}.expression`)}
					placeholder="document.title"
					className="text-xs font-mono min-h-[60px]"
				/>
			);
		case 'click':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'type':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
						placeholder="CSS 选择器"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.text` as `steps.${number}.text`)}
						placeholder="输入文本"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'screenshot':
			return <p className="text-xs text-muted-foreground">截取当前页面截图</p>;
		case 'magic':
			return (
				<Input
					{...register(`steps.${index}.command` as `steps.${number}.command`)}
					placeholder="Magic 指令名称"
					className="h-8 text-xs"
				/>
			);
		case 'cdp':
			return (
				<Input
					{...register(`steps.${index}.method` as `steps.${number}.method`)}
					placeholder="CDP 方法，如 Page.reload"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'wait_for_user':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.message` as `steps.${number}.message`)}
						placeholder="提示信息，支持 {{变量}}"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.input_label` as `steps.${number}.input_label`)}
						placeholder="输入框标签（留空则无输入框）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'condition':
			return (
				<Input
					{...register(`steps.${index}.condition_expr` as `steps.${number}.condition_expr`)}
					placeholder='条件表达式，如 {{status}} == "ok"'
					className="h-8 text-xs font-mono"
				/>
			);
		case 'loop':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.count` as `steps.${number}.count`, { valueAsNumber: true })}
						type="number"
						placeholder="循环次数"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.iter_var` as `steps.${number}.iter_var`)}
						placeholder="迭代变量名（可选）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'break':
		case 'continue':
			return <p className="text-xs text-muted-foreground">{kind === 'break' ? '跳出当前循环' : '跳到下一次迭代'}</p>;

		// ── AI 步骤字段 ──────────────────────────────────────────────────────────
		case 'ai_prompt':
			return (
				<Textarea
					{...register(`steps.${index}.prompt` as `steps.${number}.prompt`)}
					placeholder="AI 提示词（支持 {{变量}} 插值）"
					className="text-xs min-h-[60px]"
				/>
			);
		case 'ai_extract':
			return (
				<Textarea
					{...register(`steps.${index}.prompt` as `steps.${number}.prompt`)}
					placeholder="AI 提示词，要求输出 JSON（支持 {{变量}} 插值）"
					className="text-xs min-h-[60px]"
				/>
			);
		// ── CDP 具名步骤字段 ─────────────────────────────────────────────────────
		case 'cdp_navigate':
			return (
				<Input
					{...register(`steps.${index}.url` as `steps.${number}.url`)}
					placeholder="https://example.com"
					className="h-8 text-xs"
				/>
			);
		case 'cdp_reload':
			return <p className="text-xs text-muted-foreground">刷新当前页面</p>;
		case 'cdp_evaluate':
			return (
				<Textarea
					{...register(`steps.${index}.expression` as `steps.${number}.expression`)}
					placeholder="document.title"
					className="text-xs font-mono min-h-[60px]"
				/>
			);
		case 'cdp_click':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'cdp_type':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
						placeholder="CSS 选择器"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.text` as `steps.${number}.text`)}
						placeholder="输入文本（支持 {{变量}}）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'cdp_scroll_to':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器（留空则按 x/y 坐标滚动）"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'cdp_wait_for_selector':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'cdp_get_text':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'cdp_get_attribute':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
						placeholder="CSS 选择器"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.attribute` as `steps.${number}.attribute`)}
						placeholder="属性名，如 href / data-id"
						className="h-8 text-xs font-mono"
					/>
				</div>
			);
		case 'cdp_set_input_value':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
						placeholder="CSS 选择器"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.value` as `steps.${number}.value`)}
						placeholder="设置的值（支持 {{变量}}）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'cdp_screenshot':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.output_key_base64` as `steps.${number}.output_key_base64`)}
						placeholder="base64 存入变量名（可选）"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.output_path` as `steps.${number}.output_path`)}
						placeholder="保存文件路径（可选，需绝对路径）"
						className="h-8 text-xs"
					/>
				</div>
			);
		// ── Magic 具名步骤字段 ─────────────────────────────────────────────────────
		case 'magic_set_bounds':
			return (
				<div className="grid grid-cols-4 gap-1.5">
					{(['x', 'y', 'width', 'height'] as const).map((f) => (
						<Input
							key={f}
							{...register(`steps.${index}.${f}` as `steps.${number}.x`, { valueAsNumber: true })}
							type="number"
							placeholder={f}
							className="h-8 text-xs"
						/>
					))}
				</div>
			);
		case 'magic_get_bounds':
		case 'magic_get_browsers':
		case 'magic_get_active_browser':
		case 'magic_get_active_tabs':
		case 'magic_get_host_name':
		case 'magic_get_mac_address':
		case 'magic_get_bookmarks':
		case 'magic_get_managed_cookies':
		case 'magic_get_managed_extensions':
		case 'magic_get_sync_mode':
		case 'magic_get_is_master':
		case 'magic_get_sync_status':
		case 'magic_export_bookmark_state':
		case 'magic_is_current_tab_bookmarked':
		case 'magic_open_new_window':
			return (
				<Input
					{...register(`steps.${index}.output_key` as `steps.${number}.output_key`)}
					placeholder="结果存入变量名（可选）"
					className="h-8 text-xs"
				/>
			);
		case 'magic_set_maximized':
		case 'magic_set_minimized':
		case 'magic_set_closed':
		case 'magic_set_restored':
		case 'magic_set_fullscreen':
		case 'magic_set_app_top_most':
		case 'magic_close_inactive_tabs':
		case 'magic_bookmark_current_tab':
		case 'magic_unbookmark_current_tab':
		case 'magic_close_extension_popup':
			return <p className="text-xs text-muted-foreground">无需参数</p>;
		case 'magic_set_bg_color':
			return (
				<div className="grid grid-cols-3 gap-1.5">
					{(['r', 'g', 'b'] as const).map((ch) => (
						<Input
							key={ch}
							{...register(`steps.${index}.${ch}` as `steps.${number}.r`, { valueAsNumber: true })}
							type="number"
							min={0}
							max={255}
							placeholder={ch.toUpperCase()}
							className="h-8 text-xs"
						/>
					))}
				</div>
			);
		case 'magic_set_toolbar_text':
		case 'magic_type_string':
			return (
				<Input
					{...register(`steps.${index}.text` as `steps.${number}.text`)}
					placeholder={kind === 'magic_set_toolbar_text' ? '工具栏文本（支持 {{变量}}）' : '输入文本（支持 {{变量}}）'}
					className="h-8 text-xs"
				/>
			);
		case 'magic_set_master_indicator_visible':
			return (
				<Input
					{...register(`steps.${index}.label` as `steps.${number}.label`)}
					placeholder="标记文字（留空用默认）"
					className="h-8 text-xs"
				/>
			);
		case 'magic_open_new_tab':
			return (
				<Input
					{...register(`steps.${index}.url` as `steps.${number}.url`)}
					placeholder="https://example.com"
					className="h-8 text-xs"
				/>
			);
		case 'magic_close_tab':
		case 'magic_activate_tab':
			return (
				<Input
					{...register(`steps.${index}.tab_id` as `steps.${number}.tab_id`, { valueAsNumber: true })}
					type="number"
					placeholder="tab_id"
					className="h-8 text-xs"
				/>
			);
		case 'magic_activate_tab_by_index':
			return (
				<Input
					{...register(`steps.${index}.index` as `steps.${number}.index`, { valueAsNumber: true })}
					type="number"
					placeholder="标签页索引 (0起)"
					className="h-8 text-xs"
				/>
			);
		case 'magic_capture_app_shell':
			return (
				<Input
					{...register(`steps.${index}.output_key_base64` as `steps.${number}.output_key_base64`)}
					placeholder="base64 存入变量名（可选）"
					className="h-8 text-xs"
				/>
			);
		case 'magic_get_tabs':
			return (
				<Input
					{...register(`steps.${index}.browser_id` as `steps.${number}.browser_id`, { valueAsNumber: true })}
					type="number"
					placeholder="browser_id"
					className="h-8 text-xs"
				/>
			);
		case 'magic_get_switches':
			return (
				<Input
					{...register(`steps.${index}.key` as `steps.${number}.key`)}
					placeholder="启动参数 key，如 fingerprint-seed"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'magic_create_bookmark':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.title` as `steps.${number}.title`)}
						placeholder="书签标题"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.url` as `steps.${number}.url`)}
						placeholder="书签 URL"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.parent_id` as `steps.${number}.parent_id`)}
						placeholder="父文件夹 node_id"
						className="h-8 text-xs font-mono"
					/>
				</div>
			);
		case 'magic_create_bookmark_folder':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.title` as `steps.${number}.title`)}
						placeholder="文件夹名称"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.parent_id` as `steps.${number}.parent_id`)}
						placeholder="父文件夹 node_id"
						className="h-8 text-xs font-mono"
					/>
				</div>
			);
		case 'magic_update_bookmark':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.node_id` as `steps.${number}.node_id`)}
						placeholder="node_id"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.title` as `steps.${number}.title`)}
						placeholder="新标题（可选）"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.url` as `steps.${number}.url`)}
						placeholder="新URL（可选）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'magic_move_bookmark':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.node_id` as `steps.${number}.node_id`)}
						placeholder="node_id"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.new_parent_id` as `steps.${number}.new_parent_id`)}
						placeholder="新父文件夹 node_id"
						className="h-8 text-xs font-mono"
					/>
				</div>
			);
		case 'magic_remove_bookmark':
			return (
				<Input
					{...register(`steps.${index}.node_id` as `steps.${number}.node_id`)}
					placeholder="node_id"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'magic_export_cookie_state':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.mode` as `steps.${number}.mode`)}
						placeholder="mode: all | url"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.url` as `steps.${number}.url`)}
						placeholder="URL（mode=url 时必填）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'magic_trigger_extension_action':
			return (
				<Input
					{...register(`steps.${index}.extension_id` as `steps.${number}.extension_id`)}
					placeholder="extension_id"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'magic_toggle_sync_mode':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.role` as `steps.${number}.role`)}
						placeholder="role: master | slave | disabled"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.session_id` as `steps.${number}.session_id`)}
						placeholder="session_id（可选）"
						className="h-8 text-xs font-mono"
					/>
				</div>
			);

		default:
			return null;
	}
}
