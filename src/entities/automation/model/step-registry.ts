import i18next from 'i18next';

import type { ScriptStep } from './types';

// ─── Step kind 完整列表（来自 script-editor-dialog.tsx）────────────────────────

export type StepKindDef = {
	value: string;
	label: string;
	group: string;
};

/** 获取分组的本地化名称 */
export function getGroupLabel(groupKey: string): string {
	const key = `automation:stepGroups.${groupKey}`;
	const translated = i18next.t(key);
	// i18next 找不到 key 时返回 key 本身，此时回退到 key 作为显示
	return translated !== key ? translated : groupKey;
}

export const STEP_KINDS: StepKindDef[] = [
	// 基础
	{ value: 'navigate', label: 'navigate', group: 'basic' },
	{ value: 'wait', label: 'wait', group: 'basic' },
	{ value: 'click', label: 'click', group: 'basic' },
	{ value: 'type', label: 'type', group: 'basic' },
	{ value: 'screenshot', label: 'screenshot', group: 'basic' },
	{ value: 'magic', label: 'magic', group: 'basic' },
	{ value: 'cdp', label: 'cdp', group: 'basic' },
	// 控制流
	{ value: 'wait_for_user', label: 'wait_for_user', group: 'controlFlow' },
	{ value: 'condition', label: 'condition', group: 'controlFlow' },
	{ value: 'loop', label: 'loop', group: 'controlFlow' },
	{ value: 'break', label: 'break', group: 'controlFlow' },
	{ value: 'continue', label: 'continue', group: 'controlFlow' },
	{ value: 'end', label: 'end', group: 'controlFlow' },
	{ value: 'print', label: 'print', group: 'debug' },
	// AI 步骤
	{ value: 'ai_agent', label: 'ai_agent', group: 'ai' },
	{ value: 'ai_judge', label: 'ai_judge', group: 'ai' },
	// CDP 具名
	{ value: 'cdp_navigate', label: 'cdp_navigate', group: 'cdp' },
	{ value: 'cdp_reload', label: 'cdp_reload', group: 'cdp' },
	{ value: 'cdp_click', label: 'cdp_click', group: 'cdp' },
	{ value: 'cdp_type', label: 'cdp_type', group: 'cdp' },
	{ value: 'cdp_scroll_to', label: 'cdp_scroll_to', group: 'cdp' },
	{ value: 'cdp_wait_for_selector', label: 'cdp_wait_for_selector', group: 'cdp' },
	{ value: 'cdp_wait_for_page_load', label: 'cdp_wait_for_page_load', group: 'cdp' },
	{ value: 'cdp_get_text', label: 'cdp_get_text', group: 'cdp' },
	{ value: 'cdp_get_attribute', label: 'cdp_get_attribute', group: 'cdp' },
	{ value: 'cdp_set_input_value', label: 'cdp_set_input_value', group: 'cdp' },
	{ value: 'cdp_screenshot', label: 'cdp_screenshot', group: 'cdp' },
	{ value: 'cdp_open_new_tab', label: 'cdp_open_new_tab', group: 'cdp' },
	{ value: 'cdp_get_all_tabs', label: 'cdp_get_all_tabs', group: 'cdp' },
	{ value: 'cdp_switch_tab', label: 'cdp_switch_tab', group: 'cdp' },
	{ value: 'cdp_close_tab', label: 'cdp_close_tab', group: 'cdp' },
	{ value: 'cdp_go_back', label: 'cdp_go_back', group: 'cdp' },
	{ value: 'cdp_go_forward', label: 'cdp_go_forward', group: 'cdp' },
	{ value: 'cdp_upload_file', label: 'cdp_upload_file', group: 'cdp' },
	{ value: 'cdp_download_file', label: 'cdp_download_file', group: 'cdp' },
	{ value: 'cdp_clipboard', label: 'cdp_clipboard', group: 'cdp' },
	{ value: 'cdp_execute_js', label: 'cdp_execute_js', group: 'cdp' },
	{ value: 'cdp_input_text', label: 'cdp_input_text', group: 'cdp' },
	{ value: 'cdp_press_key', label: 'cdp_press_key', group: 'cdp' },
	{ value: 'cdp_shortcut', label: 'cdp_shortcut', group: 'cdp' },
	{ value: 'cdp_handle_dialog', label: 'cdp_handle_dialog', group: 'cdp' },
	{ value: 'cdp_get_browser_version', label: 'cdp_get_browser_version', group: 'cdp' },
	{ value: 'cdp_get_browser_command_line', label: 'cdp_get_browser_command_line', group: 'cdp' },
	{ value: 'cdp_get_window_for_target', label: 'cdp_get_window_for_target', group: 'cdp' },
	{ value: 'cdp_get_layout_metrics', label: 'cdp_get_layout_metrics', group: 'cdp' },
	{ value: 'cdp_get_document', label: 'cdp_get_document', group: 'cdp' },
	{ value: 'cdp_get_full_ax_tree', label: 'cdp_get_full_ax_tree', group: 'cdp' },
	// 弹窗 / 通知
	{ value: 'confirm_dialog', label: 'confirm_dialog', group: 'manual' },
	{ value: 'select_dialog', label: 'select_dialog', group: 'manual' },
	{ value: 'form_dialog', label: 'form_dialog', group: 'manual' },
	{ value: 'table_dialog', label: 'table_dialog', group: 'manual' },
	{ value: 'image_dialog', label: 'image_dialog', group: 'manual' },
	{ value: 'countdown_dialog', label: 'countdown_dialog', group: 'manual' },
	{ value: 'markdown_dialog', label: 'markdown_dialog', group: 'manual' },
	{ value: 'notification', label: 'notification', group: 'notification' },
	// 窗口外观
	{ value: 'magic_set_bounds', label: 'magic_set_bounds', group: 'window' },
	{ value: 'magic_get_bounds', label: 'magic_get_bounds', group: 'window' },
	{ value: 'magic_set_maximized', label: 'magic_set_maximized', group: 'window' },
	{ value: 'magic_set_minimized', label: 'magic_set_minimized', group: 'window' },
	{ value: 'magic_set_closed', label: 'magic_set_closed', group: 'window' },
	{ value: 'magic_safe_quit', label: 'magic_safe_quit', group: 'window' },
	{ value: 'magic_set_restored', label: 'magic_set_restored', group: 'window' },
	{ value: 'magic_set_fullscreen', label: 'magic_set_fullscreen', group: 'window' },
	{ value: 'magic_set_bg_color', label: 'magic_set_bg_color', group: 'window' },
	{ value: 'magic_set_toolbar_text', label: 'magic_set_toolbar_text', group: 'window' },
	{ value: 'magic_set_app_top_most', label: 'magic_set_app_top_most', group: 'window' },
	{ value: 'magic_set_master_indicator_visible', label: 'magic_set_master_indicator_visible', group: 'window' },
	// 标签页
	{ value: 'magic_open_new_tab', label: 'magic_open_new_tab', group: 'tab' },
	{ value: 'magic_close_tab', label: 'magic_close_tab', group: 'tab' },
	{ value: 'magic_activate_tab', label: 'magic_activate_tab', group: 'tab' },
	{ value: 'magic_activate_tab_by_index', label: 'magic_activate_tab_by_index', group: 'tab' },
	{ value: 'magic_close_inactive_tabs', label: 'magic_close_inactive_tabs', group: 'tab' },
	{ value: 'magic_open_new_window', label: 'magic_open_new_window', group: 'tab' },
	{ value: 'magic_type_string', label: 'magic_type_string', group: 'tab' },
	{ value: 'magic_capture_app_shell', label: 'magic_capture_app_shell', group: 'tab' },
	// 浏览器信息
	{ value: 'magic_get_browsers', label: 'magic_get_browsers', group: 'browser' },
	{ value: 'magic_get_active_browser', label: 'magic_get_active_browser', group: 'browser' },
	{ value: 'magic_get_tabs', label: 'magic_get_tabs', group: 'browser' },
	{ value: 'magic_get_active_tabs', label: 'magic_get_active_tabs', group: 'browser' },
	{ value: 'magic_get_switches', label: 'magic_get_switches', group: 'browser' },
	{ value: 'magic_get_host_name', label: 'magic_get_host_name', group: 'browser' },
	{ value: 'magic_get_mac_address', label: 'magic_get_mac_address', group: 'browser' },
	// 书签
	{ value: 'magic_get_bookmarks', label: 'magic_get_bookmarks', group: 'bookmark' },
	{ value: 'magic_create_bookmark', label: 'magic_create_bookmark', group: 'bookmark' },
	{ value: 'magic_create_bookmark_folder', label: 'magic_create_bookmark_folder', group: 'bookmark' },
	{ value: 'magic_update_bookmark', label: 'magic_update_bookmark', group: 'bookmark' },
	{ value: 'magic_move_bookmark', label: 'magic_move_bookmark', group: 'bookmark' },
	{ value: 'magic_remove_bookmark', label: 'magic_remove_bookmark', group: 'bookmark' },
	{ value: 'magic_bookmark_current_tab', label: 'magic_bookmark_current_tab', group: 'bookmark' },
	{ value: 'magic_unbookmark_current_tab', label: 'magic_unbookmark_current_tab', group: 'bookmark' },
	{ value: 'magic_is_current_tab_bookmarked', label: 'magic_is_current_tab_bookmarked', group: 'bookmark' },
	{ value: 'magic_export_bookmark_state', label: 'magic_export_bookmark_state', group: 'bookmark' },
	// Cookie
	{ value: 'magic_get_managed_cookies', label: 'magic_get_managed_cookies', group: 'cookie' },
	{ value: 'magic_export_cookie_state', label: 'magic_export_cookie_state', group: 'cookie' },
	// 扩展
	{ value: 'magic_get_managed_extensions', label: 'magic_get_managed_extensions', group: 'extension' },
	{ value: 'magic_trigger_extension_action', label: 'magic_trigger_extension_action', group: 'extension' },
	{ value: 'magic_close_extension_popup', label: 'magic_close_extension_popup', group: 'extension' },
	{ value: 'magic_enable_extension', label: 'magic_enable_extension', group: 'extension' },
	{ value: 'magic_disable_extension', label: 'magic_disable_extension', group: 'extension' },
	// 同步模式
	{ value: 'magic_toggle_sync_mode', label: 'magic_toggle_sync_mode', group: 'sync' },
	{ value: 'magic_get_sync_mode', label: 'magic_get_sync_mode', group: 'sync' },
	{ value: 'magic_get_is_master', label: 'magic_get_is_master', group: 'sync' },
	{ value: 'magic_get_sync_status', label: 'magic_get_sync_status', group: 'sync' },
	// Cookie & 存储
	{ value: 'cdp_get_cookies', label: 'cdp_get_cookies', group: 'storage' },
	{ value: 'cdp_set_cookie', label: 'cdp_set_cookie', group: 'storage' },
	{ value: 'cdp_delete_cookies', label: 'cdp_delete_cookies', group: 'storage' },
	{ value: 'cdp_get_local_storage', label: 'cdp_get_local_storage', group: 'storage' },
	{ value: 'cdp_set_local_storage', label: 'cdp_set_local_storage', group: 'storage' },
	{ value: 'cdp_get_session_storage', label: 'cdp_get_session_storage', group: 'storage' },
	{ value: 'cdp_clear_storage', label: 'cdp_clear_storage', group: 'storage' },
	// 页面信息
	{ value: 'cdp_get_current_url', label: 'cdp_get_current_url', group: 'pageInfo' },
	{ value: 'cdp_get_page_source', label: 'cdp_get_page_source', group: 'pageInfo' },
	{ value: 'cdp_wait_for_navigation', label: 'cdp_wait_for_navigation', group: 'pageInfo' },
	// 设备模拟
	{ value: 'cdp_emulate_device', label: 'cdp_emulate_device', group: 'device' },
	{ value: 'cdp_set_geolocation', label: 'cdp_set_geolocation', group: 'device' },
	{ value: 'cdp_set_user_agent', label: 'cdp_set_user_agent', group: 'device' },
	// 元素 & 输入
	{ value: 'cdp_get_element_box', label: 'cdp_get_element_box', group: 'element' },
	{ value: 'cdp_highlight_element', label: 'cdp_highlight_element', group: 'element' },
	{ value: 'cdp_mouse_move', label: 'cdp_mouse_move', group: 'element' },
	{ value: 'cdp_drag_and_drop', label: 'cdp_drag_and_drop', group: 'element' },
	{ value: 'cdp_select_option', label: 'cdp_select_option', group: 'element' },
	{ value: 'cdp_check_checkbox', label: 'cdp_check_checkbox', group: 'element' },
	// 网络 & 导出
	{ value: 'cdp_block_urls', label: 'cdp_block_urls', group: 'network' },
	{ value: 'cdp_pdf', label: 'cdp_pdf', group: 'network' },
	{ value: 'cdp_intercept_request', label: 'cdp_intercept_request', group: 'network' },
	// 事件缓冲
	{ value: 'cdp_get_console_logs', label: 'cdp_get_console_logs', group: 'debug' },
	{ value: 'cdp_get_network_requests', label: 'cdp_get_network_requests', group: 'debug' },
	// Magic 窗口状态
	{ value: 'magic_get_maximized', label: 'magic_get_maximized', group: 'windowState' },
	{ value: 'magic_get_minimized', label: 'magic_get_minimized', group: 'windowState' },
	{ value: 'magic_get_fullscreen', label: 'magic_get_fullscreen', group: 'windowState' },
	{ value: 'magic_get_window_state', label: 'magic_get_window_state', group: 'windowState' },
	{ value: 'magic_import_cookies', label: 'magic_import_cookies', group: 'storage' },
	// App
	{ value: 'app_run_script', label: 'app_run_script', group: 'app' },
	// CAPTCHA
	{ value: 'captcha_detect', label: 'captcha_detect', group: 'captcha' },
	{ value: 'captcha_solve', label: 'captcha_solve', group: 'captcha' },
	{ value: 'captcha_inject_token', label: 'captcha_inject_token', group: 'captcha' },
	{ value: 'captcha_solve_and_inject', label: 'captcha_solve_and_inject', group: 'captcha' },
	{ value: 'captcha_get_balance', label: 'captcha_get_balance', group: 'captcha' },
];

