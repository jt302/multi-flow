import i18next from 'i18next';

/**
 * 步骤字段注册表
 *
 * 将 StepPropertiesPanel 中的 if/else 链转换为数据驱动的配置，
 * 供 canvas 属性面板和未来的表单生成器使用。
 *
 * 对于复杂/特殊渲染的步骤（condition、loop、ai_agent、wait_for_user、
 * magic_* 复合步骤、cdp_execute_js 等），使用空数组 [] 或仅包含
 * 可以用标准字段类型表示的字段。
 */

// ─── 字段描述符类型 ───────────────────────────────────────────────────────────

export type FieldDescriptor =
	/** 文本输入，multiline=true 时渲染为 Textarea */
	| { type: 'text'; key: string; label: string; multiline?: boolean }
	/** 数字输入 */
	| { type: 'number'; key: string; label: string; min?: number; step?: number }
	/** CSS/XPath/Text 三合一选择器 */
	| { type: 'selector'; label?: string; optional?: boolean }
	/** 输出变量名（带变量选择下拉） */
	| { type: 'output_key'; key?: string; label?: string }
	/** 下拉选择 */
	| {
			type: 'select';
			key: string;
			label: string;
			options: { value: string; label: string }[];
	  }
	/** 文件路径（带系统文件对话框按钮） */
	| {
			type: 'file_path';
			key: string;
			label: string;
			mode: 'save' | 'open' | 'directory';
			filters?: { name: string; extensions: string[] }[];
	  }
	/** 复选框 */
	| { type: 'checkbox'; key: string; label: string }
	/**
	 * 条件渲染：监视 watchKey 的值，根据值渲染对应字段组
	 * 用于 cdp_input_text 的 text_source 切换
	 */
	| {
			type: 'conditional';
			watchKey: string;
			conditions: Record<string, FieldDescriptor[]>;
	  };

// ─── 注册表 ───────────────────────────────────────────────────────────────────

/**
 * 将 step.kind 映射到其字段描述符数组。
 *
 * 规则：
 * - 空数组 `[]` = 此步骤无可编辑的标准字段（或字段过于复杂，由面板直接渲染）
 * - 未在此注册表中的 kind 应视为无字段
 */
