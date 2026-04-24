/**
 * step-properties-panel.tsx
 * 步骤属性面板，显示在画布右侧。
 * 当用户选中一个步骤节点时，展示该步骤的可编辑字段。
 *
 * 当前版本：保留原 if/else 分支渲染逻辑（简化版），方便后续改造为 field-registry 驱动。
 * 变量插入功能：支持在文本输入框中通过 Popover 选择并插入 {{变量名}}。
 */

import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { ChevronDown, FolderOpen, Trash2, Variable } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getKindLabel } from '@/entities/automation/model/step-registry';
import type { DialogButton, ScriptStep, ScriptVarDef } from '@/entities/automation/model/types';

type Props = {
	step: ScriptStep;
	onUpdate: (step: ScriptStep) => void;
	onDelete: () => void;
	varsDefs: ScriptVarDef[];
	stepIndex: number;
	allSteps: ScriptStep[];
};

/**
 * 步骤属性面板
 * 根据步骤 kind 渲染对应的可编辑字段，并提供变量插入入口。
 */
export function StepPropertiesPanel({
	step,
	onUpdate,
	onDelete,
	varsDefs,
	stepIndex,
	allSteps,
}: Props) {
	const s = step as Record<string, unknown>;
	const kind = step.kind;
	const { t } = useTranslation(['automation', 'common']);

	// ── 计算可用变量（脚本级 + 前置步骤输出） ─────────────────────────────────
	const availableVars: { name: string; source: string }[] = [
		// 脚本级变量
		...varsDefs.map((v) => ({ name: v.name, source: t('automation:properties.scriptVar') })),
		// 前置步骤输出变量
		...allSteps.slice(0, stepIndex).flatMap((stepItem, i) => {
			const stepRecord = stepItem as Record<string, unknown>;
			const results: { name: string; source: string }[] = [];
			if (typeof stepRecord.output_key === 'string' && stepRecord.output_key) {
				results.push({
					name: stepRecord.output_key as string,
					source: t('common:stepsCount', { count: i + 1 }),
				});
			}
			if (typeof stepRecord.output_key_base64 === 'string' && stepRecord.output_key_base64) {
				results.push({
					name: stepRecord.output_key_base64 as string,
					source: t('common:stepsCount', { count: i + 1 }),
				});
			}
			if (typeof stepRecord.iter_var === 'string' && stepRecord.iter_var) {
				results.push({
					name: stepRecord.iter_var as string,
					source: t('common:stepsCount', { count: i + 1 }),
				});
			}
			return results;
		}),
	];

	// ── 字段渲染辅助函数 ──────────────────────────────────────────────────────

	/**
	 * 文本字段（单行或多行），支持变量插入
	 * @param key - 步骤数据字段名
	 * @param label - 显示标签
	 * @param multi - 是否多行 Textarea
	 */
	function tf(key: string, label: string, multi = false) {
		const value = String(s[key] ?? '');
		const inputId = `tf-${key}`;

		/** 在光标位置插入 {{varName}} */
		function insertVar(varName: string) {
			const insertion = `{{${varName}}}`;
			const el = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
			if (el) {
				const start = el.selectionStart ?? value.length;
				const end = el.selectionEnd ?? value.length;
				const newVal = value.slice(0, start) + insertion + value.slice(end);
				onUpdate({ ...step, [key]: newVal } as ScriptStep);
				// 异步设置光标位置
				setTimeout(() => {
					el.focus();
					el.setSelectionRange(start + insertion.length, start + insertion.length);
				}, 0);
			} else {
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
							title={t('automation:properties.insertVar')}
						>
							<Variable className="h-3.5 w-3.5" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-52 p-1" align="end">
						<div className="text-xs text-muted-foreground px-2 py-1 font-medium">
							{t('automation:properties.selectVar')}
						</div>
						{availableVars.map((v) => (
							<button
								key={`${v.name}-${v.source}`}
								type="button"
								className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent cursor-pointer flex items-center justify-between gap-2"
								onClick={() => insertVar(v.name)}
							>
								<span className="font-mono text-blue-500 truncate">{`{{${v.name}}}`}</span>
								<span className="text-muted-foreground flex-shrink-0">{v.source}</span>
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
							onChange={(e) => onUpdate({ ...step, [key]: e.target.value } as ScriptStep)}
							className="text-xs min-h-[100px] pr-8 resize-y"
						/>
						{varButton && <div className="absolute top-1 right-1">{varButton}</div>}
					</div>
				) : (
					<div className="flex gap-1">
						<Input
							id={inputId}
							value={value}
							onChange={(e) => onUpdate({ ...step, [key]: e.target.value } as ScriptStep)}
							className="h-8 text-xs flex-1"
						/>
						{varButton}
					</div>
				)}
			</div>
		);
	}

	/** 数字字段 */
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

	/** 选择器字段（CSS/XPath/Text 三种类型） */
	function sf(label = t('automation:properties.selector'), optional = false) {
		const sType = String(s.selector_type ?? 'css');
		const placeholder =
			sType === 'xpath'
				? '//div[@id="main"]'
				: sType === 'text'
					? t('automation:properties.textMatch')
					: optional
						? t('automation:properties.cssOptional')
						: t('automation:properties.cssDefault');
		return (
			<div key="selector" className="space-y-1">
				<Label className="text-xs">{label}</Label>
				<div className="flex gap-1.5">
					<Select
						value={sType}
						onValueChange={(v) => onUpdate({ ...step, selector_type: v } as ScriptStep)}
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
						value={String(s.selector ?? '')}
						onChange={(e) => onUpdate({ ...step, selector: e.target.value } as ScriptStep)}
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
						onChange={(e) => onUpdate({ ...step, [key]: e.target.value } as ScriptStep)}
						placeholder={t('automation:properties.newOrSelect')}
						className="h-8 text-xs flex-1"
					/>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-8 w-8 flex-shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
								title={t('automation:properties.selectExisting')}
								disabled={availableVars.length === 0}
							>
								<ChevronDown className="h-3.5 w-3.5" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-52 p-1" align="end">
							{availableVars.length > 0 ? (
								<>
									<div className="text-xs text-muted-foreground px-2 py-1 font-medium">
										{t('automation:properties.selectExisting')}
									</div>
									{availableVars.map((v) => (
										<button
											key={`${v.name}-${v.source}`}
											type="button"
											className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent cursor-pointer flex items-center justify-between gap-2"
											onClick={() => onUpdate({ ...step, [key]: v.name } as ScriptStep)}
										>
											<span className="font-mono text-blue-500 truncate">{v.name}</span>
											<span className="text-muted-foreground flex-shrink-0 text-[10px]">
												{v.source}
											</span>
										</button>
									))}
								</>
							) : (
								<div className="text-xs text-muted-foreground px-2 py-2 text-center">
									{t('automation:properties.noVarsAvailable')}
								</div>
							)}
						</PopoverContent>
					</Popover>
				</div>
			</div>
		);
	}

	/** output_key 字段快捷方式 */
	const okf = () => outputKeyField('output_key', t('automation:properties.outputKey'));

	// ── 根据 kind 构建字段列表 ─────────────────────────────────────────────────
	const fields: React.ReactNode[] = [];

	if (kind === 'navigate' || kind === 'cdp_navigate') {
		fields.push(tf('url', t('automation:properties.url')));
		fields.push(okf());
	} else if (kind === 'wait') {
		fields.push(nf('ms', t('automation:fields.waitMs')));
	} else if (kind === 'click' || kind === 'cdp_click') {
		fields.push(sf());
	} else if (kind === 'type' || kind === 'cdp_type') {
		fields.push(sf());
		fields.push(tf('text', t('automation:fields.inputText'), true));
	} else if (kind === 'cdp_get_text') {
		fields.push(sf());
		fields.push(okf());
	} else if (kind === 'cdp_wait_for_selector') {
		fields.push(sf());
		fields.push(nf('timeout_ms', t('automation:fields.timeoutMs')));
	} else if (kind === 'cdp_wait_for_page_load') {
		fields.push(nf('timeout_ms', t('automation:fields.timeoutMs')));
	} else if (kind === 'cdp_scroll_to') {
		fields.push(sf(t('automation:properties.selectorOptional'), true));
	} else if (kind === 'cdp_screenshot') {
		fields.push(outputKeyField('output_key_file_path', t('automation:fields.filePathVar')));
		const pathValue = String(s.output_path ?? '');
		fields.push(
			<div key="output_path" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.savePath')}</Label>
				<div className="flex gap-1">
					<Input
						value={pathValue}
						onChange={(e) => onUpdate({ ...step, output_path: e.target.value } as ScriptStep)}
						placeholder={t('common:leaveEmptyForDefault')}
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title={t('automation:fields.selectSavePath')}
						onClick={async () => {
							const selected = await saveDialog({
								defaultPath: pathValue || 'screenshot.png',
								filters: [
									{ name: t('automation:fields.imageFile'), extensions: ['png', 'jpeg', 'jpg'] },
								],
							});
							if (selected) {
								onUpdate({
									...step,
									output_path: typeof selected === 'string' ? selected : selected,
								} as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
	} else if (kind === 'cdp_open_new_tab') {
		fields.push(tf('url', t('automation:properties.url')));
		fields.push(okf());
	} else if (kind === 'cdp_get_all_tabs') {
		fields.push(okf());
	} else if (kind === 'cdp_switch_tab') {
		fields.push(tf('target_id', t('automation:fields.targetId')));
	} else if (kind === 'cdp_close_tab') {
		fields.push(tf('target_id', t('automation:fields.targetId')));
	} else if (kind === 'cdp_go_back' || kind === 'cdp_go_forward') {
		fields.push(nf('steps', t('common:steps')));
	} else if (kind === 'cdp_upload_file') {
		fields.push(sf());
		fields.push(tf('files.0', t('automation:fields.filePath')));
	} else if (kind === 'cdp_download_file') {
		const dlPathValue = String(s.download_path ?? '');
		fields.push(
			<div key="download_path" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.downloadDir')}</Label>
				<div className="flex gap-1">
					<Input
						value={dlPathValue}
						onChange={(e) => onUpdate({ ...step, download_path: e.target.value } as ScriptStep)}
						placeholder={t('automation:fields.selectOrInputDownloadDir')}
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title={t('automation:fields.selectDir')}
						onClick={async () => {
							const { open } = await import('@tauri-apps/plugin-dialog');
							const selected = await open({ directory: true });
							if (selected) {
								onUpdate({
									...step,
									download_path: selected as string,
								} as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
	} else if (kind === 'cdp_clipboard') {
		const clipAction = String(s.action ?? 'copy');
		fields.push(
			<div key="action" className="space-y-1">
				<Label className="text-xs">{t('automation:action')}</Label>
				<Select
					value={clipAction}
					onValueChange={(v) => onUpdate({ ...step, action: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="copy">{t('automation:actions.copy')} (Copy)</SelectItem>
						<SelectItem value="paste">{t('automation:actions.paste')} (Paste)</SelectItem>
						<SelectItem value="select_all">{t('common:selectAll')} (Select All)</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
	} else if (kind === 'cdp_execute_js') {
		fields.push(tf('expression', t('automation:fields.jsCode'), true));
		const jsFilePath = String(s.file_path ?? '');
		fields.push(
			<div key="file_path" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.jsFilePath')}</Label>
				<div className="flex gap-1">
					<Input
						value={jsFilePath}
						onChange={(e) => onUpdate({ ...step, file_path: e.target.value } as ScriptStep)}
						placeholder={t('automation:fields.leaveEmptyForAboveCode')}
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title={t('automation:fields.selectJsFile')}
						onClick={async () => {
							const { open } = await import('@tauri-apps/plugin-dialog');
							const selected = await open({
								filters: [{ name: t('automation:fields.jsFile'), extensions: ['js', 'mjs'] }],
							});
							if (selected) {
								onUpdate({
									...step,
									file_path: selected as string,
								} as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
		fields.push(okf());
	} else if (kind === 'cdp_input_text') {
		fields.push(sf());
		const textSrc = String(s.text_source ?? 'inline');
		fields.push(
			<div key="text_source" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.textSource')}</Label>
				<Select
					value={textSrc}
					onValueChange={(v) => onUpdate({ ...step, text_source: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="inline">{t('automation:fields.inlineInput')}</SelectItem>
						<SelectItem value="file">{t('automation:fields.readFromFile')}</SelectItem>
						<SelectItem value="variable">{t('automation:fields.readFromVar')}</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		if (textSrc === 'inline') {
			fields.push(tf('text', t('automation:fields.inputText'), true));
		} else if (textSrc === 'file') {
			const filePath = String(s.file_path ?? '');
			fields.push(
				<div key="file_path" className="space-y-1">
					<Label className="text-xs">{t('automation:fields.textFilePath')}</Label>
					<div className="flex gap-1">
						<Input
							value={filePath}
							onChange={(e) => onUpdate({ ...step, file_path: e.target.value } as ScriptStep)}
							placeholder={t('automation:fields.selectTextFile')}
							className="h-8 text-xs flex-1"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
							title={t('common:selectFile')}
							onClick={async () => {
								const { open } = await import('@tauri-apps/plugin-dialog');
								const selected = await open({
									filters: [
										{ name: t('automation:fields.textFile'), extensions: ['txt', 'md', 'csv'] },
									],
								});
								if (selected) {
									onUpdate({
										...step,
										file_path: selected as string,
									} as ScriptStep);
								}
							}}
						>
							<FolderOpen className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>,
			);
		} else if (textSrc === 'variable') {
			fields.push(tf('var_name', t('automation:fields.varName')));
		}
	} else if (kind === 'cdp_press_key') {
		const keyVal = String(s.key ?? 'Enter');
		fields.push(
			<div key="key" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.keyPress')}</Label>
				<Select value={keyVal} onValueChange={(v) => onUpdate({ ...step, key: v } as ScriptStep)}>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="Enter">Enter</SelectItem>
						<SelectItem value="Tab">Tab</SelectItem>
						<SelectItem value="Escape">Escape</SelectItem>
						<SelectItem value="Backspace">Backspace</SelectItem>
						<SelectItem value="Delete">Delete</SelectItem>
						<SelectItem value="Space">Space ({t('automation:fields.spaceKey')})</SelectItem>
						<SelectItem value="ArrowUp">ArrowUp</SelectItem>
						<SelectItem value="ArrowDown">ArrowDown</SelectItem>
						<SelectItem value="ArrowLeft">ArrowLeft</SelectItem>
						<SelectItem value="ArrowRight">ArrowRight</SelectItem>
						<SelectItem value="Home">Home</SelectItem>
						<SelectItem value="End">End</SelectItem>
						<SelectItem value="PageUp">PageUp</SelectItem>
						<SelectItem value="PageDown">PageDown</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
	} else if (kind === 'cdp_shortcut') {
		const mods = (s.modifiers as string[] | undefined) ?? [];
		const toggleMod = (mod: string) => {
			const newMods = mods.includes(mod) ? mods.filter((m: string) => m !== mod) : [...mods, mod];
			onUpdate({ ...step, modifiers: newMods } as ScriptStep);
		};
		fields.push(
			<div key="modifiers" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.modifierKeys')}</Label>
				<div className="flex flex-wrap gap-3">
					{(['ctrl', 'meta', 'alt', 'shift'] as const).map((mod) => (
						<label key={mod} className="flex items-center gap-1.5 text-xs cursor-pointer">
							<input
								type="checkbox"
								checked={mods.includes(mod)}
								onChange={() => toggleMod(mod)}
								className="h-3.5 w-3.5 cursor-pointer"
							/>
							{mod === 'meta'
								? t('automation:properties.modKeyMeta')
								: t(`automation:properties.modKey${mod.charAt(0).toUpperCase() + mod.slice(1)}`)}
						</label>
					))}
				</div>
			</div>,
		);
		fields.push(tf('key', t('automation:fields.keyName')));
	} else if (kind === 'cdp_get_attribute') {
		fields.push(sf());
		fields.push(tf('attribute', t('automation:fields.attrName')));
		fields.push(okf());
	} else if (kind === 'cdp_set_input_value') {
		fields.push(sf());
		fields.push(tf('value', t('automation:fields.setValue')));
	} else if (kind === 'cdp_reload') {
		const ignoreCache = Boolean(s.ignore_cache ?? false);
		fields.push(
			<div key="ignore_cache" className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={ignoreCache}
					onChange={(e) => onUpdate({ ...step, ignore_cache: e.target.checked } as ScriptStep)}
					className="h-3.5 w-3.5 cursor-pointer"
				/>
				<Label className="text-xs">{t('automation:fields.ignoreCache')}</Label>
			</div>,
		);
	} else if (kind === 'wait_for_user') {
		fields.push(tf('message', t('automation:properties.message'), true));
		fields.push(tf('input_label', t('automation:properties.inputLabel')));

		fields.push(okf());
		fields.push(nf('timeout_ms', t('automation:properties.timeoutMsZero')));
		const onTimeout = String(s.on_timeout ?? 'continue');

		fields.push(
			<div key="on_timeout" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.timeoutAction')}</Label>
				<Select
					value={onTimeout}
					onValueChange={(v) => onUpdate({ ...step, on_timeout: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="continue" className="cursor-pointer">
							{t('common:continue')}
						</SelectItem>
						<SelectItem value="fail" className="cursor-pointer">
							{t('automation:actions.markFailed')}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
	} else if (kind === 'print') {
		fields.push(tf('text', t('automation:fields.printText'), true));
		const lvl = String(s.level ?? 'info');
		fields.push(
			<div key="level" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.logLevel')}</Label>
				<Select value={lvl} onValueChange={(v) => onUpdate({ ...step, level: v } as ScriptStep)}>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="info" className="cursor-pointer">
							info
						</SelectItem>
						<SelectItem value="warn" className="cursor-pointer">
							warn
						</SelectItem>
						<SelectItem value="error" className="cursor-pointer">
							error
						</SelectItem>
						<SelectItem value="debug" className="cursor-pointer">
							debug
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
	} else if (kind === 'condition') {
		fields.push(tf('condition_expr', t('common:conditionExpr')));
	} else if (kind === 'loop') {
		const loopMode = String(s.mode ?? 'count');
		fields.push(
			<div key="mode" className="space-y-1">
				<Label className="text-xs">{t('common:loopMode')}</Label>
				<Select
					value={loopMode}
					onValueChange={(v) => onUpdate({ ...step, mode: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="count" className="cursor-pointer">
							{t('common:loopCount')}
						</SelectItem>
						<SelectItem value="while" className="cursor-pointer">
							{t('common:loopWhile')}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		if (loopMode === 'count') {
			fields.push(nf('count', t('automation:fields.loopCount')));
		} else {
			fields.push(tf('condition_expr', t('automation:fields.loopCondition')));
			fields.push(nf('max_iterations', t('common:maxIterations')));
		}
		fields.push(tf('iter_var', t('common:iterationVar')));
	} else if (kind === 'ai_agent') {
		fields.push(tf('prompt', t('automation:fields.prompt'), true));
		fields.push(tf('system_prompt', t('automation:fields.systemPrompt'), true));
		const outputFormat = String(s.output_format ?? 'text');
		fields.push(
			<div key="output_format" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.outputFormat')}</Label>
				<Select
					value={outputFormat}
					onValueChange={(v) => onUpdate({ ...step, output_format: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="text" className="cursor-pointer">
							{t('automation:fields.formatText')}
						</SelectItem>
						<SelectItem value="json" className="cursor-pointer">
							{t('automation:fields.formatJson')}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		fields.push(nf('max_steps', t('automation:fields.maxRounds')));
		fields.push(okf());
	} else if (kind === 'ai_judge') {
		fields.push(tf('prompt', t('automation:fields.judgePrompt'), true));
		const outputMode = String(s.output_mode ?? 'boolean');
		fields.push(
			<div key="output_mode" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.outputMode')}</Label>
				<Select
					value={outputMode}
					onValueChange={(v) => onUpdate({ ...step, output_mode: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="boolean" className="cursor-pointer">
							{t('automation:fields.booleanMode')}
						</SelectItem>
						<SelectItem value="percentage" className="cursor-pointer">
							{t('automation:fields.percentageMode')}
						</SelectItem>
					</SelectContent>
				</Select>
				<p className="text-[10px] text-muted-foreground">
					{outputMode === 'boolean'
						? t('automation:properties.booleanHint')
						: t('automation:properties.percentageHint')}
				</p>
			</div>,
		);
		fields.push(nf('max_steps', t('automation:fields.maxRounds')));
		fields.push(okf());
	} else if (kind === 'magic_open_new_tab') {
		fields.push(tf('url', t('automation:properties.url')));
		fields.push(okf());
	} else if (kind === 'magic_set_bounds') {
		fields.push(nf('x', t('automation:properties.positionX')));
		fields.push(nf('y', t('automation:properties.positionY')));
		fields.push(nf('width', t('automation:properties.width')));
		fields.push(nf('height', t('automation:properties.height')));
	} else if (kind === 'magic_capture_app_shell') {
		fields.push(outputKeyField('output_key_file_path', t('automation:fields.filePathVar')));
		const appShellPathValue = String(s.output_path ?? '');
		fields.push(
			<div key="output_path" className="space-y-1">
				<Label className="text-xs">{t('automation:fields.savePath')}</Label>
				<div className="flex gap-1">
					<Input
						value={appShellPathValue}
						onChange={(e) => onUpdate({ ...step, output_path: e.target.value } as ScriptStep)}
						placeholder={t('common:leaveEmptyForDefault')}
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title={t('automation:fields.selectSavePath')}
						onClick={async () => {
							const selected = await saveDialog({
								defaultPath: appShellPathValue || 'appshell.png',
								filters: [
									{ name: t('automation:fields.imageFile'), extensions: ['png', 'jpeg', 'jpg'] },
								],
							});
							if (selected) {
								onUpdate({
									...step,
									output_path: typeof selected === 'string' ? selected : selected,
								} as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
	} else if (['magic_get_browsers', 'magic_get_bounds'].includes(kind)) {
		fields.push(okf());
	} else if (kind === 'magic_enable_extension' || kind === 'magic_disable_extension') {
		fields.push(tf('extension_id', t('automation:fields.extensionId')));
	} else if (kind === 'confirm_dialog') {
		fields.push(tf('title', t('common:title')));
		fields.push(tf('message', t('automation:properties.message'), true));
		// 动态按钮列表编辑器

		const buttons = (s.buttons as DialogButton[] | undefined) ?? [
			{ text: t('common:confirm'), value: 'confirm', variant: 'default' },
			{ text: t('common:cancel'), value: 'cancel', variant: 'outline' },
		];
		fields.push(
			<div key="buttons" className="space-y-1">
				<Label className="text-xs">{t('automation:properties.buttonList')}</Label>
				<div className="space-y-1.5">
					{buttons.map((btn: DialogButton, i: number) => (
						<div
							key={`${btn.value || btn.text || 'button'}-${btn.variant ?? 'default'}`}
							className="flex gap-1 items-center"
						>
							<Input
								value={btn.text}
								onChange={(e) => {
									const newBtns = [...buttons];
									newBtns[i] = { ...btn, text: e.target.value };
									onUpdate({ ...step, buttons: newBtns } as ScriptStep);
								}}
								placeholder={t('automation:fields.buttonText')}
								className="h-7 text-xs flex-1"
							/>
							<Input
								value={btn.value}
								onChange={(e) => {
									const newBtns = [...buttons];
									newBtns[i] = { ...btn, value: e.target.value };
									onUpdate({ ...step, buttons: newBtns } as ScriptStep);
								}}
								placeholder={t('automation:fields.buttonValue')}
								className="h-7 text-xs w-20"
							/>
							<Select
								value={btn.variant ?? 'default'}
								onValueChange={(v) => {
									const newBtns = [...buttons];
									newBtns[i] = {
										...btn,
										variant: v as DialogButton['variant'],
									};
									onUpdate({ ...step, buttons: newBtns } as ScriptStep);
								}}
							>
								<SelectTrigger className="h-7 text-xs w-20 cursor-pointer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default" className="cursor-pointer">
										{t('automation:properties.variantDefault')}
									</SelectItem>
									<SelectItem value="outline" className="cursor-pointer">
										{t('automation:properties.variantOutline')}
									</SelectItem>
									<SelectItem value="destructive" className="cursor-pointer">
										{t('automation:properties.variantDestructive')}
									</SelectItem>
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0 cursor-pointer text-destructive hover:text-destructive"
								disabled={buttons.length <= 1}
								onClick={() => {
									const newBtns = buttons.filter((_: DialogButton, idx: number) => idx !== i);
									onUpdate({ ...step, buttons: newBtns } as ScriptStep);
								}}
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					))}
					{buttons.length < 4 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 text-xs w-full cursor-pointer"
							onClick={() =>
								onUpdate({
									...step,
									buttons: [...buttons, { text: '', value: '', variant: 'default' }],
								} as ScriptStep)
							}
						>
							{`+ ${t('automation:properties.addButton')}`}
						</Button>
					)}
				</div>
			</div>,
		);
		fields.push(nf('timeout_ms', t('automation:properties.timeoutMsZero')));
		fields.push(tf('on_timeout_value', t('automation:properties.timeoutDefaultValue')));
		fields.push(okf());
	} else if (kind === 'select_dialog') {
		fields.push(tf('title', t('common:title')));
		fields.push(tf('message', t('automation:properties.description'), true));
		// 动态选项列表编辑器
		const options = (s.options as string[] | undefined) ?? [];
		fields.push(
			<div key="options" className="space-y-1">
				<Label className="text-xs">{t('automation:properties.optionList')}</Label>
				<div className="space-y-1.5">
					{options.map((opt: string, i: number) => (
						<div key={opt || 'empty-option'} className="flex gap-1">
							<Input
								value={opt}
								onChange={(e) => {
									const newOpts = [...options];
									newOpts[i] = e.target.value;
									onUpdate({ ...step, options: newOpts } as ScriptStep);
								}}
								placeholder={t('automation:fields.option', { index: i + 1 })}
								className="h-7 text-xs flex-1"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0 cursor-pointer text-destructive hover:text-destructive"
								onClick={() => {
									const newOpts = options.filter((_: string, idx: number) => idx !== i);
									onUpdate({ ...step, options: newOpts } as ScriptStep);
								}}
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 text-xs w-full cursor-pointer"
						onClick={() => onUpdate({ ...step, options: [...options, ''] } as ScriptStep)}
					>
						{`+ ${t('automation:properties.addOption')}`}
					</Button>
				</div>
			</div>,
		);
		fields.push(
			<div key="multi_select" className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={Boolean(s.multi_select ?? false)}
					onChange={(e) => onUpdate({ ...step, multi_select: e.target.checked } as ScriptStep)}
					className="h-3.5 w-3.5 cursor-pointer"
				/>
				<Label className="text-xs">{t('automation:properties.allowMultiSelect')}</Label>
			</div>,
		);
		fields.push(nf('timeout_ms', t('automation:properties.timeoutMsZero')));
		fields.push(okf());
	} else if (kind === 'notification') {
		fields.push(tf('title', t('common:title')));
		fields.push(tf('body', t('common:body'), true));
		const level = String(s.level ?? 'info');
		fields.push(
			<div key="level" className="space-y-1">
				<Label className="text-xs">{t('common:level')}</Label>
				<Select value={level} onValueChange={(v) => onUpdate({ ...step, level: v } as ScriptStep)}>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="info" className="cursor-pointer">
							{t('automation:properties.levelInfo')}
						</SelectItem>
						<SelectItem value="success" className="cursor-pointer">
							{t('automation:properties.levelSuccess')}
						</SelectItem>
						<SelectItem value="warning" className="cursor-pointer">
							{t('automation:properties.levelWarning')}
						</SelectItem>
						<SelectItem value="error" className="cursor-pointer">
							{t('automation:properties.levelError')}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		fields.push(nf('duration_ms', t('automation:properties.durationMs')));
	} else if (kind === 'cdp_handle_dialog') {
		const action = String(s.action ?? 'accept');
		fields.push(
			<div key="action" className="space-y-1">
				<Label className="text-xs">{t('automation:action')}</Label>
				<Select
					value={action}
					onValueChange={(v) => onUpdate({ ...step, action: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs cursor-pointer">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="accept" className="cursor-pointer">
							{t('automation:actions.accept')} (Accept)
						</SelectItem>
						<SelectItem value="dismiss" className="cursor-pointer">
							{t('automation:actions.dismiss')} (Dismiss)
						</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		fields.push(tf('prompt_text', t('automation:fields.promptInputText')));
		fields.push(okf());
	} else if (
		kind === 'cdp_get_browser_version' ||
		kind === 'cdp_get_browser_command_line' ||
		kind === 'cdp_get_layout_metrics'
	) {
		fields.push(okf());
	} else if (kind === 'cdp_get_window_for_target') {
		fields.push(tf('target_id', t('automation:fields.targetIdOptional')));
		fields.push(okf());
	} else if (kind === 'cdp_get_document') {
		fields.push(nf('depth', t('automation:fields.depth')));
		fields.push(
			<div key="pierce" className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={Boolean(s.pierce)}
					className="cursor-pointer"
					onChange={(e) => onUpdate({ ...step, pierce: e.target.checked } as ScriptStep)}
				/>
				<Label className="text-xs">{t('automation:fields.pierceShadowDOM')}</Label>
			</div>,
		);
		fields.push(okf());
	} else if (kind === 'cdp_get_full_ax_tree') {
		fields.push(nf('depth', t('automation:fields.depthOptional')));
		fields.push(okf());
	}

	// ── 渲染 ──────────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* 标题栏 + 删除按钮 */}
			<div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0 bg-muted/30">
				<div className="flex items-center gap-1.5 min-w-0">
					<span className="text-xs font-bold truncate">{getKindLabel(kind)}</span>

					<span className="text-[9px] text-muted-foreground">
						{t('automation:properties.title')}
					</span>
				</div>
				<Button
					size="sm"
					variant="ghost"
					className="h-6 w-6 p-0 cursor-pointer text-destructive hover:text-destructive"
					onClick={onDelete}
					title={t('automation:properties.deleteStep')}
				>
					<Trash2 className="h-3 w-3" />
				</Button>
			</div>

			{/* 字段列表 */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="space-y-3 p-3">
					{fields.length > 0 ? (
						fields
					) : (
						<p className="text-xs text-muted-foreground">
							{t('automation:properties.noEditableFields')}
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