// ─── Canvas 使用的显示标签（简称）─────────────────────────────────────────
// 使用 i18n 获取本地化标签，KIND_LABELS 作为后备

export const KIND_LABELS: Record<string, string> = {};

/** 获取步骤的本地化显示名称（支持 i18n，回退到 kind 值本身） */
export function getKindLabel(kind: string): string {
	const key = `automation:stepLabels.${kind}`;
	const translated = i18next.t(key);
	// i18next 找不到 key 时返回 key 本身，此时回退到 kind 值
	return translated !== key ? translated : (KIND_LABELS[kind] ?? kind);
}

/** 获取步骤功能说明（tooltip 显示） */
export function getKindDescription(kind: string): string {
	const key = `automation:stepDescriptions.${kind}`;
	const translated = i18next.t(key);
	return translated !== key ? translated : (KIND_DESCRIPTIONS[kind] ?? '');
}

// ─── 步骤功能说明（tooltip 显示） ─────────────────────────────────────────────
// 使用 i18n，KIND_DESCRIPTIONS 作为后备

export const KIND_DESCRIPTIONS: Record<string, string> = {};

// ─── Canvas 使用的分组（与原 automation-canvas-page.tsx 完全一致）──────────────

export const KIND_GROUPS: Record<string, string> = {
	// Basic
	navigate: 'cdp', wait: 'general', click: 'cdp',
	type: 'cdp', screenshot: 'cdp', magic: 'magic', cdp: 'cdp',
	// Control Flow
	wait_for_user: 'manual', condition: 'controlFlow', loop: 'controlFlow',
	break: 'controlFlow', continue: 'controlFlow', end: 'controlFlow', print: 'debug',
	// AI
	ai_agent: 'ai',
	ai_judge: 'ai',
	// CDP named steps
	cdp_navigate: 'cdp', cdp_reload: 'cdp',
	cdp_click: 'cdp', cdp_type: 'cdp', cdp_scroll_to: 'cdp',
	cdp_wait_for_selector: 'cdp', cdp_wait_for_page_load: 'cdp', cdp_get_text: 'cdp',
	cdp_get_attribute: 'cdp', cdp_set_input_value: 'cdp', cdp_screenshot: 'cdp',
	cdp_open_new_tab: 'cdp', cdp_get_all_tabs: 'cdp',
	cdp_switch_tab: 'cdp', cdp_close_tab: 'cdp',
	cdp_go_back: 'cdp', cdp_go_forward: 'cdp',
	cdp_upload_file: 'cdp', cdp_download_file: 'cdp',
	cdp_clipboard: 'cdp', cdp_execute_js: 'cdp', cdp_input_text: 'cdp',
	cdp_press_key: 'cdp', cdp_shortcut: 'cdp', cdp_handle_dialog: 'cdp',
	cdp_get_browser_version: 'cdp', cdp_get_browser_command_line: 'cdp',
	cdp_get_window_for_target: 'cdp', cdp_get_layout_metrics: 'cdp',
	cdp_get_document: 'cdp', cdp_get_full_ax_tree: 'cdp',
	// Manual/Notification
	confirm_dialog: 'manual', select_dialog: 'manual', notification: 'notification',
	form_dialog: 'manual', table_dialog: 'manual', image_dialog: 'manual',
	countdown_dialog: 'manual', markdown_dialog: 'manual',
	// Window
	magic_set_bounds: 'window', magic_get_bounds: 'window',
	magic_set_maximized: 'window', magic_set_minimized: 'window',
	magic_set_closed: 'window', magic_safe_quit: 'window',
	magic_set_restored: 'window',
	magic_set_fullscreen: 'window', magic_set_bg_color: 'window',
	magic_set_toolbar_text: 'window', magic_set_app_top_most: 'window',
	magic_set_master_indicator_visible: 'window',
	// Tab
	magic_open_new_tab: 'tab', magic_close_tab: 'tab',
	magic_activate_tab: 'tab', magic_activate_tab_by_index: 'tab',
	magic_close_inactive_tabs: 'tab', magic_open_new_window: 'tab',
	magic_type_string: 'tab',
	// Browser
	magic_get_browsers: 'browser', magic_get_active_browser: 'browser',
	magic_get_tabs: 'browser', magic_get_active_tabs: 'browser',
	magic_get_switches: 'browser', magic_get_host_name: 'browser',
	magic_get_mac_address: 'browser',
	// Bookmark
	magic_get_bookmarks: 'bookmark', magic_create_bookmark: 'bookmark',
	magic_create_bookmark_folder: 'bookmark', magic_update_bookmark: 'bookmark',
	magic_move_bookmark: 'bookmark', magic_remove_bookmark: 'bookmark',
	magic_bookmark_current_tab: 'bookmark', magic_unbookmark_current_tab: 'bookmark',
	magic_is_current_tab_bookmarked: 'bookmark', magic_export_bookmark_state: 'bookmark',
	// Cookie
	magic_get_managed_cookies: 'cookie', magic_export_cookie_state: 'cookie',
	// Extension
	magic_get_managed_extensions: 'extension', magic_trigger_extension_action: 'extension',
	magic_close_extension_popup: 'extension',
	magic_enable_extension: 'extension', magic_disable_extension: 'extension',
	// Sync
	magic_toggle_sync_mode: 'sync', magic_get_sync_mode: 'sync',
	magic_get_is_master: 'sync', magic_get_sync_status: 'sync',
	// Storage (cdp_*)
	cdp_get_cookies: 'storage', cdp_set_cookie: 'storage',
	cdp_delete_cookies: 'storage', cdp_get_local_storage: 'storage',
	cdp_set_local_storage: 'storage', cdp_get_session_storage: 'storage',
	cdp_clear_storage: 'storage', cdp_get_current_url: 'pageInfo',
	cdp_get_page_source: 'pageInfo', cdp_wait_for_navigation: 'pageInfo',
	// Device
	cdp_emulate_device: 'device', cdp_set_geolocation: 'device',
	cdp_set_user_agent: 'device',
	// Element
	cdp_get_element_box: 'element', cdp_highlight_element: 'element',
	cdp_mouse_move: 'element', cdp_drag_and_drop: 'element',
	cdp_select_option: 'element', cdp_check_checkbox: 'element',
	// Network
	cdp_block_urls: 'network', cdp_pdf: 'network',
	cdp_intercept_request: 'network',
	// Debug (console/network logs)
	cdp_get_console_logs: 'debug', cdp_get_network_requests: 'debug',
	// Window State
	magic_get_maximized: 'windowState', magic_get_minimized: 'windowState',
	magic_get_fullscreen: 'windowState', magic_get_window_state: 'windowState',
	// Import cookies (storage)
	magic_import_cookies: 'storage',
	// App
	app_run_script: 'app',
	// CAPTCHA
	captcha_detect: 'captcha', captcha_solve: 'captcha',
	captcha_inject_token: 'captcha', captcha_solve_and_inject: 'captcha',
	captcha_get_balance: 'captcha',
};

