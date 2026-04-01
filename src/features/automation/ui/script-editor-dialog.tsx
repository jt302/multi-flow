import { useEffect } from 'react';

import { FolderOpen, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import type { AiProviderConfig, AiProviderType, AutomationScript, ScriptStep } from '@/entities/automation/model/types';
import { STEP_KINDS, defaultStep } from '@/entities/automation/model/step-registry';
import type { ProfileItem } from '@/entities/profile/model/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
	associatedProfileIds: string[];
	aiProvider: string;
	aiBaseUrl: string;
	aiApiKey: string;
	aiModel: string;
};

type Props = {
	open: boolean;
	script: AutomationScript | null;
	onOpenChange: (open: boolean) => void;
	activeProfiles: ProfileItem[];
	onSave: (
		name: string,
		description: string,
		steps: ScriptStep[],
		associatedProfileIds: string[],
		aiConfig: AiProviderConfig | null,
	) => void;
	isSaving: boolean;
};

export function ScriptEditorDialog({ open, script, onOpenChange, activeProfiles, onSave, isSaving }: Props) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		getValues,
		setValue,
		formState: { errors },
	} = useForm<FormValues>({
		defaultValues: {
			name: '',
			description: '',
			steps: [],
			associatedProfileIds: [],
			aiProvider: '',
			aiBaseUrl: '',
			aiApiKey: '',
			aiModel: '',
		},
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { fields, append, remove, update } = useFieldArray({ control: control as any, name: 'steps' });

	useEffect(() => {
		if (open) {
			reset({
				name: script?.name ?? '',
				description: script?.description ?? '',
				steps: (script?.steps ?? []) as StepFormItem[],
				associatedProfileIds: script?.associatedProfileIds ?? [],
				aiProvider: script?.aiConfig?.provider ?? '',
				aiBaseUrl: script?.aiConfig?.baseUrl ?? '',
				aiApiKey: script?.aiConfig?.apiKey ?? '',
				aiModel: script?.aiConfig?.model ?? '',
			});
		}
	}, [open, script, reset]);

	function onSubmit(values: FormValues) {
		const aiConfig: AiProviderConfig | null =
			values.aiProvider || values.aiBaseUrl || values.aiApiKey || values.aiModel
				? {
						provider: (values.aiProvider as AiProviderType) || undefined,
						baseUrl: values.aiBaseUrl || undefined,
						apiKey: values.aiApiKey || undefined,
						model: values.aiModel || undefined,
				  }
				: null;
		onSave(
			values.name.trim(),
			values.description,
			values.steps as ScriptStep[],
			values.associatedProfileIds,
			aiConfig,
		);
	}

	function handleAddStep() {
		append(defaultStep('navigate') as StepFormItem);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
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
												<StepFields index={index} kind={kind} register={register} control={control} watch={watch} getValues={getValues} setValue={setValue} />
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

					{/* 关联环境 */}
					<div>
						<p className="mb-2 text-sm font-medium">关联环境</p>
						<p className="mb-2 text-xs text-muted-foreground">运行时自动预选这些环境，未启动时将自动启动</p>
						{activeProfiles.length === 0 ? (
							<p className="text-xs text-muted-foreground">暂无活跃环境</p>
						) : (
							<div className="space-y-1 max-h-32 overflow-y-auto border border-border/40 rounded-md p-2">
								<Controller
									control={control}
									name="associatedProfileIds"
									rules={{ validate: (val) => val.length > 0 || '请至少选择一个关联环境' }}
									render={({ field }) => (
										<>
											{activeProfiles.map((profile) => (
												<label key={profile.id} className="flex items-center gap-2 cursor-pointer">
													<Checkbox
														checked={field.value.includes(profile.id)}
														onCheckedChange={(checked) => {
															const newIds = checked
																? [...field.value, profile.id]
																: field.value.filter((id) => id !== profile.id);
															field.onChange(newIds);
														}}
														className="cursor-pointer"
													/>
													<span className="text-sm">{profile.name}</span>
												</label>
											))}
										</>
									)}
								/>
							</div>
						)}
						{errors.associatedProfileIds && (
							<p className="text-xs text-destructive mt-1">{errors.associatedProfileIds.message}</p>
						)}
					</div>

					{/* AI 配置 */}
					<div>
						<p className="mb-2 text-sm font-medium">AI 配置（可选）</p>
						<p className="mb-2 text-xs text-muted-foreground">留空则使用全局 AI 配置</p>
						<div className="space-y-2">
							<div>
								<p className="mb-1 text-xs text-muted-foreground">Provider</p>
								<Controller
									control={control}
									name="aiProvider"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger className="h-9 text-sm cursor-pointer">
												<SelectValue placeholder="使用全局配置" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="">使用全局配置</SelectItem>
												<SelectItem value="openai">OpenAI</SelectItem>
												<SelectItem value="openrouter">OpenRouter</SelectItem>
												<SelectItem value="deepseek">DeepSeek</SelectItem>
												<SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
												<SelectItem value="gemini">Google Gemini</SelectItem>
												<SelectItem value="groq">Groq</SelectItem>
												<SelectItem value="together">Together AI</SelectItem>
												<SelectItem value="ollama">Ollama (本地)</SelectItem>
												<SelectItem value="custom">自定义</SelectItem>
											</SelectContent>
										</Select>
									)}
								/>
							</div>
							<div>
								<p className="mb-1 text-xs text-muted-foreground">Base URL（可选，覆盖默认值）</p>
								<Input
									{...register('aiBaseUrl')}
									placeholder={(() => {
										const p = watch('aiProvider');
										const map: Record<string, string> = {
											openai: 'https://api.openai.com/v1',
											openrouter: 'https://openrouter.ai/api/v1',
											deepseek: 'https://api.deepseek.com/v1',
											groq: 'https://api.groq.com/openai/v1',
											together: 'https://api.together.xyz/v1',
											ollama: 'http://localhost:11434/v1',
											anthropic: 'https://api.anthropic.com',
											gemini: 'https://generativelanguage.googleapis.com',
										};
										return map[p] ?? 'https://api.openai.com/v1';
									})()}
								/>
							</div>
							{watch('aiProvider') !== 'ollama' && (
								<div>
									<p className="mb-1 text-xs text-muted-foreground">API Key</p>
									<Input {...register('aiApiKey')} type="password" placeholder="sk-..." />
								</div>
							)}
							<div>
								<p className="mb-1 text-xs text-muted-foreground">模型</p>
								<Input
									{...register('aiModel')}
									placeholder={(() => {
										const p = watch('aiProvider');
										const map: Record<string, string> = {
											openai: 'gpt-4o',
											openrouter: 'openai/gpt-4o',
											deepseek: 'deepseek-chat',
											anthropic: 'claude-opus-4-5',
											gemini: 'gemini-2.0-flash',
											groq: 'llama-3.3-70b-versatile',
											together: 'meta-llama/Llama-3-70b-chat-hf',
											ollama: 'llama3',
										};
										return map[p] ?? 'gpt-4o';
									})()}
								/>
							</div>
						</div>
					</div>
				</form>

				<DialogFooter className="flex-shrink-0">
					<Button
						type="button"
						variant="ghost"
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
	control,
	watch,
	getValues,
	setValue,
}: {
	index: number;
	kind: string;
	register: ReturnType<typeof useForm<FormValues>>['register'];
	control: ReturnType<typeof useForm<FormValues>>['control'];
	watch: ReturnType<typeof useForm<FormValues>>['watch'];
	getValues: ReturnType<typeof useForm<FormValues>>['getValues'];
	setValue: ReturnType<typeof useForm<FormValues>>['setValue'];
}) {
	function selectorPlaceholder(type?: string): string {
		switch (type) {
			case 'xpath': return '//div[@id="main"]';
			case 'text': return '按文本内容匹配';
			default: return 'CSS 选择器';
		}
	}

	function selectorField(customCssPlaceholder?: string) {
		const selectorTypePath = `steps.${index}.selector_type` as `steps.${number}.selector_type`;
		const selectorPath = `steps.${index}.selector` as `steps.${number}.selector`;
		const selectedType = watch(selectorTypePath);
		const placeholder = selectedType === 'css' && customCssPlaceholder
			? customCssPlaceholder
			: selectorPlaceholder(selectedType);
		return (
			<div className="flex gap-1.5">
				<Controller
					control={control}
					name={selectorTypePath}
					render={({ field }) => (
						<Select value={field.value ?? 'css'} onValueChange={field.onChange}>
							<SelectTrigger className="h-8 w-[80px] text-xs flex-shrink-0 cursor-pointer">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="css">CSS</SelectItem>
								<SelectItem value="xpath">XPath</SelectItem>
								<SelectItem value="text">Text</SelectItem>
							</SelectContent>
						</Select>
					)}
				/>
				<Input
					{...register(selectorPath)}
					placeholder={placeholder}
					className="h-8 text-xs font-mono flex-1"
				/>
			</div>
		);
	}

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
			return selectorField();
		case 'type':
			return (
				<div className="space-y-1.5">
					{selectorField()}
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
		case 'ai_agent':
			return (
				<div className="space-y-1.5">
					<Textarea
						{...register(`steps.${index}.system_prompt` as `steps.${number}.system_prompt`)}
						placeholder="系统提示词（Agent 角色与能力说明）"
						className="text-xs min-h-[60px]"
					/>
					<Textarea
						{...register(`steps.${index}.initial_message` as `steps.${number}.initial_message`)}
						placeholder="初始用户消息（支持 {{变量}} 插值）"
						className="text-xs min-h-[40px]"
					/>
					<Input
						type="number"
						{...register(`steps.${index}.max_steps` as `steps.${number}.max_steps`, { valueAsNumber: true })}
						placeholder="最大循环轮次（默认 10）"
						className="h-8 text-xs"
					/>
				</div>
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
			return selectorField();
		case 'cdp_type':
			return (
				<div className="space-y-1.5">
					{selectorField()}
					<Input
						{...register(`steps.${index}.text` as `steps.${number}.text`)}
						placeholder="输入文本（支持 {{变量}}）"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'cdp_scroll_to':
			return selectorField('CSS 选择器（留空则按 x/y 坐标滚动）');
		case 'cdp_wait_for_selector':
			return selectorField();
		case 'cdp_get_text':
			return selectorField();
		case 'cdp_get_attribute':
			return (
				<div className="space-y-1.5">
					{selectorField()}
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
					{selectorField()}
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
						{...register(`steps.${index}.output_key_file_path` as `steps.${number}.output_key_file_path`)}
						placeholder="文件路径存入变量名（可选）"
						className="h-8 text-xs"
					/>
					<div className="flex gap-1">
						<Input
							{...register(`steps.${index}.output_path` as `steps.${number}.output_path`)}
							placeholder="保存路径（留空则自动保存到默认目录）"
							className="h-8 text-xs flex-1"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
							title="选择保存路径"
							onClick={async () => {
								const { save } = await import('@tauri-apps/plugin-dialog');
								const currentPath = getValues(`steps.${index}.output_path` as `steps.${number}.output_path`) as string;
								const selected = await save({
									defaultPath: currentPath || 'screenshot.png',
									filters: [{ name: '图片文件', extensions: ['png', 'jpeg', 'jpg'] }],
								});
								if (selected) {
									setValue(`steps.${index}.output_path` as `steps.${number}.output_path`, selected);
								}
							}}
						>
							<FolderOpen className="h-3.5 w-3.5" />
						</Button>
					</div>
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
