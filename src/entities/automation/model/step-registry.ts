import type { ScriptStep } from './types';

// ─── Step kind 完整列表（来自 script-editor-dialog.tsx）────────────────────────

export type StepKindDef = {
	value: string;
	label: string;
	group: string;
};

export const STEP_KINDS: StepKindDef[] = [
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
	{ value: 'ai_agent', label: 'AI Agent 工具调用', group: 'AI' },
	// CDP 具名
	{ value: 'cdp_navigate', label: 'CDP 导航', group: 'CDP' },
	{ value: 'cdp_reload', label: 'CDP 刷新页面', group: 'CDP' },
	{ value: 'cdp_evaluate', label: 'CDP 执行JS', group: 'CDP' },
	{ value: 'cdp_click', label: 'CDP 点击', group: 'CDP' },
	{ value: 'cdp_type', label: 'CDP 输入', group: 'CDP' },
	{ value: 'cdp_scroll_to', label: 'CDP 滚动', group: 'CDP' },
	{ value: 'cdp_wait_for_selector', label: 'CDP 等待元素', group: 'CDP' },
	{ value: 'cdp_wait_for_page_load', label: 'CDP 等待页面加载', group: 'CDP' },
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

// ─── Canvas 使用的显示标签（中文简称）─────────────────────────────────────────
// 与原 automation-canvas-page.tsx 的 KIND_LABELS 完全一致

export const KIND_LABELS: Record<string, string> = {
	navigate: '导航', wait: '等待', evaluate: 'JS 求值', click: '点击',
	type: '输入', screenshot: '截图', magic: 'Magic', cdp: 'CDP 原始',
	wait_for_user: '等待人工', condition: '条件分支', loop: '循环',
	break: 'Break', continue: 'Continue',
	ai_prompt: 'AI Prompt', ai_extract: 'AI 提取', ai_agent: 'AI Agent',
	cdp_navigate: '导航', cdp_reload: '刷新', cdp_evaluate: 'JS 求值',
	cdp_click: '点击', cdp_type: '输入', cdp_scroll_to: '滚动',
	cdp_wait_for_selector: '等待元素', cdp_wait_for_page_load: '等待页面加载', cdp_get_text: '获取文本',
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

// ─── Canvas 使用的分组（与原 automation-canvas-page.tsx 完全一致）──────────────

export const KIND_GROUPS: Record<string, string> = {
	navigate: 'CDP', wait: '通用', evaluate: 'CDP', click: 'CDP',
	type: 'CDP', screenshot: 'CDP', magic: 'Magic', cdp: 'CDP',
	wait_for_user: '人工介入', condition: '控制流', loop: '控制流',
	break: '控制流', continue: '控制流',
	ai_prompt: 'AI', ai_extract: 'AI', ai_agent: 'AI',
	cdp_navigate: 'CDP', cdp_reload: 'CDP', cdp_evaluate: 'CDP',
	cdp_click: 'CDP', cdp_type: 'CDP', cdp_scroll_to: 'CDP',
	cdp_wait_for_selector: 'CDP', cdp_wait_for_page_load: 'CDP', cdp_get_text: 'CDP',
	cdp_get_attribute: 'CDP', cdp_set_input_value: 'CDP', cdp_screenshot: 'CDP',
	magic_set_bounds: 'Magic', magic_get_bounds: 'Magic',
	magic_set_maximized: 'Magic', magic_set_minimized: 'Magic',
	magic_set_closed: 'Magic', magic_set_restored: 'Magic',
	magic_set_fullscreen: 'Magic', magic_set_bg_color: 'Magic',
	magic_set_toolbar_text: 'Magic', magic_set_app_top_most: 'Magic',
	magic_set_master_indicator_visible: 'Magic',
	magic_open_new_tab: 'Magic', magic_close_tab: 'Magic',
	magic_activate_tab: 'Magic', magic_activate_tab_by_index: 'Magic',
	magic_close_inactive_tabs: 'Magic', magic_open_new_window: 'Magic',
	magic_type_string: 'Magic',
	magic_get_browsers: 'Magic', magic_get_active_browser: 'Magic',
	magic_get_tabs: 'Magic', magic_get_active_tabs: 'Magic',
	magic_get_switches: 'Magic', magic_get_host_name: 'Magic',
	magic_get_mac_address: 'Magic',
	magic_get_bookmarks: 'Magic', magic_create_bookmark: 'Magic',
	magic_create_bookmark_folder: 'Magic', magic_update_bookmark: 'Magic',
	magic_move_bookmark: 'Magic', magic_remove_bookmark: 'Magic',
	magic_bookmark_current_tab: 'Magic', magic_unbookmark_current_tab: 'Magic',
	magic_is_current_tab_bookmarked: 'Magic', magic_export_bookmark_state: 'Magic',
	magic_get_managed_cookies: 'Magic', magic_export_cookie_state: 'Magic',
	magic_get_managed_extensions: 'Magic', magic_trigger_extension_action: 'Magic',
	magic_close_extension_popup: 'Magic',
	magic_toggle_sync_mode: 'Magic', magic_get_sync_mode: 'Magic',
	magic_get_is_master: 'Magic', magic_get_sync_status: 'Magic',
	magic_capture_app_shell: 'Magic',
};

// ─── Canvas 组颜色 ────────────────────────────────────────────────────────────

export const GROUP_COLORS: Record<string, string> = {
	CDP: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
	Magic: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
	AI: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
	控制流: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
	人工介入: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
	通用: 'bg-muted border-border text-muted-foreground',
};

export const PALETTE_DOT_COLORS: Record<string, string> = {
	CDP: 'bg-blue-500',
	Magic: 'bg-purple-500',
	AI: 'bg-orange-500',
	控制流: 'bg-green-500',
	人工介入: 'bg-amber-500',
	通用: 'bg-muted-foreground/50',
};

// ─── Canvas 拖拽面板分组 ──────────────────────────────────────────────────────

export const PALETTE_GROUPS: { label: string; kinds: string[] }[] = [
	{
		label: 'CDP',
		kinds: ['cdp_navigate', 'cdp_reload', 'cdp_click', 'cdp_type', 'cdp_evaluate',
			'cdp_get_text', 'cdp_wait_for_selector', 'cdp_wait_for_page_load', 'cdp_scroll_to', 'cdp_screenshot'],
	},
	{ label: '通用', kinds: ['wait', 'wait_for_user'] },
	{ label: '控制流', kinds: ['condition', 'loop', 'break', 'continue'] },
	{ label: 'AI', kinds: ['ai_prompt', 'ai_extract', 'ai_agent'] },
	{
		label: 'Magic',
		kinds: ['magic_get_browsers', 'magic_open_new_tab', 'magic_close_tab',
			'magic_close_inactive_tabs', 'magic_activate_tab', 'magic_get_tabs', 'magic_set_bounds',
			'magic_get_bounds', 'magic_set_maximized', 'magic_set_minimized',
			'magic_capture_app_shell'],
	},
];

// ─── defaultStep 工厂（完整版，合并自两个文件）──────────────────────────────────

export function defaultStep(kind: string): ScriptStep {
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
		case 'ai_prompt': return { kind: 'ai_prompt', prompt: '' };
		case 'ai_extract': return { kind: 'ai_extract', prompt: '', output_key_map: [{ jsonPath: '', varName: '' }] };
		case 'ai_agent': return { kind: 'ai_agent', system_prompt: '', initial_message: '', max_steps: 10 };
		case 'cdp_navigate': return { kind: 'cdp_navigate', url: 'https://' };
		case 'cdp_reload': return { kind: 'cdp_reload', ignore_cache: false };
		case 'cdp_evaluate': return { kind: 'cdp_evaluate', expression: '' };
		case 'cdp_click': return { kind: 'cdp_click', selector: '' };
		case 'cdp_type': return { kind: 'cdp_type', selector: '', text: '' };
		case 'cdp_scroll_to': return { kind: 'cdp_scroll_to' };
		case 'cdp_wait_for_selector': return { kind: 'cdp_wait_for_selector', selector: '' };
		case 'cdp_wait_for_page_load': return { kind: 'cdp_wait_for_page_load', timeout_ms: 30000 };
		case 'cdp_get_text': return { kind: 'cdp_get_text', selector: '' };
		case 'cdp_get_attribute': return { kind: 'cdp_get_attribute', selector: '', attribute: '' };
		case 'cdp_set_input_value': return { kind: 'cdp_set_input_value', selector: '', value: '' };
		case 'cdp_screenshot': return { kind: 'cdp_screenshot', output_path: '' };
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
		case 'magic_capture_app_shell': return { kind: 'magic_capture_app_shell' };
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

// ─── step 摘要文本（供 canvas 节点使用）─────────────────────────────────────────

export function getStepSummaryText(step: ScriptStep): string {
	const s = step as Record<string, unknown>;
	if (step.kind === 'cdp_wait_for_page_load') return `超时 ${String((s['timeout_ms'] ?? 30000))}ms`;
	if (s['url']) return String(s['url']).slice(0, 40);
	if (s['prompt']) return String(s['prompt']).slice(0, 40);
	if (s['expression']) return String(s['expression']).slice(0, 40);
	if (s['selector']) return String(s['selector']).slice(0, 40);
	if (s['message']) return String(s['message']).slice(0, 40);
	if (s['ms'] !== undefined) return `${String(s['ms'])}ms`;
	if (s['initial_message']) return String(s['initial_message']).slice(0, 40);
	return '';
}