// ─── Canvas 组颜色 ────────────────────────────────────────────────────────────

export const GROUP_COLORS: Record<string, string> = {
	cdp: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
	magic: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
	ai: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
	controlFlow: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
	manual: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
	general: 'bg-muted border-border text-muted-foreground',
	notification: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300',
	debug: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
	extension: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300',
	app: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
	captcha: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
	// Window
	window: 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300',
	// Tab
	tab: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300',
	// Browser
	browser: 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300',
	// Bookmark
	bookmark: 'bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300',
	// Cookie
	cookie: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
	// Sync
	sync: 'bg-lime-500/10 border-lime-500/30 text-lime-700 dark:text-lime-300',
	// Storage
	storage: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
	// Page Info
	pageInfo: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
	// Device
	device: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300',
	// Element
	element: 'bg-blue-600/10 border-blue-600/30 text-blue-800 dark:text-blue-200',
	// Network
	network: 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300',
	// Window State
	windowState: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-300',
	// Basic
	basic: 'bg-muted border-border text-muted-foreground',
};

export const PALETTE_DOT_COLORS: Record<string, string> = {
	cdp: 'bg-blue-500',
	magic: 'bg-purple-500',
	ai: 'bg-orange-500',
	controlFlow: 'bg-green-500',
	manual: 'bg-amber-500',
	general: 'bg-muted-foreground/50',
	notification: 'bg-teal-500',
	debug: 'bg-cyan-500',
	extension: 'bg-indigo-500',
	app: 'bg-rose-500',
	captcha: 'bg-yellow-500',
	window: 'bg-violet-500',
	tab: 'bg-fuchsia-500',
	browser: 'bg-sky-500',
	bookmark: 'bg-pink-500',
	cookie: 'bg-amber-500',
	sync: 'bg-lime-500',
	storage: 'bg-emerald-500',
	pageInfo: 'bg-cyan-500',
	device: 'bg-teal-500',
	element: 'bg-blue-600',
	network: 'bg-slate-500',
	windowState: 'bg-zinc-500',
	basic: 'bg-muted-foreground/50',
};

