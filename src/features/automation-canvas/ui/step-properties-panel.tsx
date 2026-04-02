/**
 * step-properties-panel.tsx
 * 步骤属性面板，显示在画布右侧。
 * 当用户选中一个步骤节点时，展示该步骤的可编辑字段。
 *
 * 当前版本：保留原 if/else 分支渲染逻辑（简化版），方便后续改造为 field-registry 驱动。
 * 变量插入功能：支持在文本输入框中通过 Popover 选择并插入 {{变量名}}。
 */

import React from 'react';

import {
	ChevronDown,
	FolderOpen,
	Trash2,
	Variable,
} from 'lucide-react';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

import type { ScriptStep, ScriptVarDef } from '@/entities/automation/model/types';
import { KIND_LABELS } from '@/entities/automation/model/step-registry';
import { Button } from '@/components/ui/button';
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

	// ── 计算可用变量（脚本级 + 前置步骤输出） ─────────────────────────────────
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

	/** 数字字段 */
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

	/** 选择器字段（CSS/XPath/Text 三种类型） */
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

	/** 输出变量名字段（带已有变量下拉选择） */
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

	/** output_key 字段快捷方式 */
	const okf = () => outputKeyField('output_key', '输出变量名');

	// ── 根据 kind 构建字段列表 ─────────────────────────────────────────────────
	const fields: React.ReactNode[] = [];

	if (kind === 'navigate' || kind === 'cdp_navigate') {
		fields.push(tf('url', 'URL'));
		fields.push(okf());
	} else if (kind === 'wait') {
		fields.push(nf('ms', '等待毫秒数'));
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
		fields.push(outputKeyField('output_key_file_path', '文件路径变量名'));
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
						placeholder="留空则自动保存到默认目录"
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
		fields.push(tf('url', 'URL'));
		fields.push(okf());
	} else if (kind === 'cdp_get_all_tabs') {
		fields.push(okf());
	} else if (kind === 'cdp_switch_tab') {
		fields.push(tf('target_id', 'Target ID（支持 {{变量}}）'));
	} else if (kind === 'cdp_close_tab') {
		fields.push(tf('target_id', 'Target ID（支持 {{变量}}）'));
	} else if (kind === 'cdp_go_back' || kind === 'cdp_go_forward') {
		fields.push(nf('steps', '步数'));
	} else if (kind === 'cdp_upload_file') {
		fields.push(sf());
		fields.push(tf('files.0', '文件路径（支持 {{变量}}）'));
	} else if (kind === 'cdp_download_file') {
		const dlPathValue = String(s['download_path'] ?? '');
		fields.push(
			<div key="download_path" className="space-y-1">
				<Label className="text-xs">下载目录</Label>
				<div className="flex gap-1">
					<Input
						value={dlPathValue}
						onChange={(e) =>
							onUpdate({ ...step, download_path: e.target.value } as ScriptStep)
						}
						placeholder="选择或输入下载目录"
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title="选择目录"
						onClick={async () => {
							const { open } = await import('@tauri-apps/plugin-dialog');
							const selected = await open({ directory: true });
							if (selected) {
								onUpdate({ ...step, download_path: selected as string } as ScriptStep);
							}
						}}
					>
						<FolderOpen className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>,
		);
	} else if (kind === 'cdp_clipboard') {
		const clipAction = String(s['action'] ?? 'copy');
		fields.push(
			<div key="action" className="space-y-1">
				<Label className="text-xs">操作</Label>
				<Select
					value={clipAction}
					onValueChange={(v) => onUpdate({ ...step, action: v } as ScriptStep)}
				>
					<SelectTrigger className="h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="copy">复制 (Copy)</SelectItem>
						<SelectItem value="paste">粘贴 (Paste)</SelectItem>
						<SelectItem value="select_all">全选 (Select All)</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
	} else if (kind === 'cdp_execute_js') {
		fields.push(tf('expression', 'JS 代码', true));
		const jsFilePath = String(s['file_path'] ?? '');
		fields.push(
			<div key="file_path" className="space-y-1">
				<Label className="text-xs">JS 文件路径（可选，优先于代码）</Label>
				<div className="flex gap-1">
					<Input
						value={jsFilePath}
						onChange={(e) =>
							onUpdate({ ...step, file_path: e.target.value } as ScriptStep)
						}
						placeholder="留空则使用上方代码"
						className="h-8 text-xs flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
						title="选择JS文件"
						onClick={async () => {
							const { open } = await import('@tauri-apps/plugin-dialog');
							const selected = await open({
								filters: [{ name: 'JS文件', extensions: ['js', 'mjs'] }],
							});
							if (selected) {
								onUpdate({ ...step, file_path: selected as string } as ScriptStep);
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
		const textSrc = String(s['text_source'] ?? 'inline');
		fields.push(
			<div key="text_source" className="space-y-1">
				<Label className="text-xs">文本来源</Label>
				<Select
					value={textSrc}
					onValueChange={(v) =>
						onUpdate({ ...step, text_source: v } as ScriptStep)
					}
				>
					<SelectTrigger className="h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="inline">直接输入</SelectItem>
						<SelectItem value="file">从文件读取</SelectItem>
						<SelectItem value="variable">从变量读取</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		if (textSrc === 'inline') {
			fields.push(tf('text', '输入文本', true));
		} else if (textSrc === 'file') {
			const filePath = String(s['file_path'] ?? '');
			fields.push(
				<div key="file_path" className="space-y-1">
					<Label className="text-xs">文本文件路径</Label>
					<div className="flex gap-1">
						<Input
							value={filePath}
							onChange={(e) =>
								onUpdate({ ...step, file_path: e.target.value } as ScriptStep)
							}
							placeholder="选择文本文件"
							className="h-8 text-xs flex-1"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
							title="选择文件"
							onClick={async () => {
								const { open } = await import('@tauri-apps/plugin-dialog');
								const selected = await open({
									filters: [
										{ name: '文本文件', extensions: ['txt', 'md', 'csv'] },
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
			fields.push(tf('var_name', '变量名（不含 {{}}）'));
		}
	} else if (kind === 'wait_for_user') {
		fields.push(tf('message', '提示消息', true));
		fields.push(tf('input_label', '输入框标签（留空则无输入框）'));
		fields.push(okf());
		fields.push(nf('timeout_ms', '超时毫秒数（0=不超时）'));
	} else if (kind === 'print') {
		fields.push(tf('text', '打印内容（支持 {{变量}}）', true));
		const lvl = String(s['level'] ?? 'info');
		fields.push(
			<div key="level" className="space-y-1">
				<Label className="text-xs">日志级别</Label>
				<Select
					value={lvl}
					onValueChange={(v) => onUpdate({ ...step, level: v } as ScriptStep)}
				>
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
	} else if (kind === 'magic_capture_app_shell') {
		fields.push(outputKeyField('output_key_file_path', '文件路径变量名'));
		const appShellPathValue = String(s['output_path'] ?? '');
		fields.push(
			<div key="output_path" className="space-y-1">
				<Label className="text-xs">保存路径</Label>
				<div className="flex gap-1">
					<Input
						value={appShellPathValue}
						onChange={(e) =>
							onUpdate({ ...step, output_path: e.target.value } as ScriptStep)
						}
						placeholder="留空则自动保存到默认目录"
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
								defaultPath: appShellPathValue || 'appshell.png',
								filters: [
									{ name: '图片文件', extensions: ['png', 'jpeg', 'jpg'] },
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
	}

	// ── 渲染 ──────────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* 标题栏 + 删除按钮 */}
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

			{/* 字段列表 */}
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
