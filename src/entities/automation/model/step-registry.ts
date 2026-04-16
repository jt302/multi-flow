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
	// AI Agent 语义化操作
	{ value: 'magic_get_browser', label: 'magic_get_browser', group: 'browser' },
	{ value: 'magic_click_at', label: 'magic_click_at', group: 'window' },
	{ value: 'magic_click_element', label: 'magic_click_element', group: 'browser' },
	{ value: 'magic_get_ui_elements', label: 'magic_get_ui_elements', group: 'browser' },
	{ value: 'magic_navigate_to', label: 'magic_navigate_to', group: 'element' },
	{ value: 'magic_query_dom', label: 'magic_query_dom', group: 'element' },
	{ value: 'magic_click_dom', label: 'magic_click_dom', group: 'element' },
	{ value: 'magic_fill_dom', label: 'magic_fill_dom', group: 'element' },
	{ value: 'magic_send_keys', label: 'magic_send_keys', group: 'element' },
	{ value: 'magic_get_page_info', label: 'magic_get_page_info', group: 'element' },
	{ value: 'magic_scroll', label: 'magic_scroll', group: 'element' },
	{ value: 'magic_set_dock_icon_text', label: 'magic_set_dock_icon_text', group: 'window' },
	{ value: 'magic_get_page_content', label: 'magic_get_page_content', group: 'element' },
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
	// AI Agent 语义化操作
	magic_get_browser: 'browser',
	magic_click_at: 'window',
	magic_click_element: 'browser',
	magic_get_ui_elements: 'browser',
	magic_navigate_to: 'element',
	magic_query_dom: 'element',
	magic_click_dom: 'element',
	magic_fill_dom: 'element',
	magic_send_keys: 'element',
	magic_get_page_info: 'element',
	magic_scroll: 'element',
	magic_set_dock_icon_text: 'window',
	magic_get_page_content: 'element',
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
		kinds: ['magic_get_browsers', 'magic_get_browser', 'magic_open_new_tab', 'magic_close_tab',
			'magic_close_inactive_tabs', 'magic_activate_tab', 'magic_get_tabs', 'magic_set_bounds',
			'magic_get_bounds', 'magic_set_maximized', 'magic_set_minimized',
			'magic_capture_app_shell', 'magic_safe_quit',
			'magic_get_maximized', 'magic_get_minimized', 'magic_get_fullscreen',
			'magic_get_window_state', 'magic_import_cookies',
			'magic_click_at', 'magic_set_dock_icon_text',
			'magic_click_element', 'magic_get_ui_elements',
			'magic_navigate_to', 'magic_query_dom', 'magic_click_dom', 'magic_fill_dom',
			'magic_send_keys', 'magic_get_page_info', 'magic_scroll', 'magic_get_page_content'],
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
		// AI Agent 语义化操作
		case 'magic_get_browser': return { kind: 'magic_get_browser', browser_id: '' };
		case 'magic_click_at': return { kind: 'magic_click_at', grid: '1280,800', position: '640,400' };
		case 'magic_click_element': return { kind: 'magic_click_element', target: 'reload_button' };
		case 'magic_get_ui_elements': return { kind: 'magic_get_ui_elements' };
		case 'magic_navigate_to': return { kind: 'magic_navigate_to', url: 'https://' };
		case 'magic_query_dom': return { kind: 'magic_query_dom', by: 'css', selector: '' };
		case 'magic_click_dom': return { kind: 'magic_click_dom', by: 'css', selector: '' };
		case 'magic_fill_dom': return { kind: 'magic_fill_dom', by: 'css', selector: '', value: '' };
		case 'magic_send_keys': return { kind: 'magic_send_keys', keys: ['Enter'] };
		case 'magic_get_page_info': return { kind: 'magic_get_page_info' };
		case 'magic_scroll': return { kind: 'magic_scroll', direction: 'down', distance: '300' };
		case 'magic_set_dock_icon_text': return { kind: 'magic_set_dock_icon_text', text: '' };
		case 'magic_get_page_content': return { kind: 'magic_get_page_content', mode: 'interactive' };
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

// ─── 步骤详细技术信息（用于 Tooltip 展示）─────────────────────────────────────

export interface StepToolInfo {
	/** 功能描述 */
	description: string;
	/** 输入参数列表 */
	inputs: { name: string; desc: string; required?: boolean }[];
	/** 输出参数 */
	outputs: { name: string; desc: string }[];
	/** 使用时机/场景 */
	whenToUse: string;
	/** 典型示例 */
	example?: string;
}