/** 节点左侧色带（border-left 色） */
export const GROUP_ACCENT_COLORS: Record<string, string> = {
	cdp: 'border-l-blue-500',
	magic: 'border-l-purple-500',
	ai: 'border-l-orange-500',
	controlFlow: 'border-l-emerald-500',
	manual: 'border-l-amber-500',
	general: 'border-l-slate-400 dark:border-l-slate-500',
	notification: 'border-l-teal-500',
	debug: 'border-l-cyan-500',
	extension: 'border-l-indigo-500',
	app: 'border-l-rose-500',
	captcha: 'border-l-yellow-500',
	window: 'border-l-violet-500',
	tab: 'border-l-fuchsia-500',
	browser: 'border-l-sky-500',
	bookmark: 'border-l-pink-500',
	cookie: 'border-l-amber-500',
	sync: 'border-l-lime-500',
	storage: 'border-l-emerald-500',
	pageInfo: 'border-l-cyan-500',
	device: 'border-l-teal-500',
	element: 'border-l-blue-600',
	network: 'border-l-slate-500',
	windowState: 'border-l-zinc-500',
	basic: 'border-l-slate-400 dark:border-l-slate-500',
};

// ─── Canvas 拖拽面板分组 ──────────────────────────────────────────────────────

export const PALETTE_GROUPS: { label: string; kinds: string[] }[] = [
	{
		label: 'cdp',
		kinds: ['cdp_navigate', 'cdp_reload', 'cdp_click', 'cdp_type',
			'cdp_get_text', 'cdp_wait_for_selector', 'cdp_wait_for_page_load', 'cdp_scroll_to', 'cdp_screenshot',
			'cdp_open_new_tab', 'cdp_get_all_tabs', 'cdp_switch_tab', 'cdp_close_tab',
			'cdp_go_back', 'cdp_go_forward', 'cdp_upload_file', 'cdp_download_file',
			'cdp_clipboard', 'cdp_execute_js', 'cdp_input_text',
			'cdp_press_key', 'cdp_shortcut', 'cdp_handle_dialog',
			'cdp_get_browser_version', 'cdp_get_browser_command_line',
			'cdp_get_window_for_target', 'cdp_get_layout_metrics',
			'cdp_get_document', 'cdp_get_full_ax_tree',
			'cdp_get_cookies', 'cdp_set_cookie', 'cdp_delete_cookies',
			'cdp_get_local_storage', 'cdp_set_local_storage', 'cdp_get_session_storage', 'cdp_clear_storage',
			'cdp_get_current_url', 'cdp_get_page_source', 'cdp_wait_for_navigation',
			'cdp_emulate_device', 'cdp_set_geolocation', 'cdp_set_user_agent',
			'cdp_get_element_box', 'cdp_highlight_element', 'cdp_mouse_move',
			'cdp_drag_and_drop', 'cdp_select_option', 'cdp_check_checkbox',
			'cdp_block_urls', 'cdp_pdf', 'cdp_intercept_request',
			'cdp_get_console_logs', 'cdp_get_network_requests'],
	},
	{ label: 'general', kinds: ['wait', 'wait_for_user'] },
	{ label: 'manual', kinds: ['confirm_dialog', 'select_dialog', 'form_dialog', 'table_dialog', 'image_dialog', 'countdown_dialog', 'markdown_dialog'] },
	{ label: 'notification', kinds: ['notification'] },
	{ label: 'debug', kinds: ['print'] },
	{ label: 'controlFlow', kinds: ['condition', 'loop', 'break', 'continue', 'end'] },
	{ label: 'ai', kinds: ['ai_agent', 'ai_judge'] },
	{
		label: 'magic',
		kinds: ['magic_get_browsers', 'magic_open_new_tab', 'magic_close_tab',
			'magic_close_inactive_tabs', 'magic_activate_tab', 'magic_get_tabs', 'magic_set_bounds',
			'magic_get_bounds', 'magic_set_maximized', 'magic_set_minimized',
			'magic_capture_app_shell', 'magic_safe_quit',
			'magic_get_maximized', 'magic_get_minimized', 'magic_get_fullscreen',
			'magic_get_window_state', 'magic_import_cookies'],
	},
	{
		label: 'extension',
		kinds: ['magic_get_managed_extensions', 'magic_trigger_extension_action',
			'magic_close_extension_popup', 'magic_enable_extension', 'magic_disable_extension'],
	},
	{
		label: 'app',
		kinds: ['app_run_script'],
	},
	{
		label: 'captcha',
		kinds: ['captcha_detect', 'captcha_solve', 'captcha_inject_token',
			'captcha_solve_and_inject', 'captcha_get_balance'],
	},
];