export const STEP_FIELD_REGISTRY: Record<string, FieldDescriptor[]> = {
	// ── 导航 ──────────────────────────────────────────────────────────────────
	navigate: [{ type: 'text', key: 'url', label: 'URL' }, { type: 'output_key' }],

	// ── 等待 ──────────────────────────────────────────────────────────────────
	wait: [{ type: 'number', key: 'ms', label: i18next.t('automation:fields.waitMs') }],

	// ── 点击 ──────────────────────────────────────────────────────────────────
	click: [{ type: 'selector' }],

	// ── 输入文本 ──────────────────────────────────────────────────────────────
	type: [
		{ type: 'selector' },
		{ type: 'text', key: 'text', label: i18next.t('automation:fields.inputText'), multiline: true },
	],

	// ── 截图（Magic Controller） ──────────────────────────────────────────────
	screenshot: [
		{
			type: 'file_path',
			key: 'save_path',
			label: i18next.t('automation:fields.savePath'),
			mode: 'save',
			filters: [{ name: i18next.t('automation:fields.filterImage'), extensions: ['png'] }],
		},
		{ type: 'output_key', label: i18next.t('automation:fields.filePathVar') },
	],

	// ── 通用 Magic / CDP 命令（复杂结构，不提供标准字段） ──────────────────────
	magic: [],
	cdp: [],

	// ── 等待用户操作（含输入框、超时配置） ───────────────────────────────────
	// 字段较多且有条件逻辑，保留在面板直接渲染，此处记录标准部分
	wait_for_user: [
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.promptMessage'),
			multiline: true,
		},
		{ type: 'text', key: 'input_label', label: i18next.t('automation:fields.inputLabel') },
		{ type: 'output_key' },
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
	],

	// ── 条件分支（then/else 子步骤由 canvas 特殊渲染） ───────────────────────
	condition: [
		{ type: 'text', key: 'condition_expr', label: i18next.t('automation:fields.conditionExpr') },
	],

	// ── 循环（body_steps 由 canvas 特殊渲染） ─────────────────────────────────
	loop: [
		{ type: 'number', key: 'count', label: i18next.t('automation:fields.loopCount') },
		{ type: 'text', key: 'iter_var', label: i18next.t('automation:fields.iterVar') },
	],

	// ── 流程控制（无字段） ─────────────────────────────────────────────────────
	break: [],
	continue: [],
	end: [{ type: 'text', key: 'message', label: i18next.t('automation:fields.endMessage') }],
	// ── 打印日志 ──────────────────────────────────────────────────────────────
	print: [
		{
			type: 'text',
			key: 'text',
			label: i18next.t('automation:fields.printContent'),
			multiline: true,
		},
		{
			type: 'select',
			key: 'level',
			label: i18next.t('automation:fields.logLevel'),
			options: [
				{ value: 'info', label: 'info' },
				{ value: 'warn', label: 'warn' },
				{ value: 'error', label: 'error' },
				{ value: 'debug', label: 'debug' },
			],
		},
	],

	// ── AI 步骤 ───────────────────────────────────────────────────────────────
	ai_agent: [
		{
			type: 'text',
			key: 'prompt',
			label: i18next.t('automation:fields.aiPrompt'),
			multiline: true,
		},
		{
			type: 'text',
			key: 'system_prompt',
			label: i18next.t('automation:fields.systemPrompt'),
			multiline: true,
		},
		{
			type: 'select',
			key: 'output_format',
			label: i18next.t('automation:fields.outputFormat'),
			options: [
				{ value: 'text', label: i18next.t('automation:fields.outputFormatText') },
				{ value: 'json', label: i18next.t('automation:fields.outputFormatJson') },
			],
		},
		// output_key_map 是复杂数组结构，由面板直接渲染
		{
			type: 'number',
			key: 'max_steps',
			label: i18next.t('automation:fields.maxIterations'),
			min: 1,
		},
		{ type: 'output_key' },
	],

	ai_judge: [
		{
			type: 'text',
			key: 'prompt',
			label: i18next.t('automation:fields.aiJudgePrompt'),
			multiline: true,
		},
		// output_mode 由面板直接渲染 Select 组件
		{
			type: 'number',
			key: 'max_steps',
			label: i18next.t('automation:fields.maxIterations'),
			min: 1,
		},
		{ type: 'output_key' },
	],

	// ── CDP 具名步骤 ──────────────────────────────────────────────────────────
	cdp_navigate: [{ type: 'text', key: 'url', label: 'URL' }, { type: 'output_key' }],

	cdp_reload: [
		{ type: 'checkbox', key: 'ignore_cache', label: i18next.t('automation:fields.ignoreCache') },
	],

	cdp_click: [{ type: 'selector' }],

	cdp_type: [
		{ type: 'selector' },
		{ type: 'text', key: 'text', label: i18next.t('automation:fields.inputText'), multiline: true },
	],

	cdp_scroll_to: [
		{ type: 'selector', label: i18next.t('automation:fields.selectorOptional'), optional: true },
	],

	cdp_wait_for_selector: [
		{ type: 'selector' },
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
	],

	cdp_wait_for_page_load: [
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
	],

	cdp_get_text: [{ type: 'selector' }, { type: 'output_key' }],

	cdp_get_attribute: [
		{ type: 'selector' },
		{ type: 'text', key: 'attribute', label: i18next.t('automation:fields.attributeName') },
		{ type: 'output_key' },
	],

	cdp_set_input_value: [
		{ type: 'selector' },
		{ type: 'text', key: 'value', label: i18next.t('automation:fields.value') },
	],

	cdp_screenshot: [
		{
			type: 'output_key',
			key: 'output_key_file_path',
			label: i18next.t('automation:fields.filePathVar'),
		},
		{
			type: 'file_path',
			key: 'output_path',
			label: i18next.t('automation:fields.savePath'),
			mode: 'save',
			filters: [
				{ name: i18next.t('automation:fields.filterImage'), extensions: ['png', 'jpeg', 'jpg'] },
			],
		},
	],

	cdp_open_new_tab: [{ type: 'text', key: 'url', label: 'URL' }, { type: 'output_key' }],

	cdp_get_all_tabs: [{ type: 'output_key' }],

	cdp_switch_tab: [
		{ type: 'text', key: 'target_id', label: i18next.t('automation:fields.targetId') },
	],

	cdp_close_tab: [
		{ type: 'text', key: 'target_id', label: i18next.t('automation:fields.targetId') },
	],

	cdp_go_back: [{ type: 'number', key: 'steps', label: i18next.t('automation:fields.steps') }],

	cdp_go_forward: [{ type: 'number', key: 'steps', label: i18next.t('automation:fields.steps') }],

	cdp_upload_file: [
		{ type: 'selector' },
		{ type: 'text', key: 'files.0', label: i18next.t('automation:fields.filePath') },
	],

	cdp_download_file: [
		{
			type: 'file_path',
			key: 'download_path',
			label: i18next.t('automation:fields.downloadDirectory'),
			mode: 'directory',
		},
	],

	cdp_clipboard: [
		{
			type: 'select',
			key: 'action',
			label: i18next.t('automation:fields.action'),
			options: [
				{ value: 'copy', label: i18next.t('automation:fields.actionCopy') },
				{ value: 'paste', label: i18next.t('automation:fields.actionPaste') },
				{ value: 'select_all', label: i18next.t('automation:fields.actionSelectAll') },
			],
		},
	],

	// cdp_execute_js: 含文件路径对话框和 JS 代码多行输入，field 混合，保留部分
	cdp_execute_js: [
		{
			type: 'text',
			key: 'expression',
			label: i18next.t('automation:fields.jsCode'),
			multiline: true,
		},
		{
			type: 'file_path',
			key: 'file_path',
			label: i18next.t('automation:fields.jsFilePath'),
			mode: 'open',
			filters: [{ name: i18next.t('automation:fields.filterJs'), extensions: ['js', 'mjs'] }],
		},
		{ type: 'output_key' },
	],

	// cdp_input_text: text_source 决定后续字段，使用 conditional 类型
	cdp_input_text: [
		{ type: 'selector' },
		{
			type: 'select',
			key: 'text_source',
			label: i18next.t('automation:fields.textSource'),
			options: [
				{ value: 'inline', label: i18next.t('automation:fields.textSourceInline') },
				{ value: 'file', label: i18next.t('automation:fields.textSourceFile') },
				{ value: 'variable', label: i18next.t('automation:fields.textSourceVariable') },
			],
		},
		{
			type: 'conditional',
			watchKey: 'text_source',
			conditions: {
				inline: [
					{
						type: 'text',
						key: 'text',
						label: i18next.t('automation:fields.inputText'),
						multiline: true,
					},
				],
				file: [
					{
						type: 'file_path',
						key: 'file_path',
						label: i18next.t('automation:fields.textFilePath'),
						mode: 'open',
						filters: [
							{ name: i18next.t('automation:fields.filterText'), extensions: ['txt', 'md', 'csv'] },
						],
					},
				],
				variable: [
					{ type: 'text', key: 'var_name', label: i18next.t('automation:fields.varName') },
				],
			},
		},
	],

	cdp_press_key: [
		{
			type: 'select',
			key: 'key',
			label: i18next.t('automation:fields.key'),
			options: [
				{ value: 'Enter', label: 'Enter' },
				{ value: 'Tab', label: 'Tab' },
				{ value: 'Escape', label: 'Escape' },
				{ value: 'Backspace', label: 'Backspace' },
				{ value: 'Delete', label: 'Delete' },
				{ value: 'Space', label: 'Space' },
				{ value: 'ArrowUp', label: 'ArrowUp' },
				{ value: 'ArrowDown', label: 'ArrowDown' },
				{ value: 'ArrowLeft', label: 'ArrowLeft' },
				{ value: 'ArrowRight', label: 'ArrowRight' },
				{ value: 'Home', label: 'Home' },
				{ value: 'End', label: 'End' },
				{ value: 'PageUp', label: 'PageUp' },
				{ value: 'PageDown', label: 'PageDown' },
			],
		},
	],

	// cdp_shortcut: modifiers 用 checkbox 渲染，属性面板自定义处理
	cdp_shortcut: [],

	// ── 弹窗 / 通知步骤 ───────────────────────────────────────────────────────

	confirm_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.promptMessage'),
			multiline: true,
		},
		// buttons 由属性面板内联编辑器处理
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
		{ type: 'text', key: 'on_timeout_value', label: i18next.t('automation:fields.timeoutDefault') },
		{ type: 'output_key' },
	],

	select_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.description'),
			multiline: true,
		},
		{
			type: 'checkbox',
			key: 'multi_select',
			label: i18next.t('automation:fields.allowMultiSelect'),
		},
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
		{ type: 'output_key' },
		// options 数组由属性面板自定义渲染
	],

	form_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.description'),
			multiline: true,
		},
		{ type: 'text', key: 'submit_label', label: i18next.t('automation:fields.submitLabel') },
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
		{ type: 'output_key' },
		// fields ���组由属性面板自定义渲染
	],

	table_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.description'),
			multiline: true,
		},
		{ type: 'checkbox', key: 'selectable', label: i18next.t('automation:fields.selectable') },
		{
			type: 'checkbox',
			key: 'multi_select',
			label: i18next.t('automation:fields.allowMultiSelect'),
		},
		{ type: 'number', key: 'max_height', label: i18next.t('automation:fields.maxHeight') },
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
		{ type: 'output_key' },
		// columns, rows 由属性面板自定义渲染
	],

	image_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.description'),
			multiline: true,
		},
		{ type: 'text', key: 'image', label: i18next.t('automation:fields.imageData') },
		{
			type: 'select',
			key: 'image_format',
			label: i18next.t('automation:fields.imageFormat'),
			options: [
				{ value: 'png', label: 'PNG' },
				{ value: 'jpeg', label: 'JPEG' },
				{ value: 'webp', label: 'WebP' },
				{ value: 'gif', label: 'GIF' },
			],
		},
		{ type: 'text', key: 'input_label', label: i18next.t('automation:fields.inputLabel') },
		{ type: 'text', key: 'input_placeholder', label: i18next.t('automation:fields.placeholder') },
		{ type: 'number', key: 'timeout_ms', label: i18next.t('automation:fields.timeoutMs') },
		{ type: 'output_key' },
	],

	countdown_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'message',
			label: i18next.t('automation:fields.promptMessage'),
			multiline: true,
		},
		{ type: 'number', key: 'seconds', label: i18next.t('automation:fields.countdownSeconds') },
		{
			type: 'select',
			key: 'level',
			label: i18next.t('automation:fields.level'),
			options: [
				{ value: 'info', label: 'info' },
				{ value: 'warning', label: 'warning' },
				{ value: 'danger', label: 'danger' },
			],
		},
		{ type: 'text', key: 'action_label', label: i18next.t('automation:fields.actionLabel') },
		{ type: 'checkbox', key: 'auto_proceed', label: i18next.t('automation:fields.autoProceed') },
		{ type: 'output_key' },
	],

	markdown_dialog: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{
			type: 'text',
			key: 'content',
			label: i18next.t('automation:fields.content'),
			multiline: true,
		},
		{ type: 'number', key: 'max_height', label: i18next.t('automation:fields.maxHeight') },
		{
			type: 'select',
			key: 'width',
			label: i18next.t('automation:fields.width'),
			options: [
				{ value: 'sm', label: 'sm' },
				{ value: 'md', label: 'md' },
				{ value: 'lg', label: 'lg' },
				{ value: 'xl', label: 'xl' },
			],
		},
		{ type: 'checkbox', key: 'copyable', label: i18next.t('automation:fields.copyable') },
		{ type: 'output_key' },
	],

	notification: [
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{ type: 'text', key: 'body', label: i18next.t('automation:fields.content'), multiline: true },
		{
			type: 'select',
			key: 'level',
			label: i18next.t('automation:fields.level'),
			options: [
				{ value: 'info', label: 'info' },
				{ value: 'success', label: 'success' },
				{ value: 'warning', label: 'warning' },
				{ value: 'error', label: 'error' },
			],
		},
		{ type: 'number', key: 'duration_ms', label: i18next.t('automation:fields.durationMs') },
	],

	cdp_handle_dialog: [
		{
			type: 'select',
			key: 'action',
			label: i18next.t('automation:fields.action'),
			options: [
				{ value: 'accept', label: i18next.t('automation:fields.dialogAccept') },
				{ value: 'dismiss', label: i18next.t('automation:fields.dialogDismiss') },
			],
		},
		{ type: 'text', key: 'prompt_text', label: i18next.t('automation:fields.promptInputText') },
		{ type: 'output_key' },
	],

	// ── CDP 信息查询步骤 ───────────────────────────────────────────────────────────
	cdp_get_browser_version: [{ type: 'output_key' }],
	cdp_get_browser_command_line: [{ type: 'output_key' }],
	cdp_get_window_for_target: [
		{ type: 'text', key: 'target_id', label: i18next.t('automation:fields.targetIdOptional') },
		{ type: 'output_key' },
	],
	cdp_get_layout_metrics: [{ type: 'output_key' }],
	cdp_get_document: [
		{ type: 'number', key: 'depth', label: i18next.t('automation:fields.depth') },
		{ type: 'checkbox', key: 'pierce', label: i18next.t('automation:fields.pierceShadowDom') },
		{ type: 'output_key' },
	],
	cdp_get_full_ax_tree: [
		{ type: 'number', key: 'depth', label: i18next.t('automation:fields.depthOptional') },
		{ type: 'output_key' },
	],

	// ── Magic Controller 具名步骤 ─────────────────────────────────────────────

	// 窗口外观
	magic_set_bounds: [
		{ type: 'number', key: 'x', label: 'X' },
		{ type: 'number', key: 'y', label: 'Y' },
		{ type: 'number', key: 'width', label: i18next.t('automation:fields.width') },
		{ type: 'number', key: 'height', label: i18next.t('automation:fields.height') },
	],

	magic_get_bounds: [{ type: 'output_key' }],

	magic_set_maximized: [],
	magic_set_minimized: [],
	magic_set_closed: [],
	magic_safe_quit: [],
	magic_set_restored: [],
	magic_set_fullscreen: [],

	magic_set_bg_color: [
		{ type: 'number', key: 'r', label: i18next.t('automation:fields.r'), min: 0 },
		{ type: 'number', key: 'g', label: i18next.t('automation:fields.g'), min: 0 },
		{ type: 'number', key: 'b', label: i18next.t('automation:fields.b'), min: 0 },
	],

	magic_set_toolbar_text: [
		{ type: 'text', key: 'text', label: i18next.t('automation:fields.toolbarText') },
	],

	magic_set_app_top_most: [],

	magic_set_master_indicator_visible: [
		{ type: 'checkbox', key: 'visible', label: i18next.t('automation:fields.isVisible') },
		{ type: 'text', key: 'label', label: i18next.t('automation:fields.labelText') },
	],

	// 标签页与窗口操作
	magic_open_new_tab: [{ type: 'text', key: 'url', label: 'URL' }, { type: 'output_key' }],

	magic_close_tab: [{ type: 'number', key: 'tab_id', label: 'Tab ID' }],

	magic_activate_tab: [{ type: 'number', key: 'tab_id', label: 'Tab ID' }],

	magic_activate_tab_by_index: [
		{ type: 'number', key: 'index', label: i18next.t('automation:fields.tabIndex') },
	],

	magic_close_inactive_tabs: [],

	magic_open_new_window: [{ type: 'output_key' }],

	magic_type_string: [
		{ type: 'text', key: 'text', label: i18next.t('automation:fields.inputTextWithVar') },
	],

	// 浏览器信息查询
	magic_get_browsers: [{ type: 'output_key' }],

	magic_get_active_browser: [{ type: 'output_key' }],

	magic_get_tabs: [
		{ type: 'number', key: 'browser_id', label: i18next.t('automation:fields.browserId') },
		{ type: 'output_key' },
	],

	magic_get_active_tabs: [{ type: 'output_key' }],

	magic_get_switches: [{ type: 'text', key: 'key', label: 'Switch Key' }, { type: 'output_key' }],

	magic_get_host_name: [{ type: 'output_key' }],

	magic_get_mac_address: [{ type: 'output_key' }],

	// 书签
	magic_get_bookmarks: [{ type: 'output_key' }],

	magic_create_bookmark: [
		{ type: 'text', key: 'parent_id', label: i18next.t('automation:fields.parentNodeId') },
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.title') },
		{ type: 'text', key: 'url', label: 'URL' },
		{ type: 'output_key' },
	],

	magic_create_bookmark_folder: [
		{ type: 'text', key: 'parent_id', label: i18next.t('automation:fields.parentNodeId') },
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.folderName') },
		{ type: 'output_key' },
	],

	magic_update_bookmark: [
		{ type: 'text', key: 'node_id', label: i18next.t('automation:fields.nodeId') },
		{ type: 'text', key: 'title', label: i18next.t('automation:fields.newTitle') },
		{ type: 'text', key: 'url', label: i18next.t('automation:fields.newUrl') },
	],

	magic_move_bookmark: [
		{ type: 'text', key: 'node_id', label: i18next.t('automation:fields.nodeId') },
		{ type: 'text', key: 'new_parent_id', label: i18next.t('automation:fields.newParentId') },
	],

	magic_remove_bookmark: [
		{ type: 'text', key: 'node_id', label: i18next.t('automation:fields.nodeId') },
	],

	magic_bookmark_current_tab: [],
	magic_unbookmark_current_tab: [],

	magic_is_current_tab_bookmarked: [{ type: 'output_key' }],

	magic_export_bookmark_state: [{ type: 'output_key' }],

	// Cookie
	magic_get_managed_cookies: [{ type: 'output_key' }],

	magic_export_cookie_state: [
		{
			type: 'select',
			key: 'mode',
			label: i18next.t('automation:fields.exportMode'),
			options: [
				{ value: 'all', label: i18next.t('automation:fields.exportModeAll') },
				{ value: 'url', label: i18next.t('automation:fields.exportModeUrl') },
			],
		},
		{ type: 'text', key: 'url', label: i18next.t('automation:fields.urlForMode') },
		{ type: 'output_key' },
	],

	// 扩展
	magic_get_managed_extensions: [{ type: 'output_key' }],

	magic_trigger_extension_action: [
		{ type: 'text', key: 'extension_id', label: i18next.t('automation:fields.extensionId') },
	],

	magic_close_extension_popup: [],

	// 同步模式
	magic_toggle_sync_mode: [
		{ type: 'text', key: 'role', label: i18next.t('automation:fields.role') },
		{ type: 'output_key' },
	],

	magic_get_sync_mode: [{ type: 'output_key' }],

	magic_get_is_master: [{ type: 'output_key' }],

	magic_get_sync_status: [{ type: 'output_key' }],

	// 截图（app 壳）
	magic_capture_app_shell: [
		{
			type: 'output_key',
			key: 'output_key_file_path',
			label: i18next.t('automation:fields.filePathVar'),
		},
		{
			type: 'file_path',
			key: 'output_path',
			label: i18next.t('automation:fields.savePath'),
			mode: 'save',
			filters: [
				{ name: i18next.t('automation:fields.filterImage'), extensions: ['png', 'jpeg', 'jpg'] },
			],
		},
	],

	// AI Agent 语义化操作
	magic_get_browser: [
		{ type: 'text', key: 'browser_id', label: 'Browser ID' },
		{ type: 'output_key' },
	],

	magic_click_at: [
		{ type: 'text', key: 'grid', label: 'Grid (W,H)' },
		{ type: 'text', key: 'position', label: 'Position (X,Y)' },
		{
			type: 'select',
			key: 'button',
			label: 'Button',
			options: [
				{ value: 'left', label: 'Left' },
				{ value: 'right', label: 'Right' },
				{ value: 'middle', label: 'Middle' },
			],
		},
		{ type: 'text', key: 'click_count', label: 'Click Count' },
		{
			type: 'select',
			key: 'action',
			label: 'Action',
			options: [
				{ value: 'click', label: 'Click' },
				{ value: 'down', label: 'Down' },
				{ value: 'up', label: 'Up' },
				{ value: 'move', label: 'Move' },
			],
		},
		{ type: 'text', key: 'browser_id', label: 'Browser ID' },
		{ type: 'output_key' },
	],

	magic_click_element: [
		{ type: 'text', key: 'target', label: 'Target' },
		{ type: 'text', key: 'browser_id', label: 'Browser ID' },
		{ type: 'output_key' },
	],

	magic_get_ui_elements: [
		{ type: 'text', key: 'browser_id', label: 'Browser ID' },
		{ type: 'output_key' },
	],

	magic_navigate_to: [
		{ type: 'text', key: 'url', label: 'URL' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],

	magic_query_dom: [
		{
			type: 'select',
			key: 'by',
			label: 'By',
			options: ['css', 'xpath', 'text', 'aria', 'role', 'placeholder', 'name', 'search', 'idx'].map(
				(v) => ({ value: v, label: v }),
			),
		},
		{ type: 'text', key: 'selector', label: 'Selector' },
		{
			type: 'select',
			key: 'match',
			label: 'Match',
			options: ['contains', 'icontains', 'exact', 'regex', 'starts_with', 'ends_with'].map((v) => ({
				value: v,
				label: v,
			})),
		},
		{ type: 'text', key: 'limit', label: 'Limit' },
		{ type: 'checkbox', key: 'visible_only', label: 'Visible Only' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],

	magic_click_dom: [
		{
			type: 'select',
			key: 'by',
			label: 'By',
			options: ['css', 'xpath', 'text', 'aria', 'role', 'placeholder', 'name', 'search', 'idx'].map(
				(v) => ({ value: v, label: v }),
			),
		},
		{ type: 'text', key: 'selector', label: 'Selector' },
		{
			type: 'select',
			key: 'match',
			label: 'Match',
			options: ['contains', 'icontains', 'exact', 'regex', 'starts_with', 'ends_with'].map((v) => ({
				value: v,
				label: v,
			})),
		},
		{ type: 'text', key: 'index', label: 'Index' },
		{ type: 'checkbox', key: 'visible_only', label: 'Visible Only' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],

	magic_fill_dom: [
		{
			type: 'select',
			key: 'by',
			label: 'By',
			options: ['css', 'xpath', 'text', 'aria', 'role', 'placeholder', 'name', 'search', 'idx'].map(
				(v) => ({ value: v, label: v }),
			),
		},
		{ type: 'text', key: 'selector', label: 'Selector' },
		{ type: 'text', key: 'value', label: 'Value' },
		{
			type: 'select',
			key: 'match',
			label: 'Match',
			options: ['contains', 'icontains', 'exact', 'regex', 'starts_with', 'ends_with'].map((v) => ({
				value: v,
				label: v,
			})),
		},
		{ type: 'text', key: 'index', label: 'Index' },
		{ type: 'checkbox', key: 'clear', label: 'Clear Before Fill' },
		{ type: 'checkbox', key: 'visible_only', label: 'Visible Only' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],

	magic_send_keys: [{ type: 'text', key: 'tab_id', label: 'Tab ID' }, { type: 'output_key' }],

	magic_get_page_info: [{ type: 'text', key: 'tab_id', label: 'Tab ID' }, { type: 'output_key' }],

	magic_scroll: [
		{
			type: 'select',
			key: 'direction',
			label: 'Direction',
			options: ['up', 'down', 'left', 'right'].map((v) => ({ value: v, label: v })),
		},
		{ type: 'text', key: 'distance', label: 'Distance (px)' },
		{
			type: 'select',
			key: 'by',
			label: 'By (scroll to element)',
			options: ['css', 'xpath', 'text', 'aria', 'role', 'placeholder', 'name', 'search', 'idx'].map(
				(v) => ({ value: v, label: v }),
			),
		},
		{ type: 'text', key: 'selector', label: 'Selector' },
		{ type: 'text', key: 'index', label: 'Index' },
		{ type: 'checkbox', key: 'visible_only', label: 'Visible Only' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],

	magic_set_dock_icon_text: [
		{ type: 'text', key: 'text', label: 'Text' },
		{ type: 'text', key: 'color', label: 'Color (#RRGGBB)' },
		{ type: 'output_key' },
	],

	magic_get_page_content: [
		{
			type: 'select',
			key: 'mode',
			label: 'Mode',
			options: ['summary', 'interactive', 'content', 'a11y', 'full'].map((v) => ({
				value: v,
				label: v,
			})),
		},
		{
			type: 'select',
			key: 'format',
			label: 'Format',
			options: [
				{ value: 'json', label: 'JSON' },
				{ value: 'text', label: 'Text' },
			],
		},
		{ type: 'text', key: 'max_elements', label: 'Max Elements' },
		{ type: 'text', key: 'max_text_length', label: 'Max Text Length' },
		{ type: 'text', key: 'max_depth', label: 'Max Depth' },
		{ type: 'checkbox', key: 'viewport_only', label: 'Viewport Only' },
		{ type: 'checkbox', key: 'include_hidden', label: 'Include Hidden' },
		{ type: 'text', key: 'tab_id', label: 'Tab ID' },
		{ type: 'output_key' },
	],
};