export const STEP_TOOL_INFO: Record<string, StepToolInfo> = {
	// 基础步骤
	cdp_navigate: {
		description: '跳转到指定 URL，支持变量插值如 {{var}}',
		inputs: [
			{ name: 'url', desc: '目标网址（支持变量插值）', required: true },
		],
		outputs: [{ name: 'output_key', desc: '返回的 target_id（可选）' }],
		whenToUse: '需要打开新页面或跳转到其他网址时使用。注意：不会自动等待加载完成，需配合 cdp_wait_for_page_load',
		example: 'url: "https://example.com/login"',
	},
	cdp_click: {
		description: '点击页面元素，支持 CSS/XPath/Text 选择器',
		inputs: [
			{ name: 'selector', desc: '元素选择器（CSS/XPath/Text）', required: true },
			{ name: 'selector_type', desc: '选择器类型：css/xpath/text', required: false },
		],
		outputs: [],
		whenToUse: '点击按钮、链接、复选框等可交互元素。会自动滚动到元素可见位置',
		example: 'selector: "#submit-btn"',
	},
	cdp_type: {
		description: '聚焦元素并模拟键盘输入文本',
		inputs: [
			{ name: 'selector', desc: '目标输入框选择器', required: true },
			{ name: 'text', desc: '输入的文本内容（支持变量）', required: true },
		],
		outputs: [],
		whenToUse: '在输入框中输入文本。触发 focus、input 事件，但不触发 keydown/keyup。React/Vue 受控组件建议用 cdp_set_input_value',
		example: 'selector: "#username", text: "{{user}}"',
	},
	cdp_set_input_value: {
		description: '直接设置 input 的 value 值并触发 input/change 事件',
		inputs: [
			{ name: 'selector', desc: '目标输入框选择器', required: true },
			{ name: 'value', desc: '设置的值（支持变量）', required: true },
		],
		outputs: [],
		whenToUse: 'React/Vue 等现代框架的受控组件输入，兼容性更好',
		example: 'selector: "input[name=email]", value: "test@example.com"',
	},
	cdp_get_text: {
		description: '获取元素的文本内容',
		inputs: [
			{ name: 'selector', desc: '目标元素选择器', required: true },
		],
		outputs: [{ name: 'output_key', desc: '文本内容' }],
		whenToUse: '提取页面上的价格、标题、状态等文本数据，保存到变量供后续使用',
		example: 'selector: ".price", output_key: "price"',
	},
	cdp_get_attribute: {
		description: '获取元素的 HTML 属性值',
		inputs: [
			{ name: 'selector', desc: '目标元素选择器', required: true },
			{ name: 'attribute', desc: '属性名（如 href、src、data-id）', required: true },
		],
		outputs: [{ name: 'output_key', desc: '属性值' }],
		whenToUse: '获取链接 URL、图片地址、自定义数据属性等',
		example: 'selector: "a.link", attribute: "href"',
	},
	cdp_screenshot: {
		description: '截取页面截图，支持保存到文件或 base64',
		inputs: [
			{ name: 'output_path', desc: '保存路径（可选，默认存变量）', required: false },
		],
		outputs: [
			{ name: 'output_key', desc: 'base64 图片数据' },
			{ name: 'output_key_file_path', desc: '保存的文件路径' },
		],
		whenToUse: '页面状态检查、结果验证、生成报告。AI 执行时第一步通常先截图观察',
		example: 'output_path: "/tmp/screenshot.png"',
	},
	cdp_wait_for_page_load: {
		description: '等待页面完全加载（readyState=complete）',
		inputs: [
			{ name: 'timeout_ms', desc: '超时毫秒数（默认 30000）', required: false },
		],
		outputs: [],
		whenToUse: '导航后等待页面加载完成，再执行后续操作',
		example: 'timeout_ms: 15000',
	},
	cdp_wait_for_selector: {
		description: '等待元素出现在 DOM 中',
		inputs: [
			{ name: 'selector', desc: '等待的元素选择器', required: true },
			{ name: 'timeout_ms', desc: '超时毫秒数（默认 10000）', required: false },
		],
		outputs: [],
		whenToUse: 'SPA 应用页面切换、异步加载内容后，等待特定元素出现再操作',
		example: 'selector: ".loading-complete", timeout_ms: 20000',
	},
	cdp_scroll_to: {
		description: '滚动到元素或指定坐标',
		inputs: [
			{ name: 'selector', desc: '滚动到的元素（与 x/y 二选一）', required: false },
			{ name: 'x', desc: 'X 坐标', required: false },
			{ name: 'y', desc: 'Y 坐标', required: false },
		],
		outputs: [],
		whenToUse: '长页面中滚动到特定区域，或确保元素在视口中可见',
		example: 'selector: "#footer" 或 x: 0, y: 500',
	},
	cdp_press_key: {
		description: '模拟单个按键',
		inputs: [
			{ name: 'key', desc: '按键名（Enter、Tab、Escape、ArrowDown 等）', required: true },
		],
		outputs: [],
		whenToUse: '提交表单（Enter）、切换焦点（Tab）、关闭弹窗（Escape）',
		example: 'key: "Enter"',
	},
	cdp_shortcut: {
		description: '模拟键盘快捷键组合',
		inputs: [
			{ name: 'modifiers', desc: '修饰键数组 [ctrl, alt, shift, meta]', required: true },
			{ name: 'key', desc: '主键', required: true },
		],
		outputs: [],
		whenToUse: '复制粘贴（Ctrl+C/V）、全选（Ctrl+A）、保存（Ctrl+S）',
		example: 'modifiers: ["ctrl"], key: "c"',
	},
	cdp_execute_js: {
		description: '执行任意 JavaScript 并返回结果',
		inputs: [
			{ name: 'expression', desc: 'JS 表达式（多行用分号分隔）', required: false },
			{ name: 'file_path', desc: 'JS 文件路径（与 expression 二选一）', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'JS 返回值' }],
		whenToUse: '复杂 DOM 操作、计算、聚合数据，或调用页面全局函数',
		example: 'expression: "document.querySelectorAll(\".item\").length"',
	},
	wait: {
		description: '简单等待指定毫秒数',
		inputs: [
			{ name: 'ms', desc: '等待毫秒数', required: true },
		],
		outputs: [],
		whenToUse: '简单延时等待，适用于已知固定时间的场景',
		example: 'ms: 2000',
	},
	ai_agent: {
		description: 'AI Agent 自主调用工具完成复杂任务',
		inputs: [
			{ name: 'prompt', desc: '任务描述（支持变量）', required: true },
			{ name: 'max_steps', desc: '最大执行步数（默认 10）', required: false },
			{ name: 'system_prompt', desc: '系统提示词（可选）', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'AI 返回的结果' }],
		whenToUse: '复杂多步任务（如"查找商品并加入购物车"）、需要智能判断的场景',
		example: 'prompt: "在搜索框输入 {{keyword}}，点击搜索，截图查看结果"',
	},
	ai_judge: {
		description: 'AI 判断条件并返回 true/false 或 0-100 分数',
		inputs: [
			{ name: 'prompt', desc: '判断条件描述', required: true },
			{ name: 'output_mode', desc: '输出模式：boolean/percentage', required: false },
			{ name: 'max_steps', desc: '最大步数（默认 5）', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'boolean 或 percentage 值' }],
		whenToUse: '条件分支前判断（如"页面是否包含错误提示"、"评分是否大于 80"）',
		example: 'prompt: "当前页面是否显示登录成功？", output_mode: "boolean"',
	},
	condition: {
		description: '条件分支（if/else）',
		inputs: [
			{ name: 'condition_expr', desc: '条件表达式（支持 {{变量}}）', required: true },
			{ name: 'then_steps', desc: '条件为真时执行的步骤', required: true },
			{ name: 'else_steps', desc: '条件为假时执行的步骤', required: false },
		],
		outputs: [],
		whenToUse: '根据变量值或表达式结果执行不同分支逻辑',
		example: 'condition_expr: "{{price}} < 100"',
	},
	loop: {
		description: '循环执行子步骤',
		inputs: [
			{ name: 'mode', desc: '循环模式：count/condition/list', required: true },
			{ name: 'count', desc: '循环次数（mode=count）', required: false },
			{ name: 'condition_expr', desc: '循环条件（mode=condition）', required: false },
			{ name: 'body_steps', desc: '循环体步骤', required: true },
		],
		outputs: [],
		whenToUse: '重复操作、遍历列表、条件循环（如 while）',
		example: 'mode: "count", count: 3',
	},
	print: {
		description: '输出日志信息到执行记录',
		inputs: [
			{ name: 'text', desc: '日志内容（支持变量）', required: true },
			{ name: 'level', desc: '日志级别：info/warn/error/debug', required: false },
		],
		outputs: [],
		whenToUse: '调试输出、记录关键变量值、标记执行进度',
		example: 'text: "当前价格: {{price}}", level: "info"',
	},
	confirm_dialog: {
		description: '显示确认弹窗，用户选择后进入不同分支',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'message', desc: '提示消息', required: true },
			{ name: 'buttons', desc: '按钮定义数组（text、value、variant）', required: true },
		],
		outputs: [{ name: 'output_key', desc: '用户点击的按钮值' }],
		whenToUse: '人工介入决策点（如"是否继续？"、"选择处理方式"）',
		example: 'message: "检测到验证码，是否继续？", buttons: [{text:"继续", value:"yes"}, {text:"停止", value:"no"}]',
	},
	// 扩展步骤
	cdp_reload: {
		description: '刷新当前页面',
		inputs: [
			{ name: 'ignore_cache', desc: '是否忽略缓存（强制刷新）', required: false },
		],
		outputs: [],
		whenToUse: '需要刷新页面获取最新内容，或清除页面状态',
		example: 'ignore_cache: true',
	},
	cdp_go_back: {
		description: '浏览器后退导航',
		inputs: [
			{ name: 'steps', desc: '后退步数（默认 1）', required: false },
		],
		outputs: [],
		whenToUse: '返回上一页或多页浏览历史',
		example: 'steps: 1',
	},
	cdp_go_forward: {
		description: '浏览器前进导航',
		inputs: [
			{ name: 'steps', desc: '前进步数（默认 1）', required: false },
		],
		outputs: [],
		whenToUse: '前进到浏览历史中的下一页',
		example: 'steps: 1',
	},
	cdp_open_new_tab: {
		description: '在新标签页打开 URL',
		inputs: [
			{ name: 'url', desc: '目标网址（支持变量插值）', required: true },
		],
		outputs: [{ name: 'output_key', desc: '新标签页 target_id' }],
		whenToUse: '需要在新标签页打开链接，保持当前页面状态',
		example: 'url: "https://example.com/page"',
	},
	cdp_get_all_tabs: {
		description: '获取所有标签页列表',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '标签页信息数组' }],
		whenToUse: '需要获取当前窗口所有标签页信息，用于切换或管理',
		example: '',
	},
	cdp_switch_tab: {
		description: '切换到指定标签页',
		inputs: [
			{ name: 'target_id', desc: '目标标签页 ID', required: true },
		],
		outputs: [],
		whenToUse: '在多标签页场景中切换到特定标签页',
		example: 'target_id: "ABC123"',
	},
	cdp_close_tab: {
		description: '关闭指定标签页',
		inputs: [
			{ name: 'target_id', desc: '要关闭的标签页 ID', required: true },
		],
		outputs: [],
		whenToUse: '关闭不再需要的标签页，释放资源',
		example: 'target_id: "ABC123"',
	},
	cdp_upload_file: {
		description: '向文件输入元素上传文件',
		inputs: [
			{ name: 'selector', desc: '文件输入元素选择器', required: true },
			{ name: 'files', desc: '文件路径数组', required: true },
		],
		outputs: [],
		whenToUse: '需要上传文件到网页表单',
		example: 'selector: "input[type=file]", files: ["/path/to/file.pdf"]',
	},
	cdp_download_file: {
		description: '配置浏览器下载目录',
		inputs: [
			{ name: 'download_path', desc: '下载保存目录', required: false },
		],
		outputs: [],
		whenToUse: '设置文件下载保存位置',
		example: 'download_path: "/Users/xxx/Downloads"',
	},
	cdp_clipboard: {
		description: '剪贴板操作（复制/粘贴/全选）',
		inputs: [
			{ name: 'action', desc: '操作类型：copy/paste/selectAll', required: true },
		],
		outputs: [],
		whenToUse: '执行剪贴板相关操作',
		example: 'action: "copy"',
	},
	cdp_input_text: {
		description: '多来源文本输入（直接/文件/变量）',
		inputs: [
			{ name: 'selector', desc: '目标输入框选择器', required: true },
			{ name: 'text_source', desc: '文本来源：inline/file/variable', required: true },
			{ name: 'text', desc: '直接输入的文本', required: false },
			{ name: 'file_path', desc: '文本文件路径', required: false },
		],
		outputs: [],
		whenToUse: '需要从不同来源（文件、变量）输入文本',
		example: 'selector: "#input", text_source: "inline", text: "hello"',
	},
	cdp_handle_dialog: {
		description: '处理浏览器原生弹窗（alert/confirm/prompt）',
		inputs: [
			{ name: 'action', desc: '操作：accept/dismiss', required: true },
			{ name: 'prompt_text', desc: 'prompt 输入的文本（可选）', required: false },
		],
		outputs: [],
		whenToUse: '自动处理页面弹出的 alert、confirm、prompt 对话框',
		example: 'action: "accept"',
	},
	cdp_get_cookies: {
		description: '获取页面 Cookie',
		inputs: [],
		outputs: [{ name: 'output_key', desc: 'Cookie 数组' }],
		whenToUse: '需要获取当前页面 Cookie 信息',
		example: '',
	},
	cdp_set_cookie: {
		description: '设置页面 Cookie',
		inputs: [
			{ name: 'name', desc: 'Cookie 名称', required: true },
			{ name: 'value', desc: 'Cookie 值', required: true },
			{ name: 'domain', desc: 'Cookie 域（可选）', required: false },
		],
		outputs: [],
		whenToUse: '需要设置特定 Cookie 值',
		example: 'name: "session", value: "abc123"',
	},
	cdp_delete_cookies: {
		description: '删除指定 Cookie',
		inputs: [
			{ name: 'name', desc: '要删除的 Cookie 名称', required: true },
		],
		outputs: [],
		whenToUse: '需要清除特定 Cookie',
		example: 'name: "session"',
	},
	cdp_get_current_url: {
		description: '获取当前页面 URL',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '当前 URL 字符串' }],
		whenToUse: '需要获取当前页面地址',
		example: '',
	},
	cdp_get_page_source: {
		description: '获取页面 HTML 源码',
		inputs: [],
		outputs: [{ name: 'output_key', desc: 'HTML 源码字符串' }],
		whenToUse: '需要获取页面完整 HTML 内容',
		example: '',
	},
	cdp_emulate_device: {
		description: '模拟移动设备',
		inputs: [
			{ name: 'width', desc: '视口宽度', required: true },
			{ name: 'height', desc: '视口高度', required: true },
			{ name: 'user_agent', desc: 'User-Agent（可选）', required: false },
		],
		outputs: [],
		whenToUse: '模拟手机/平板设备访问页面',
		example: 'width: 375, height: 812',
	},
	cdp_set_geolocation: {
		description: '设置地理位置',
		inputs: [
			{ name: 'latitude', desc: '纬度', required: true },
			{ name: 'longitude', desc: '经度', required: true },
		],
		outputs: [],
		whenToUse: '模拟特定地理位置',
		example: 'latitude: 39.9042, longitude: 116.4074',
	},
	cdp_block_urls: {
		description: '屏蔽指定 URL 请求',
		inputs: [
			{ name: 'patterns', desc: 'URL 匹配模式数组', required: true },
		],
		outputs: [],
		whenToUse: '屏蔽广告、追踪脚本等资源加载',
		example: 'patterns: ["*://*.google-analytics.com/*"]',
	},
	cdp_pdf: {
		description: '导出页面为 PDF',
		inputs: [
			{ name: 'path', desc: '保存路径（可选）', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'PDF 数据或路径' }],
		whenToUse: '将当前页面保存为 PDF 文件',
		example: 'path: "/tmp/page.pdf"',
	},
	cdp_get_console_logs: {
		description: '获取浏览器控制台日志',
		inputs: [
			{ name: 'level', desc: '日志级别过滤（可选）', required: false },
		],
		outputs: [{ name: 'output_key', desc: '日志条目数组' }],
		whenToUse: '获取页面 console 输出，用于调试',
		example: 'level: "error"',
	},
	cdp_get_network_requests: {
		description: '获取网络请求记录',
		inputs: [
			{ name: 'url_pattern', desc: 'URL 过滤模式（可选）', required: false },
		],
		outputs: [{ name: 'output_key', desc: '网络请求数组' }],
		whenToUse: '分析页面网络请求',
		example: '',
	},
	// Magic 步骤
	magic_open_new_tab: {
		description: '通过 Magic Controller 打开新标签页',
		inputs: [
			{ name: 'url', desc: '目标网址', required: true },
		],
		outputs: [],
		whenToUse: '使用 Magic 方式打开新标签页',
		example: 'url: "https://example.com"',
	},
	magic_close_tab: {
		description: '通过 Magic Controller 关闭标签页',
		inputs: [
			{ name: 'tab_id', desc: '标签页 ID', required: true },
		],
		outputs: [],
		whenToUse: '关闭指定标签页',
		example: 'tab_id: 123',
	},
	magic_activate_tab: {
		description: '通过 Magic Controller 激活标签页',
		inputs: [
			{ name: 'tab_id', desc: '标签页 ID', required: true },
		],
		outputs: [],
		whenToUse: '切换到指定标签页',
		example: 'tab_id: 123',
	},
	magic_get_browsers: {
		description: '获取所有浏览器实例',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '浏览器信息数组' }],
		whenToUse: '获取所有打开的浏览器窗口信息',
		example: '',
	},
	magic_get_tabs: {
		description: '获取指定浏览器的标签页列表',
		inputs: [
			{ name: 'browser_id', desc: '浏览器 ID', required: true },
		],
		outputs: [{ name: 'output_key', desc: '标签页信息数组' }],
		whenToUse: '获取特定浏览器的所有标签页',
		example: 'browser_id: 1',
	},
	magic_set_bounds: {
		description: '设置浏览器窗口位置和大小',
		inputs: [
			{ name: 'x', desc: 'X 坐标', required: true },
			{ name: 'y', desc: 'Y 坐标', required: true },
			{ name: 'width', desc: '宽度', required: true },
			{ name: 'height', desc: '高度', required: true },
		],
		outputs: [],
		whenToUse: '调整浏览器窗口位置和尺寸',
		example: 'x: 0, y: 0, width: 1280, height: 800',
	},
	magic_get_bounds: {
		description: '获取浏览器窗口位置和大小',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '窗口边界信息' }],
		whenToUse: '获取当前窗口位置和尺寸',
		example: '',
	},
	magic_set_maximized: {
		description: '最大化浏览器窗口',
		inputs: [],
		outputs: [],
		whenToUse: '将窗口最大化',
		example: '',
	},
	magic_set_minimized: {
		description: '最小化浏览器窗口',
		inputs: [],
		outputs: [],
		whenToUse: '将窗口最小化到任务栏',
		example: '',
	},
	magic_set_fullscreen: {
		description: '设置浏览器全屏',
		inputs: [],
		outputs: [],
		whenToUse: '切换到全屏模式',
		example: '',
	},
	magic_safe_quit: {
		description: '安全退出浏览器',
		inputs: [],
		outputs: [],
		whenToUse: '安全关闭浏览器，清理资源',
		example: '',
	},
	magic_capture_app_shell: {
		description: '截取完整浏览器窗口（含工具栏）',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '截图数据' }],
		whenToUse: '截取包含浏览器 UI 的完整窗口',
		example: '',
	},
	magic_type_string: {
		description: '通过 Magic Controller 输入文本',
		inputs: [
			{ name: 'text', desc: '要输入的文本', required: true },
		],
		outputs: [],
		whenToUse: '使用 Magic 方式输入文本',
		example: 'text: "Hello World"',
	},
	magic_get_managed_extensions: {
		description: '获取浏览器扩展列表',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '扩展信息数组' }],
		whenToUse: '获取已安装的浏览器扩展',
		example: '',
	},
	magic_trigger_extension_action: {
		description: '触发扩展动作',
		inputs: [
			{ name: 'extension_id', desc: '扩展 ID', required: true },
		],
		outputs: [],
		whenToUse: '点击扩展图标触发动作',
		example: 'extension_id: "abc123"',
	},
	magic_enable_extension: {
		description: '启用浏览器扩展',
		inputs: [
			{ name: 'extension_id', desc: '扩展 ID', required: true },
		],
		outputs: [],
		whenToUse: '启用已安装的扩展',
		example: 'extension_id: "abc123"',
	},
	magic_disable_extension: {
		description: '禁用浏览器扩展',
		inputs: [
			{ name: 'extension_id', desc: '扩展 ID', required: true },
		],
		outputs: [],
		whenToUse: '禁用指定扩展',
		example: 'extension_id: "abc123"',
	},
	magic_get_bookmarks: {
		description: '获取浏览器书签',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '书签树' }],
		whenToUse: '获取浏览器书签数据',
		example: '',
	},
	magic_get_managed_cookies: {
		description: '获取托管 Cookie',
		inputs: [],
		outputs: [{ name: 'output_key', desc: 'Cookie 列表' }],
		whenToUse: '获取浏览器托管 Cookie',
		example: '',
	},
	magic_export_cookie_state: {
		description: '导出 Cookie 状态',
		inputs: [
			{ name: 'mode', desc: '导出模式：all/current', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'Cookie 状态数据' }],
		whenToUse: '导出 Cookie 供后续使用',
		example: 'mode: "all"',
	},
	magic_toggle_sync_mode: {
		description: '切换同步模式',
		inputs: [
			{ name: 'role', desc: '角色：master/slave/off', required: true },
		],
		outputs: [],
		whenToUse: '切换窗口同步模式',
		example: 'role: "master"',
	},
	magic_get_sync_status: {
		description: '获取同步状态',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '同步状态信息' }],
		whenToUse: '获取当前同步模式状态',
		example: '',
	},
	// 其他常用步骤
	select_dialog: {
		description: '显示选择弹窗，用户从选项中选择',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'options', desc: '选项数组', required: true },
		],
		outputs: [{ name: 'output_key', desc: '用户选择的值' }],
		whenToUse: '让用户从预定义选项中选择',
		example: 'options: ["选项1", "选项2", "选项3"]',
	},
	form_dialog: {
		description: '显示表单弹窗，收集多字段输入',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'fields', desc: '字段定义数组', required: true },
		],
		outputs: [{ name: 'output_key', desc: '表单数据对象' }],
		whenToUse: '需要收集多个字段的用户输入',
		example: 'fields: [{name: "email", label: "邮箱", type: "email"}]',
	},
	notification: {
		description: '发送桌面通知',
		inputs: [
			{ name: 'title', desc: '通知标题', required: true },
			{ name: 'body', desc: '通知内容', required: true },
		],
		outputs: [],
		whenToUse: '向用户发送桌面通知提醒',
		example: 'title: "完成", body: "任务执行成功"',
	},
	wait_for_user: {
		description: '暂停执行等待用户确认',
		inputs: [
			{ name: 'message', desc: '提示消息', required: false },
		],
		outputs: [],
		whenToUse: '需要用户手动确认后再继续',
		example: 'message: "请完成人工操作后点击继续"',
	},
	break: {
		description: '跳出当前循环',
		inputs: [],
		outputs: [],
		whenToUse: '在循环中满足条件时提前退出',
		example: '',
	},
	continue: {
		description: '跳过当前循环迭代',
		inputs: [],
		outputs: [],
		whenToUse: '跳过当前循环剩余步骤，进入下一次迭代',
		example: '',
	},
	end: {
		description: '结束脚本执行',
		inputs: [
			{ name: 'message', desc: '结束消息（可选）', required: false },
		],
		outputs: [],
		whenToUse: '提前终止脚本执行',
		example: 'message: "任务完成"',
	},
	// 基础步骤别名
	navigate: {
		description: '跳转到指定 URL（cdp_navigate 别名）',
		inputs: [{ name: 'url', desc: '目标网址', required: true }],
		outputs: [],
		whenToUse: '简化版的页面导航',
		example: 'url: "https://example.com"',
	},
	click: {
		description: '点击页面元素（cdp_click 别名）',
		inputs: [{ name: 'selector', desc: '元素选择器', required: true }],
		outputs: [],
		whenToUse: '简化版的元素点击',
		example: 'selector: "#btn"',
	},
	type: {
		description: '输入文本（cdp_type 别名）',
		inputs: [
			{ name: 'selector', desc: '输入框选择器', required: true },
			{ name: 'text', desc: '输入文本', required: true },
		],
		outputs: [],
		whenToUse: '简化版的文本输入',
		example: 'selector: "#input", text: "hello"',
	},
	screenshot: {
		description: '截取页面截图（cdp_screenshot 别名）',
		inputs: [{ name: 'output_path', desc: '保存路径', required: false }],
		outputs: [{ name: 'output_key', desc: '截图数据' }],
		whenToUse: '简化版的截图操作',
		example: 'output_path: "/tmp/screenshot.png"',
	},
	magic: {
		description: '执行 Magic 控制器原始命令',
		inputs: [
			{ name: 'command', desc: '命令名称', required: true },
			{ name: 'params', desc: '命令参数对象', required: false },
		],
		outputs: [{ name: 'output_key', desc: '命令返回结果' }],
		whenToUse: '执行未封装为专用步骤的 Magic 命令',
		example: 'command: "getTabs", params: {}',
	},
	cdp: {
		description: '执行原始 CDP 协议命令',
		inputs: [
			{ name: 'method', desc: 'CDP 方法名', required: true },
			{ name: 'params', desc: '方法参数', required: false },
		],
		outputs: [{ name: 'output_key', desc: 'CDP 返回结果' }],
		whenToUse: '直接调用 Chrome DevTools Protocol 方法',
		example: 'method: "Page.captureScreenshot"',
	},
	// 高级 CDP 步骤
	cdp_get_browser_version: {
		description: '获取浏览器版本信息',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '版本信息对象' }],
		whenToUse: '获取浏览器版本、用户代理等信息',
		example: '',
	},
	cdp_get_document: {
		description: '获取页面 DOM 结构',
		inputs: [{ name: 'depth', desc: '递归深度（默认1）', required: false }],
		outputs: [{ name: 'output_key', desc: 'DOM 树结构' }],
		whenToUse: '获取页面 DOM 树用于分析',
		example: 'depth: 2',
	},
	cdp_drag_and_drop: {
		description: '拖拽元素到目标位置',
		inputs: [
			{ name: 'source', desc: '源元素选择器', required: true },
			{ name: 'target', desc: '目标元素选择器', required: true },
		],
		outputs: [],
		whenToUse: '执行拖拽操作，如排序、上传等',
		example: 'source: "#item1", target: "#dropzone"',
	},
	// 弹窗类
	table_dialog: {
		description: '显示数据表格弹窗',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'columns', desc: '列定义数组', required: true },
			{ name: 'rows', desc: '数据行数组', required: true },
		],
		outputs: [{ name: 'output_key', desc: '选中的行数据' }],
		whenToUse: '向用户展示结构化数据表格',
		example: 'columns: [{key: "name", label: "名称"}], rows: [{name: "Item1"}]',
	},
	image_dialog: {
		description: '显示图片预览弹窗',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'image', desc: '图片数据（URL或base64）', required: true },
		],
		outputs: [],
		whenToUse: '向用户展示图片，如验证码截图',
		example: 'image: "data:image/png;base64,xxx"',
	},
	countdown_dialog: {
		description: '显示倒计时确认弹窗',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'message', desc: '提示消息', required: true },
			{ name: 'seconds', desc: '倒计时秒数', required: false },
		],
		outputs: [{ name: 'output_key', desc: '用户是否确认' }],
		whenToUse: '危险操作前给用户确认时间',
		example: 'message: "确认删除？", seconds: 5',
	},
	markdown_dialog: {
		description: '显示 Markdown 内容弹窗',
		inputs: [
			{ name: 'title', desc: '弹窗标题', required: false },
			{ name: 'content', desc: 'Markdown 内容', required: true },
		],
		outputs: [],
		whenToUse: '展示格式化文本内容',
		example: 'content: "# 标题\\n\\n内容"',
	},
	// Magic 窗口控制
	magic_set_restored: {
		description: '恢复窗口正常状态',
		inputs: [],
		outputs: [],
		whenToUse: '从最大化/最小化状态恢复窗口',
		example: '',
	},
	magic_set_closed: {
		description: '关闭浏览器窗口',
		inputs: [],
		outputs: [],
		whenToUse: '关闭当前浏览器窗口',
		example: '',
	},
	magic_set_bg_color: {
		description: '设置窗口背景色',
		inputs: [
			{ name: 'r', desc: '红色值(0-255)', required: true },
			{ name: 'g', desc: '绿色值(0-255)', required: true },
			{ name: 'b', desc: '蓝色值(0-255)', required: true },
		],
		outputs: [],
		whenToUse: '自定义浏览器窗口背景颜色',
		example: 'r: 255, g: 255, b: 255',
	},
	// CAPTCHA
	captcha_detect: {
		description: '检测页面验证码',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '验证码类型信息' }],
		whenToUse: '自动检测页面上的验证码类型',
		example: '',
	},
	captcha_solve: {
		description: '求解验证码',
		inputs: [
			{ name: 'captcha_type', desc: '验证码类型', required: false },
		],
		outputs: [{ name: 'output_key', desc: '验证码答案' }],
		whenToUse: '调用求解服务破解验证码',
		example: 'captcha_type: "recaptcha"',
	},
	app_run_script: {
		description: '运行其他自动化脚本',
		inputs: [
			{ name: 'script_id', desc: '脚本ID', required: true },
		],
		outputs: [],
		whenToUse: '在当前脚本中调用其他脚本',
		example: 'script_id: "script_123"',
	},
	// CAPTCHA 完整步骤
	captcha_inject_token: {
		description: '将验证码 token 注入页面',
		inputs: [
			{ name: 'type', desc: '验证码类型：recaptcha/hcaptcha/turnstile', required: true },
			{ name: 'token', desc: '求解服务返回的 token', required: true },
		],
		outputs: [],
		whenToUse: '将求解得到的 token 注入到页面对应表单字段',
		example: 'type: "recaptcha", token: "03AGdBq24..."',
	},
	captcha_solve_and_inject: {
		description: '一键检测→求解→注入验证码',
		inputs: [
			{ name: 'auto_submit', desc: '注入后是否自动提交表单', required: false },
		],
		outputs: [{ name: 'output_key', desc: '求解结果' }],
		whenToUse: '全自动处理页面验证码，无需手动分步操作',
		example: 'auto_submit: false',
	},
	captcha_get_balance: {
		description: '查询验证码求解服务余额',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '账户余额' }],
		whenToUse: '检查求解服务账户余额是否充足',
		example: '',
	},
	// CDP 存储相关
	cdp_get_local_storage: {
		description: '获取 LocalStorage 数据',
		inputs: [{ name: 'key', desc: '键名（空则获取全部）', required: false }],
		outputs: [{ name: 'output_key', desc: 'LocalStorage 数据' }],
		whenToUse: '读取页面本地存储数据',
		example: 'key: "user_prefs"',
	},
	cdp_set_local_storage: {
		description: '设置 LocalStorage 数据',
		inputs: [
			{ name: 'key', desc: '键名', required: true },
			{ name: 'value', desc: '值', required: true },
		],
		outputs: [],
		whenToUse: '写入页面本地存储',
		example: 'key: "session", value: "abc123"',
	},
	cdp_get_session_storage: {
		description: '获取 SessionStorage 数据',
		inputs: [{ name: 'key', desc: '键名（空则获取全部）', required: false }],
		outputs: [{ name: 'output_key', desc: 'SessionStorage 数据' }],
		whenToUse: '读取页面会话存储数据',
		example: 'key: "temp_data"',
	},
	cdp_clear_storage: {
		description: '清除所有存储数据',
		inputs: [
			{ name: 'local_storage', desc: '是否清除 LocalStorage', required: false },
			{ name: 'session_storage', desc: '是否清除 SessionStorage', required: false },
			{ name: 'cookies', desc: '是否清除 Cookies', required: false },
		],
		outputs: [],
		whenToUse: '清理页面存储，重置状态',
		example: 'local_storage: true, cookies: true',
	},
	// CDP 浏览器信息
	cdp_get_browser_command_line: {
		description: '获取浏览器启动参数',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '命令行参数数组' }],
		whenToUse: '获取浏览器启动时的命令行参数',
		example: '',
	},
	cdp_get_window_for_target: {
		description: '获取目标窗口信息',
		inputs: [{ name: 'target_id', desc: '目标 ID', required: false }],
		outputs: [{ name: 'output_key', desc: '窗口信息' }],
		whenToUse: '获取特定目标的窗口信息',
		example: '',
	},
	cdp_get_layout_metrics: {
		description: '获取页面布局指标',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '布局信息（可视区域、内容大小等）' }],
		whenToUse: '获取页面可视区域和内容尺寸信息',
		example: '',
	},
	// CDP DOM/无障碍
	cdp_get_full_ax_tree: {
		description: '获取页面无障碍树（完整语义结构）',
		inputs: [{ name: 'depth', desc: '递归深度', required: false }],
		outputs: [{ name: 'output_key', desc: '无障碍树结构' }],
		whenToUse: '获取页面完整语义结构，用于辅助功能分析',
		example: 'depth: -1',
	},
	// CDP 元素操作
	cdp_get_element_box: {
		description: '获取元素位置和尺寸',
		inputs: [{ name: 'selector', desc: '元素选择器', required: true }],
		outputs: [{ name: 'output_key', desc: '元素边界框信息' }],
		whenToUse: '获取元素在页面中的位置和大小',
		example: 'selector: "#header"',
	},
	cdp_highlight_element: {
		description: '高亮显示元素',
		inputs: [
			{ name: 'selector', desc: '元素选择器', required: true },
			{ name: 'duration', desc: '高亮持续时间(ms)', required: false },
		],
		outputs: [],
		whenToUse: '调试时临时高亮元素位置',
		example: 'selector: ".button", duration: 2000',
	},
	cdp_mouse_move: {
		description: '移动鼠标到指定坐标',
		inputs: [
			{ name: 'x', desc: 'X 坐标', required: true },
			{ name: 'y', desc: 'Y 坐标', required: true },
		],
		outputs: [],
		whenToUse: '模拟鼠标移动到页面指定位置',
		example: 'x: 100, y: 200',
	},
	cdp_select_option: {
		description: '选择下拉框选项',
		inputs: [
			{ name: 'selector', desc: '下拉框选择器', required: true },
			{ name: 'value', desc: '选项值', required: true },
		],
		outputs: [],
		whenToUse: '选择 select 元素的特定选项',
		example: 'selector: "#country", value: "CN"',
	},
	cdp_check_checkbox: {
		description: '勾选或取消复选框',
		inputs: [
			{ name: 'selector', desc: '复选框选择器', required: true },
			{ name: 'checked', desc: '是否勾选（默认 true）', required: false },
		],
		outputs: [],
		whenToUse: '操作复选框的选中状态',
		example: 'selector: "#agree", checked: true',
	},
	// CDP 网络
	cdp_intercept_request: {
		description: '拦截/修改网络请求',
		inputs: [
			{ name: 'url_pattern', desc: 'URL 匹配模式', required: true },
			{ name: 'action', desc: '操作：block/redirect/modify', required: true },
		],
		outputs: [],
		whenToUse: '拦截特定请求进行阻止、重定向或修改',
		example: 'url_pattern: "*.analytics.com/*", action: "block"',
	},
	// CDP 导航
	cdp_wait_for_navigation: {
		description: '等待页面导航完成',
		inputs: [{ name: 'timeout_ms', desc: '超时毫秒数', required: false }],
		outputs: [],
		whenToUse: '等待页面 URL 变化或导航完成',
		example: 'timeout_ms: 10000',
	},
	cdp_set_user_agent: {
		description: '设置 User-Agent',
		inputs: [{ name: 'user_agent', desc: 'User-Agent 字符串', required: true }],
		outputs: [],
		whenToUse: '修改浏览器 User-Agent 标识',
		example: 'user_agent: "Mozilla/5.0 (iPhone...)"',
	},
	// Magic 标签页管理
	magic_activate_tab_by_index: {
		description: '通过索引激活标签页',
		inputs: [{ name: 'index', desc: '标签页索引（从0开始）', required: true }],
		outputs: [],
		whenToUse: '按位置序号切换到特定标签页',
		example: 'index: 2',
	},
	magic_close_inactive_tabs: {
		description: '关闭非活跃标签页',
		inputs: [],
		outputs: [],
		whenToUse: '只保留当前标签页，关闭其他所有标签',
		example: '',
	},
	magic_open_new_window: {
		description: '打开新浏览器窗口',
		inputs: [{ name: 'url', desc: '初始 URL', required: false }],
		outputs: [],
		whenToUse: '创建新的浏览器窗口',
		example: 'url: "https://example.com"',
	},
	// Magic 浏览器信息
	magic_get_active_browser: {
		description: '获取当前活跃浏览器',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '活跃浏览器信息' }],
		whenToUse: '获取当前焦点所在的浏览器窗口',
		example: '',
	},
	magic_get_active_tabs: {
		description: '获取所有活跃标签页',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '活跃标签页列表' }],
		whenToUse: '获取所有浏览器中的活跃标签页',
		example: '',
	},
	magic_get_switches: {
		description: '获取浏览器开关状态',
		inputs: [{ name: 'key', desc: '开关键名', required: false }],
		outputs: [{ name: 'output_key', desc: '开关值' }],
		whenToUse: '查询浏览器功能开关状态',
		example: 'key: "enable_feature_x"',
	},
	magic_get_host_name: {
		description: '获取主机名',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '主机名' }],
		whenToUse: '获取当前设备主机名',
		example: '',
	},
	magic_get_mac_address: {
		description: '获取 MAC 地址',
		inputs: [],
		outputs: [{ name: 'output_key', desc: 'MAC 地址列表' }],
		whenToUse: '获取设备网络接口 MAC 地址',
		example: '',
	},
	// Magic 窗口状态
	magic_get_maximized: {
		description: '检查窗口是否最大化',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '是否最大化' }],
		whenToUse: '获取当前窗口最大化状态',
		example: '',
	},
	magic_get_minimized: {
		description: '检查窗口是否最小化',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '是否最小化' }],
		whenToUse: '获取当前窗口最小化状态',
		example: '',
	},
	magic_get_fullscreen: {
		description: '检查窗口是否全屏',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '是否全屏' }],
		whenToUse: '获取当前窗口全屏状态',
		example: '',
	},
	magic_get_window_state: {
		description: '获取窗口完整状态',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '窗口状态信息' }],
		whenToUse: '获取窗口位置、大小、状态等完整信息',
		example: '',
	},
	// Magic 同步模式
	magic_get_sync_mode: {
		description: '获取同步模式',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '当前同步模式' }],
		whenToUse: '查询窗口同步模式设置',
		example: '',
	},
	magic_get_is_master: {
		description: '检查是否为主控窗口',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '是否主控' }],
		whenToUse: '检查当前窗口是否为同步主控',
		example: '',
	},
	// Magic 窗口设置
	magic_set_app_top_most: {
		description: '设置窗口置顶',
		inputs: [{ name: 'topmost', desc: '是否置顶', required: false }],
		outputs: [],
		whenToUse: '将浏览器窗口置顶显示',
		example: 'topmost: true',
	},
	magic_set_master_indicator_visible: {
		description: '设置主控指示器可见性',
		inputs: [{ name: 'visible', desc: '是否可见', required: false }],
		outputs: [],
		whenToUse: '显示/隐藏主控窗口指示器',
		example: 'visible: true',
	},
	magic_set_toolbar_text: {
		description: '设置工具栏文本',
		inputs: [{ name: 'text', desc: '显示文本', required: true }],
		outputs: [],
		whenToUse: '在浏览器工具栏显示自定义文本',
		example: 'text: "Running..."',
	},
	// Magic 书签管理
	magic_bookmark_current_tab: {
		description: '收藏当前标签页',
		inputs: [
			{ name: 'title', desc: '书签标题（默认页面标题）', required: false },
			{ name: 'parent_id', desc: '父文件夹ID', required: false },
		],
		outputs: [{ name: 'output_key', desc: '新书签ID' }],
		whenToUse: '将当前页面添加为书签',
		example: 'title: "My Page"',
	},
	magic_unbookmark_current_tab: {
		description: '取消收藏当前标签页',
		inputs: [],
		outputs: [],
		whenToUse: '移除当前页面的书签',
		example: '',
	},
	magic_is_current_tab_bookmarked: {
		description: '检查当前页是否已收藏',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '是否已收藏' }],
		whenToUse: '查询当前页面是否为书签',
		example: '',
	},
	magic_create_bookmark: {
		description: '创建新书签',
		inputs: [
			{ name: 'title', desc: '书签标题', required: true },
			{ name: 'url', desc: '书签URL', required: true },
			{ name: 'parent_id', desc: '父文件夹ID', required: false },
		],
		outputs: [{ name: 'output_key', desc: '新书签ID' }],
		whenToUse: '创建指定URL的书签',
		example: 'title: "Example", url: "https://example.com"',
	},
	magic_create_bookmark_folder: {
		description: '创建书签文件夹',
		inputs: [
			{ name: 'title', desc: '文件夹名称', required: true },
			{ name: 'parent_id', desc: '父文件夹ID', required: false },
		],
		outputs: [{ name: 'output_key', desc: '新文件夹ID' }],
		whenToUse: '创建书签文件夹用于整理书签',
		example: 'title: "Work"',
	},
	magic_update_bookmark: {
		description: '更新书签信息',
		inputs: [
			{ name: 'node_id', desc: '书签节点ID', required: true },
			{ name: 'title', desc: '新标题', required: false },
			{ name: 'url', desc: '新URL', required: false },
		],
		outputs: [],
		whenToUse: '修改书签的标题或URL',
		example: 'node_id: "123", title: "New Title"',
	},
	magic_move_bookmark: {
		description: '移动书签',
		inputs: [
			{ name: 'node_id', desc: '要移动的书签ID', required: true },
			{ name: 'new_parent_id', desc: '目标文件夹ID', required: true },
			{ name: 'index', desc: '目标位置索引', required: false },
		],
		outputs: [],
		whenToUse: '将书签移动到另一个文件夹',
		example: 'node_id: "123", new_parent_id: "456"',
	},
	magic_remove_bookmark: {
		description: '删除书签',
		inputs: [{ name: 'node_id', desc: '书签节点ID', required: true }],
		outputs: [],
		whenToUse: '删除指定书签或文件夹',
		example: 'node_id: "123"',
	},
	magic_export_bookmark_state: {
		description: '导出书签状态',
		inputs: [],
		outputs: [{ name: 'output_key', desc: '完整书签树数据' }],
		whenToUse: '导出所有书签数据供备份或迁移',
		example: '',
	},
	// Magic Cookie
	magic_import_cookies: {
		description: '导入 Cookie',
		inputs: [{ name: 'cookies', desc: 'Cookie 数据数组', required: true }],
		outputs: [],
		whenToUse: '导入之前导出的 Cookie 数据',
		example: 'cookies: [{name:"session", value:"abc"}]',
	},
	// Magic 扩展管理
	magic_close_extension_popup: {
		description: '关闭扩展弹窗',
		inputs: [],
		outputs: [],
		whenToUse: '关闭当前打开的扩展弹出窗口',
		example: '',
	},
};

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