// ─── defaultStep 工厂（完整版，合并自两个文件）──────────────────────────────────

export function defaultStep(kind: string): ScriptStep {
	switch (kind) {
		case 'navigate': return { kind: 'navigate', url: 'https://' };
		case 'wait': return { kind: 'wait', ms: 1000 };
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
		case 'end': return { kind: 'end' };
		case 'print': return { kind: 'print', text: '', level: 'info' };
		case 'ai_agent': return { kind: 'ai_agent', prompt: '', max_steps: 10 };
		case 'ai_judge': return { kind: 'ai_judge', prompt: '', output_mode: 'boolean' as const, max_steps: 5 };
		case 'cdp_navigate': return { kind: 'cdp_navigate', url: 'https://' };
		case 'cdp_reload': return { kind: 'cdp_reload', ignore_cache: false };
		case 'cdp_click': return { kind: 'cdp_click', selector: '' };
		case 'cdp_type': return { kind: 'cdp_type', selector: '', text: '' };
		case 'cdp_scroll_to': return { kind: 'cdp_scroll_to' };
		case 'cdp_wait_for_selector': return { kind: 'cdp_wait_for_selector', selector: '' };
		case 'cdp_wait_for_page_load': return { kind: 'cdp_wait_for_page_load', timeout_ms: 30000 };
		case 'cdp_get_text': return { kind: 'cdp_get_text', selector: '' };
		case 'cdp_get_attribute': return { kind: 'cdp_get_attribute', selector: '', attribute: '' };
		case 'cdp_set_input_value': return { kind: 'cdp_set_input_value', selector: '', value: '' };
		case 'cdp_screenshot': return { kind: 'cdp_screenshot', output_path: '' };
		case 'cdp_open_new_tab': return { kind: 'cdp_open_new_tab', url: 'https://' };
		case 'cdp_get_all_tabs': return { kind: 'cdp_get_all_tabs' };
		case 'cdp_switch_tab': return { kind: 'cdp_switch_tab', target_id: '' };
		case 'cdp_close_tab': return { kind: 'cdp_close_tab', target_id: '' };
		case 'cdp_go_back': return { kind: 'cdp_go_back', steps: 1 };
		case 'cdp_go_forward': return { kind: 'cdp_go_forward', steps: 1 };
		case 'cdp_upload_file': return { kind: 'cdp_upload_file', selector: '', files: [''] };
		case 'cdp_download_file': return { kind: 'cdp_download_file', download_path: '' };
		case 'cdp_clipboard': return { kind: 'cdp_clipboard', action: 'copy' };
		case 'cdp_execute_js': return { kind: 'cdp_execute_js', expression: '' };
		case 'cdp_input_text': return { kind: 'cdp_input_text', selector: '', text_source: 'inline', text: '' };
		case 'cdp_press_key': return { kind: 'cdp_press_key', key: 'Enter' };
		case 'cdp_shortcut': return { kind: 'cdp_shortcut', modifiers: ['ctrl'], key: 'c' };
		case 'cdp_handle_dialog': return { kind: 'cdp_handle_dialog', action: 'accept' };
		case 'cdp_get_browser_version': return { kind: 'cdp_get_browser_version' };
		case 'cdp_get_browser_command_line': return { kind: 'cdp_get_browser_command_line' };
		case 'cdp_get_window_for_target': return { kind: 'cdp_get_window_for_target' };
		case 'cdp_get_layout_metrics': return { kind: 'cdp_get_layout_metrics' };
		case 'cdp_get_document': return { kind: 'cdp_get_document', depth: 1 };
		case 'cdp_get_full_ax_tree': return { kind: 'cdp_get_full_ax_tree' };
		case 'confirm_dialog': return { kind: 'confirm_dialog', title: '', message: '', buttons: [{ text: i18next.t('automation:stepDefaults.confirm'), value: 'confirm', variant: 'default' }, { text: i18next.t('automation:stepDefaults.cancel'), value: 'cancel', variant: 'outline' }], button_branches: [] };
		case 'select_dialog': return { kind: 'select_dialog', title: '', options: [i18next.t('automation:stepDefaults.option1'), i18next.t('automation:stepDefaults.option2')] };
		case 'notification': return { kind: 'notification', title: '', body: '' };
		case 'form_dialog': return { kind: 'form_dialog', title: '', fields: [{ name: 'field1', label: 'Field 1', fieldType: 'text' }] };
		case 'table_dialog': return { kind: 'table_dialog', title: '', columns: [{ key: 'col1', label: 'Column 1' }], rows: [{ col1: '' }], selectable: false };
		case 'image_dialog': return { kind: 'image_dialog', title: '', image: '' };
		case 'countdown_dialog': return { kind: 'countdown_dialog', title: '', message: '', seconds: 10, level: 'warning' };
		case 'markdown_dialog': return { kind: 'markdown_dialog', title: '', content: '' };
		case 'magic_set_bounds': return { kind: 'magic_set_bounds', x: 0, y: 0, width: 1280, height: 800 };
		case 'magic_get_bounds': return { kind: 'magic_get_bounds' };
		case 'magic_set_maximized': return { kind: 'magic_set_maximized' };
		case 'magic_set_minimized': return { kind: 'magic_set_minimized' };
		case 'magic_set_closed': return { kind: 'magic_set_closed' };
		case 'magic_safe_quit': return { kind: 'magic_safe_quit' };
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
		case 'magic_enable_extension': return { kind: 'magic_enable_extension', extension_id: '' };
		case 'magic_disable_extension': return { kind: 'magic_disable_extension', extension_id: '' };
		case 'magic_toggle_sync_mode': return { kind: 'magic_toggle_sync_mode', role: 'master' };
		case 'magic_get_sync_mode': return { kind: 'magic_get_sync_mode' };
		case 'magic_get_is_master': return { kind: 'magic_get_is_master' };
		case 'magic_get_sync_status': return { kind: 'magic_get_sync_status' };
		case 'cdp_get_cookies': return { kind: 'cdp_get_cookies' };
		case 'cdp_set_cookie': return { kind: 'cdp_set_cookie', name: '', value: '' };
		case 'cdp_delete_cookies': return { kind: 'cdp_delete_cookies', name: '' };
		case 'cdp_get_local_storage': return { kind: 'cdp_get_local_storage' };
		case 'cdp_set_local_storage': return { kind: 'cdp_set_local_storage', key: '', value: '' };
		case 'cdp_get_session_storage': return { kind: 'cdp_get_session_storage' };
		case 'cdp_clear_storage': return { kind: 'cdp_clear_storage' };
		case 'cdp_get_current_url': return { kind: 'cdp_get_current_url' };
		case 'cdp_get_page_source': return { kind: 'cdp_get_page_source' };
		case 'cdp_wait_for_navigation': return { kind: 'cdp_wait_for_navigation', timeout_ms: 30000 };
		case 'cdp_emulate_device': return { kind: 'cdp_emulate_device', width: 375, height: 812 };
		case 'cdp_set_geolocation': return { kind: 'cdp_set_geolocation', latitude: 0, longitude: 0 };
		case 'cdp_set_user_agent': return { kind: 'cdp_set_user_agent', user_agent: '' };
		case 'cdp_get_element_box': return { kind: 'cdp_get_element_box', selector: '' };
		case 'cdp_highlight_element': return { kind: 'cdp_highlight_element', selector: '' };
		case 'cdp_mouse_move': return { kind: 'cdp_mouse_move', x: 0, y: 0 };
		case 'cdp_drag_and_drop': return { kind: 'cdp_drag_and_drop' };
		case 'cdp_select_option': return { kind: 'cdp_select_option', selector: '' };
		case 'cdp_check_checkbox': return { kind: 'cdp_check_checkbox', selector: '' };
		case 'cdp_block_urls': return { kind: 'cdp_block_urls', patterns: [''] };
		case 'cdp_pdf': return { kind: 'cdp_pdf' };
		case 'cdp_intercept_request': return { kind: 'cdp_intercept_request', url_pattern: '*', action: 'block' };
		case 'cdp_get_console_logs': return { kind: 'cdp_get_console_logs' };
		case 'cdp_get_network_requests': return { kind: 'cdp_get_network_requests' };
		case 'magic_get_maximized': return { kind: 'magic_get_maximized' };
		case 'magic_get_minimized': return { kind: 'magic_get_minimized' };
		case 'magic_get_fullscreen': return { kind: 'magic_get_fullscreen' };
		case 'magic_get_window_state': return { kind: 'magic_get_window_state' };
		case 'magic_import_cookies': return { kind: 'magic_import_cookies', cookies: [] };
		case 'app_run_script': return { kind: 'app_run_script', script_id: '' };
		case 'captcha_detect': return { kind: 'captcha_detect' };
		case 'captcha_solve': return { kind: 'captcha_solve', captcha_type: 'auto' };
		case 'captcha_inject_token': return { kind: 'captcha_inject_token', type: '', token: '' };
		case 'captcha_solve_and_inject': return { kind: 'captcha_solve_and_inject' };
		case 'captcha_get_balance': return { kind: 'captcha_get_balance' };
		default: return { kind: 'wait', ms: 1000 };
	}
}

// ─── step 摘要文本（供 canvas 节点使用）─────────────────────────────────────────

export function getStepSummaryText(step: ScriptStep): string {
	const s = step as Record<string, unknown>;
	if (step.kind === 'cdp_wait_for_page_load') return i18next.t('automation:stepSummaries.timeout', { ms: String((s['timeout_ms'] ?? 30000)) });
	if (step.kind === 'cdp_go_back' || step.kind === 'cdp_go_forward') return i18next.t('automation:stepSummaries.steps', { count: String(s['steps'] ?? 1) });
	if (step.kind === 'cdp_clipboard') return String(s['action'] ?? 'copy');
	if (step.kind === 'cdp_input_text') return String(s['text_source'] ?? 'inline');
	if (step.kind === 'cdp_press_key') return String(s['key'] ?? '');
	if (step.kind === 'cdp_shortcut') {
		const mods = (s['modifiers'] as string[] | undefined ?? []).join('+');
		return mods ? `${mods}+${String(s['key'] ?? '')}` : String(s['key'] ?? '');
	}
	if (step.kind === 'form_dialog') return String(s['title'] ?? '').slice(0, 40) || 'Form';
	if (step.kind === 'table_dialog') return String(s['title'] ?? '').slice(0, 40) || 'Table';
	if (step.kind === 'image_dialog') return String(s['title'] ?? '').slice(0, 40) || 'Image';
	if (step.kind === 'countdown_dialog') {
		const sec = String(s['seconds'] ?? 10);
		const msg = String(s['message'] ?? '').slice(0, 30);
		return msg ? `${msg} (${sec}s)` : `${sec}s`;
	}
	if (step.kind === 'markdown_dialog') return String(s['title'] ?? '').slice(0, 40) || String(s['content'] ?? '').slice(0, 40);
	if (step.kind === 'confirm_dialog') return String(s['title'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.confirm');
	if (step.kind === 'end') return String(s['message'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.end');
	if (step.kind === 'select_dialog') return String(s['title'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.select');
	if (step.kind === 'notification') return String(s['title'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.notify');
	if (step.kind === 'cdp_handle_dialog') return String(s['action'] ?? 'accept');
	if (step.kind === 'cdp_get_document') return i18next.t('automation:stepSummaries.depth', { depth: String(s['depth'] ?? 1) });
	if (step.kind === 'cdp_get_full_ax_tree') return s['depth'] ? i18next.t('automation:stepSummaries.depth', { depth: String(s['depth']) }) : i18next.t('automation:stepSummaries.full');
	if (step.kind === 'cdp_get_window_for_target') return String(s['target_id'] ?? '').slice(0, 30) || i18next.t('automation:stepSummaries.currentTarget');
	if (step.kind === 'cdp_download_file') return String(s['download_path'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_execute_js') return (String(s['file_path'] ?? '') || String(s['expression'] ?? '')).slice(0, 40);
	if (step.kind === 'print') return String(s['text'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.empty');
	if (step.kind === 'magic_enable_extension' || step.kind === 'magic_disable_extension') return String(s['extension_id'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_set_cookie') return String(s['name'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_delete_cookies') return String(s['name'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_set_local_storage' || step.kind === 'cdp_get_local_storage') return String(s['key'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.all');
	if (step.kind === 'cdp_get_session_storage') return String(s['key'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.all');
	if (step.kind === 'cdp_wait_for_navigation') return i18next.t('automation:stepSummaries.timeout', { ms: String(s['timeout_ms'] ?? 30000) });
	if (step.kind === 'cdp_emulate_device') return `${String(s['width'])}×${String(s['height'])}`;
	if (step.kind === 'cdp_set_geolocation') return `${String(s['latitude'])},${String(s['longitude'])}`;
	if (step.kind === 'cdp_set_user_agent') return String(s['user_agent'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_mouse_move') return `(${String(s['x'])}, ${String(s['y'])})`;
	if (step.kind === 'cdp_select_option') return String(s['value'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_check_checkbox') return s['checked'] === false ? i18next.t('automation:stepSummaries.unchecked') : i18next.t('automation:stepSummaries.checked');
	if (step.kind === 'cdp_block_urls') return String((s['patterns'] as string[] ?? []).join(', ')).slice(0, 40);
	if (step.kind === 'cdp_pdf') return String(s['path'] ?? '').slice(0, 40) || 'PDF';
	if (step.kind === 'cdp_intercept_request') return `${String(s['action'])} ${String(s['url_pattern'] ?? '')}`.slice(0, 40);
	if (step.kind === 'cdp_get_console_logs') return s['level'] ? String(s['level']) : i18next.t('automation:stepSummaries.all');
	if (step.kind === 'cdp_get_network_requests') return String(s['url_pattern'] ?? '').slice(0, 40) || i18next.t('automation:stepSummaries.all');
	if (step.kind === 'app_run_script') return String(s['script_id'] ?? '').slice(0, 40);
	if (step.kind === 'captcha_solve') return String(s['captcha_type'] ?? 'auto');
	if (step.kind === 'captcha_inject_token') return String(s['type'] ?? '');
	if (step.kind === 'captcha_solve_and_inject') return s['auto_submit'] ? i18next.t('automation:stepSummaries.autoSubmit') : i18next.t('automation:stepSummaries.injectOnly');
	if (s['url']) return String(s['url']).slice(0, 40);
	if (s['prompt']) return String(s['prompt']).slice(0, 40);
	if (s['expression']) return String(s['expression']).slice(0, 40);
	if (s['selector']) return String(s['selector']).slice(0, 40);
	if (s['message']) return String(s['message']).slice(0, 40);
	if (s['ms'] !== undefined) return `${String(s['ms'])}ms`;
	return '';
}
