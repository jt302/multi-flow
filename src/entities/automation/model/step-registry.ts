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
	{ value: 'end', label: '结束流程 end', group: '控制流' },
	{ value: 'print', label: '打印日志 print', group: '调试' },
	// AI 步骤
	{ value: 'ai_agent', label: 'AI Agent（多轮工具调用）', group: 'AI' },
	{ value: 'ai_judge', label: 'AI 判断', group: 'AI' },
	// CDP 具名
	{ value: 'cdp_navigate', label: 'CDP 导航', group: 'CDP' },
	{ value: 'cdp_reload', label: 'CDP 刷新页面', group: 'CDP' },
	{ value: 'cdp_click', label: 'CDP 点击', group: 'CDP' },
	{ value: 'cdp_type', label: 'CDP 输入', group: 'CDP' },
	{ value: 'cdp_scroll_to', label: 'CDP 滚动', group: 'CDP' },
	{ value: 'cdp_wait_for_selector', label: 'CDP 等待元素', group: 'CDP' },
	{ value: 'cdp_wait_for_page_load', label: 'CDP 等待页面加载', group: 'CDP' },
	{ value: 'cdp_get_text', label: 'CDP 获取文本', group: 'CDP' },
	{ value: 'cdp_get_attribute', label: 'CDP 获取属性', group: 'CDP' },
	{ value: 'cdp_set_input_value', label: 'CDP 设置输入值', group: 'CDP' },
	{ value: 'cdp_screenshot', label: 'CDP 截图(增强)', group: 'CDP' },
	{ value: 'cdp_open_new_tab', label: 'CDP 新建标签页', group: 'CDP' },
	{ value: 'cdp_get_all_tabs', label: 'CDP 获取所有标签', group: 'CDP' },
	{ value: 'cdp_switch_tab', label: 'CDP 切换标签', group: 'CDP' },
	{ value: 'cdp_close_tab', label: 'CDP 关闭标签', group: 'CDP' },
	{ value: 'cdp_go_back', label: 'CDP 后退', group: 'CDP' },
	{ value: 'cdp_go_forward', label: 'CDP 前进', group: 'CDP' },
	{ value: 'cdp_upload_file', label: 'CDP 上传文件', group: 'CDP' },
	{ value: 'cdp_download_file', label: 'CDP 设置下载路径', group: 'CDP' },
	{ value: 'cdp_clipboard', label: 'CDP 剪贴板操作', group: 'CDP' },
	{ value: 'cdp_execute_js', label: 'CDP 执行JS脚本', group: 'CDP' },
	{ value: 'cdp_input_text', label: 'CDP 文本输入(增强)', group: 'CDP' },
	{ value: 'cdp_press_key', label: 'CDP 按键', group: 'CDP' },
	{ value: 'cdp_shortcut', label: 'CDP 快捷键', group: 'CDP' },
	{ value: 'cdp_handle_dialog', label: 'CDP 处理弹窗', group: 'CDP' },
	// CDP 信息查询
	{ value: 'cdp_get_browser_version', label: 'CDP 浏览器版本', group: 'CDP' },
	{ value: 'cdp_get_browser_command_line', label: 'CDP 启动参数', group: 'CDP' },
	{ value: 'cdp_get_window_for_target', label: 'CDP 窗口信息', group: 'CDP' },
	{ value: 'cdp_get_layout_metrics', label: 'CDP 页面布局指标', group: 'CDP' },
	{ value: 'cdp_get_document', label: 'CDP 获取DOM根节点', group: 'CDP' },
	{ value: 'cdp_get_full_ax_tree', label: 'CDP 无障碍树', group: 'CDP' },
	// 弹窗 / 通知
	{ value: 'confirm_dialog', label: '确认弹窗 confirm_dialog', group: '人工介入' },
	{ value: 'select_dialog', label: '选择弹窗 select_dialog', group: '人工介入' },
	{ value: 'notification', label: '通知 notification', group: '通知' },
	// 窗口外观
	{ value: 'magic_set_bounds', label: '设置窗口位置大小', group: '窗口外观' },
	{ value: 'magic_get_bounds', label: '获取窗口位置大小', group: '窗口外观' },
	{ value: 'magic_set_maximized', label: '最大化窗口', group: '窗口外观' },
	{ value: 'magic_set_minimized', label: '最小化窗口', group: '窗口外观' },
	{ value: 'magic_set_restored', label: '还原窗口', group: '窗口外观' },
	{ value: 'magic_set_fullscreen', label: '全屏', group: '窗口外观' },
	{ value: 'magic_set_closed', label: '关闭窗口', group: '窗口外观' },
	{ value: 'magic_safe_quit', label: '关闭浏览器(安全退出)', group: '窗口外观' },
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
	{ value: 'magic_enable_extension', label: '启用扩展', group: '扩展' },
	{ value: 'magic_disable_extension', label: '禁用扩展', group: '扩展' },
	// 同步模式
	{ value: 'magic_toggle_sync_mode', label: '切换同步角色', group: '同步模式' },
	{ value: 'magic_get_sync_mode', label: '获取同步状态', group: '同步模式' },
	{ value: 'magic_get_is_master', label: '查询是否主控', group: '同步模式' },
	{ value: 'magic_get_sync_status', label: '获取完整同步状态', group: '同步模式' },
	// Cookie & 存储
	{ value: 'cdp_get_cookies', label: 'CDP 获取Cookie', group: 'Cookie & 存储' },
	{ value: 'cdp_set_cookie', label: 'CDP 设置Cookie', group: 'Cookie & 存储' },
	{ value: 'cdp_delete_cookies', label: 'CDP 删除Cookie', group: 'Cookie & 存储' },
	{ value: 'cdp_get_local_storage', label: 'CDP 读取LocalStorage', group: 'Cookie & 存储' },
	{ value: 'cdp_set_local_storage', label: 'CDP 写入LocalStorage', group: 'Cookie & 存储' },
	{ value: 'cdp_get_session_storage', label: 'CDP 读取SessionStorage', group: 'Cookie & 存储' },
	{ value: 'cdp_clear_storage', label: 'CDP 清除存储', group: 'Cookie & 存储' },
	// 页面信息
	{ value: 'cdp_get_current_url', label: 'CDP 获取当前URL', group: '页面信息' },
	{ value: 'cdp_get_page_source', label: 'CDP 获取页面源码', group: '页面信息' },
	{ value: 'cdp_wait_for_navigation', label: 'CDP 等待导航', group: '页面信息' },
	// 设备模拟
	{ value: 'cdp_emulate_device', label: 'CDP 模拟设备', group: '设备模拟' },
	{ value: 'cdp_set_geolocation', label: 'CDP 设置地理位置', group: '设备模拟' },
	{ value: 'cdp_set_user_agent', label: 'CDP 设置UA', group: '设备模拟' },
	// 元素 & 输入
	{ value: 'cdp_get_element_box', label: 'CDP 获取元素框', group: '元素 & 输入' },
	{ value: 'cdp_highlight_element', label: 'CDP 高亮元素', group: '元素 & 输入' },
	{ value: 'cdp_mouse_move', label: 'CDP 移动鼠标', group: '元素 & 输入' },
	{ value: 'cdp_drag_and_drop', label: 'CDP 拖拽', group: '元素 & 输入' },
	{ value: 'cdp_select_option', label: 'CDP 选择下拉选项', group: '元素 & 输入' },
	{ value: 'cdp_check_checkbox', label: 'CDP 勾选框', group: '元素 & 输入' },
	// 网络 & 导出
	{ value: 'cdp_block_urls', label: 'CDP 屏蔽URL', group: '网络 & 导出' },
	{ value: 'cdp_pdf', label: 'CDP 导出PDF', group: '网络 & 导出' },
	{ value: 'cdp_intercept_request', label: 'CDP 拦截请求', group: '网络 & 导出' },
	// 事件缓冲
	{ value: 'cdp_get_console_logs', label: 'CDP 控制台日志', group: '调试' },
	{ value: 'cdp_get_network_requests', label: 'CDP 网络请求', group: '调试' },
	// Magic 窗口状态
	{ value: 'magic_get_maximized', label: '是否最大化', group: '窗口状态' },
	{ value: 'magic_get_minimized', label: '是否最小化', group: '窗口状态' },
	{ value: 'magic_get_fullscreen', label: '是否全屏', group: '窗口状态' },
	{ value: 'magic_get_window_state', label: '获取窗口状态', group: '窗口状态' },
	{ value: 'magic_import_cookies', label: '导入Cookie', group: 'Cookie & 存储' },
	// App
	{ value: 'app_run_script', label: '运行脚本', group: 'App' },
	// CAPTCHA
	{ value: 'captcha_detect', label: 'CAPTCHA 检测', group: 'CAPTCHA' },
	{ value: 'captcha_solve', label: 'CAPTCHA 求解', group: 'CAPTCHA' },
	{ value: 'captcha_inject_token', label: 'CAPTCHA 注入Token', group: 'CAPTCHA' },
	{ value: 'captcha_solve_and_inject', label: 'CAPTCHA 一键求解', group: 'CAPTCHA' },
	{ value: 'captcha_get_balance', label: 'CAPTCHA 查询余额', group: 'CAPTCHA' },
];

// ─── Canvas 使用的显示标签（中文简称）─────────────────────────────────────────
// 与原 automation-canvas-page.tsx 的 KIND_LABELS 完全一致

export const KIND_LABELS: Record<string, string> = {
	navigate: '导航', wait: '等待', click: '点击',
	type: '输入', screenshot: '截图', magic: 'Magic', cdp: 'CDP 原始',
	wait_for_user: '等待人工', condition: '条件分支', loop: '循环',
	break: 'Break', continue: 'Continue', end: '结束流程', print: '打印',
	ai_agent: 'AI Agent',
	ai_judge: 'AI 判断',
	cdp_navigate: '导航', cdp_reload: '刷新',
	cdp_click: '点击', cdp_type: '输入', cdp_scroll_to: '滚动',
	cdp_wait_for_selector: '等待元素', cdp_wait_for_page_load: '等待页面加载', cdp_get_text: '获取文本',
	cdp_get_attribute: '获取属性', cdp_set_input_value: '设置输入',
	cdp_screenshot: '截图',
	cdp_open_new_tab: '新建标签', cdp_get_all_tabs: '获取标签',
	cdp_switch_tab: '切换标签', cdp_close_tab: '关闭标签',
	cdp_go_back: '后退', cdp_go_forward: '前进',
	cdp_upload_file: '上传文件', cdp_download_file: '设置下载',
	cdp_clipboard: '剪贴板', cdp_execute_js: '执行JS',
	cdp_input_text: '输入文本(增强)',
	cdp_press_key: '按键', cdp_shortcut: '快捷键', cdp_handle_dialog: '处理弹窗',
	cdp_get_browser_version: '浏览器版本', cdp_get_browser_command_line: '启动参数',
	cdp_get_window_for_target: '窗口信息', cdp_get_layout_metrics: '页面布局',
	cdp_get_document: 'DOM根节点', cdp_get_full_ax_tree: '无障碍树',
	confirm_dialog: '确认弹窗', select_dialog: '选择弹窗', notification: '通知',
	magic_set_bounds: '设置窗口尺寸', magic_get_bounds: '获取窗口尺寸',
	magic_set_maximized: '最大化', magic_set_minimized: '最小化',
	magic_set_closed: '关闭窗口', magic_safe_quit: '关闭浏览器',
	magic_set_restored: '还原窗口',
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
	magic_enable_extension: '启用扩展', magic_disable_extension: '禁用扩展',
	magic_toggle_sync_mode: '切换同步模式', magic_get_sync_mode: '获取同步模式',
	magic_get_is_master: '是否主屏', magic_get_sync_status: '获取同步状态',
	magic_capture_app_shell: '截图(应用外壳)',
	cdp_get_cookies: '获取Cookie', cdp_set_cookie: '设置Cookie',
	cdp_delete_cookies: '删除Cookie', cdp_get_local_storage: '读取LS',
	cdp_set_local_storage: '写入LS', cdp_get_session_storage: '读取SS',
	cdp_clear_storage: '清除存储', cdp_get_current_url: '获取URL',
	cdp_get_page_source: '获取源码', cdp_wait_for_navigation: '等待导航',
	cdp_emulate_device: '模拟设备', cdp_set_geolocation: '设置定位',
	cdp_set_user_agent: '设置UA', cdp_get_element_box: '元素框',
	cdp_highlight_element: '高亮元素', cdp_mouse_move: '移动鼠标',
	cdp_drag_and_drop: '拖拽', cdp_select_option: '选择选项',
	cdp_check_checkbox: '勾选框', cdp_block_urls: '屏蔽URL',
	cdp_pdf: '导出PDF', cdp_intercept_request: '拦截请求',
	cdp_get_console_logs: '控制台日志', cdp_get_network_requests: '网络请求',
	magic_get_maximized: '是否最大化', magic_get_minimized: '是否最小化',
	magic_get_fullscreen: '是否全屏', magic_get_window_state: '窗口状态',
	magic_import_cookies: '导入Cookie', app_run_script: '运行脚本',
	captcha_detect: '检测验证码', captcha_solve: '求解验证码',
	captcha_inject_token: '注入Token', captcha_solve_and_inject: '一键求解',
	captcha_get_balance: '查询余额',
};

// ─── Canvas 使用的分组（与原 automation-canvas-page.tsx 完全一致）──────────────

export const KIND_GROUPS: Record<string, string> = {
	navigate: 'CDP', wait: '通用', click: 'CDP',
	type: 'CDP', screenshot: 'CDP', magic: 'Magic', cdp: 'CDP',
	wait_for_user: '人工介入', condition: '控制流', loop: '控制流',
	break: '控制流', continue: '控制流', end: '控制流', print: '调试',
	ai_agent: 'AI',
	ai_judge: 'AI',
	cdp_navigate: 'CDP', cdp_reload: 'CDP',
	cdp_click: 'CDP', cdp_type: 'CDP', cdp_scroll_to: 'CDP',
	cdp_wait_for_selector: 'CDP', cdp_wait_for_page_load: 'CDP', cdp_get_text: 'CDP',
	cdp_get_attribute: 'CDP', cdp_set_input_value: 'CDP', cdp_screenshot: 'CDP',
	cdp_open_new_tab: 'CDP', cdp_get_all_tabs: 'CDP',
	cdp_switch_tab: 'CDP', cdp_close_tab: 'CDP',
	cdp_go_back: 'CDP', cdp_go_forward: 'CDP',
	cdp_upload_file: 'CDP', cdp_download_file: 'CDP',
	cdp_clipboard: 'CDP', cdp_execute_js: 'CDP', cdp_input_text: 'CDP',
	cdp_press_key: 'CDP', cdp_shortcut: 'CDP', cdp_handle_dialog: 'CDP',
	cdp_get_browser_version: 'CDP', cdp_get_browser_command_line: 'CDP',
	cdp_get_window_for_target: 'CDP', cdp_get_layout_metrics: 'CDP',
	cdp_get_document: 'CDP', cdp_get_full_ax_tree: 'CDP',
	confirm_dialog: '人工介入', select_dialog: '人工介入', notification: '通知',
	magic_set_bounds: 'Magic', magic_get_bounds: 'Magic',
	magic_set_maximized: 'Magic', magic_set_minimized: 'Magic',
	magic_set_closed: 'Magic', magic_safe_quit: 'Magic',
	magic_set_restored: 'Magic',
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
	magic_get_managed_extensions: '扩展', magic_trigger_extension_action: '扩展',
	magic_close_extension_popup: '扩展',
	magic_enable_extension: '扩展', magic_disable_extension: '扩展',
	magic_toggle_sync_mode: 'Magic', magic_get_sync_mode: 'Magic',
	magic_get_is_master: 'Magic', magic_get_sync_status: 'Magic',
	magic_capture_app_shell: 'Magic',
	cdp_get_cookies: 'CDP', cdp_set_cookie: 'CDP',
	cdp_delete_cookies: 'CDP', cdp_get_local_storage: 'CDP',
	cdp_set_local_storage: 'CDP', cdp_get_session_storage: 'CDP',
	cdp_clear_storage: 'CDP', cdp_get_current_url: 'CDP',
	cdp_get_page_source: 'CDP', cdp_wait_for_navigation: 'CDP',
	cdp_emulate_device: 'CDP', cdp_set_geolocation: 'CDP',
	cdp_set_user_agent: 'CDP', cdp_get_element_box: 'CDP',
	cdp_highlight_element: 'CDP', cdp_mouse_move: 'CDP',
	cdp_drag_and_drop: 'CDP', cdp_select_option: 'CDP',
	cdp_check_checkbox: 'CDP', cdp_block_urls: 'CDP',
	cdp_pdf: 'CDP', cdp_intercept_request: 'CDP',
	cdp_get_console_logs: 'CDP', cdp_get_network_requests: 'CDP',
	magic_get_maximized: 'Magic', magic_get_minimized: 'Magic',
	magic_get_fullscreen: 'Magic', magic_get_window_state: 'Magic',
	magic_import_cookies: 'Magic', app_run_script: 'App',
	captcha_detect: 'CAPTCHA', captcha_solve: 'CAPTCHA',
	captcha_inject_token: 'CAPTCHA', captcha_solve_and_inject: 'CAPTCHA',
	captcha_get_balance: 'CAPTCHA',
};

// ─── Canvas 组颜色 ────────────────────────────────────────────────────────────

export const GROUP_COLORS: Record<string, string> = {
	CDP: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
	Magic: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
	AI: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
	控制流: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
	人工介入: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
	通用: 'bg-muted border-border text-muted-foreground',	通知: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300',	调试: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
	扩展: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300',
	App: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
	CAPTCHA: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
};

export const PALETTE_DOT_COLORS: Record<string, string> = {
	CDP: 'bg-blue-500',
	Magic: 'bg-purple-500',
	AI: 'bg-orange-500',
	控制流: 'bg-green-500',
	人工介入: 'bg-amber-500',
	通用: 'bg-muted-foreground/50',
	通知: 'bg-teal-500',
	调试: 'bg-cyan-500',
	扩展: 'bg-indigo-500',
	App: 'bg-rose-500',
	CAPTCHA: 'bg-yellow-500',
};

/** 节点左侧色带（border-left 色） */
export const GROUP_ACCENT_COLORS: Record<string, string> = {
	CDP: 'border-l-blue-500',
	Magic: 'border-l-purple-500',
	AI: 'border-l-orange-500',
	控制流: 'border-l-emerald-500',
	人工介入: 'border-l-amber-500',
	通用: 'border-l-slate-400 dark:border-l-slate-500',
	通知: 'border-l-teal-500',
	调试: 'border-l-cyan-500',
	扩展: 'border-l-indigo-500',
	App: 'border-l-rose-500',
	CAPTCHA: 'border-l-yellow-500',
};

// ─── Canvas 拖拽面板分组 ──────────────────────────────────────────────────────

export const PALETTE_GROUPS: { label: string; kinds: string[] }[] = [
	{
		label: 'CDP',
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
	{ label: '通用', kinds: ['wait', 'wait_for_user'] },
	{ label: '人工介入', kinds: ['confirm_dialog', 'select_dialog'] },
	{ label: '通知', kinds: ['notification'] },
	{ label: '调试', kinds: ['print'] },
	{ label: '控制流', kinds: ['condition', 'loop', 'break', 'continue', 'end'] },
	{ label: 'AI', kinds: ['ai_agent', 'ai_judge'] },
	{
		label: 'Magic',
		kinds: ['magic_get_browsers', 'magic_open_new_tab', 'magic_close_tab',
			'magic_close_inactive_tabs', 'magic_activate_tab', 'magic_get_tabs', 'magic_set_bounds',
			'magic_get_bounds', 'magic_set_maximized', 'magic_set_minimized',
			'magic_capture_app_shell', 'magic_safe_quit',
			'magic_get_maximized', 'magic_get_minimized', 'magic_get_fullscreen',
			'magic_get_window_state', 'magic_import_cookies'],
	},
	{
		label: '扩展',
		kinds: ['magic_get_managed_extensions', 'magic_trigger_extension_action',
			'magic_close_extension_popup', 'magic_enable_extension', 'magic_disable_extension'],
	},
	{
		label: 'App',
		kinds: ['app_run_script'],
	},
	{
		label: 'CAPTCHA',
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
		case 'confirm_dialog': return { kind: 'confirm_dialog', title: '', message: '', buttons: [{ text: '确认', value: 'confirm', variant: 'default' }, { text: '取消', value: 'cancel', variant: 'outline' }], button_branches: [] };
		case 'select_dialog': return { kind: 'select_dialog', title: '', options: ['选项1', '选项2'] };
		case 'notification': return { kind: 'notification', title: '', body: '' };
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
	if (step.kind === 'cdp_wait_for_page_load') return `超时 ${String((s['timeout_ms'] ?? 30000))}ms`;
	if (step.kind === 'cdp_go_back' || step.kind === 'cdp_go_forward') return `${String(s['steps'] ?? 1)} 步`;
	if (step.kind === 'cdp_clipboard') return String(s['action'] ?? 'copy');
	if (step.kind === 'cdp_input_text') return String(s['text_source'] ?? 'inline');
	if (step.kind === 'cdp_press_key') return String(s['key'] ?? '');
	if (step.kind === 'cdp_shortcut') {
		const mods = (s['modifiers'] as string[] | undefined ?? []).join('+');
		return mods ? `${mods}+${String(s['key'] ?? '')}` : String(s['key'] ?? '');
	}
	if (step.kind === 'confirm_dialog') return String(s['title'] ?? '').slice(0, 40) || '确认';
	if (step.kind === 'end') return String(s['message'] ?? '').slice(0, 40) || '结束';
	if (step.kind === 'select_dialog') return String(s['title'] ?? '').slice(0, 40) || '选择';
	if (step.kind === 'notification') return String(s['title'] ?? '').slice(0, 40) || '通知';
	if (step.kind === 'cdp_handle_dialog') return String(s['action'] ?? 'accept');
	if (step.kind === 'cdp_get_document') return `depth=${String(s['depth'] ?? 1)}`;
	if (step.kind === 'cdp_get_full_ax_tree') return s['depth'] ? `depth=${String(s['depth'])}` : '全量';
	if (step.kind === 'cdp_get_window_for_target') return String(s['target_id'] ?? '').slice(0, 30) || '当前目标';
	if (step.kind === 'cdp_download_file') return String(s['download_path'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_execute_js') return (String(s['file_path'] ?? '') || String(s['expression'] ?? '')).slice(0, 40);
	if (step.kind === 'print') return String(s['text'] ?? '').slice(0, 40) || '(空)';
	if (step.kind === 'magic_enable_extension' || step.kind === 'magic_disable_extension') return String(s['extension_id'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_set_cookie') return String(s['name'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_delete_cookies') return String(s['name'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_set_local_storage' || step.kind === 'cdp_get_local_storage') return String(s['key'] ?? '').slice(0, 40) || '全部';
	if (step.kind === 'cdp_get_session_storage') return String(s['key'] ?? '').slice(0, 40) || '全部';
	if (step.kind === 'cdp_wait_for_navigation') return `超时 ${String(s['timeout_ms'] ?? 30000)}ms`;
	if (step.kind === 'cdp_emulate_device') return `${String(s['width'])}×${String(s['height'])}`;
	if (step.kind === 'cdp_set_geolocation') return `${String(s['latitude'])},${String(s['longitude'])}`;
	if (step.kind === 'cdp_set_user_agent') return String(s['user_agent'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_mouse_move') return `(${String(s['x'])}, ${String(s['y'])})`;
	if (step.kind === 'cdp_select_option') return String(s['value'] ?? '').slice(0, 40);
	if (step.kind === 'cdp_check_checkbox') return s['checked'] === false ? '取消勾选' : '勾选';
	if (step.kind === 'cdp_block_urls') return String((s['patterns'] as string[] ?? []).join(', ')).slice(0, 40);
	if (step.kind === 'cdp_pdf') return String(s['path'] ?? '').slice(0, 40) || 'PDF';
	if (step.kind === 'cdp_intercept_request') return `${String(s['action'])} ${String(s['url_pattern'] ?? '')}`.slice(0, 40);
	if (step.kind === 'cdp_get_console_logs') return s['level'] ? String(s['level']) : '全部';
	if (step.kind === 'cdp_get_network_requests') return String(s['url_pattern'] ?? '').slice(0, 40) || '全部';
	if (step.kind === 'app_run_script') return String(s['script_id'] ?? '').slice(0, 40);
	if (step.kind === 'captcha_solve') return String(s['captcha_type'] ?? 'auto');
	if (step.kind === 'captcha_inject_token') return String(s['type'] ?? '');
	if (step.kind === 'captcha_solve_and_inject') return s['auto_submit'] ? '自动提交' : '仅注入';
	if (s['url']) return String(s['url']).slice(0, 40);
	if (s['prompt']) return String(s['prompt']).slice(0, 40);
	if (s['expression']) return String(s['expression']).slice(0, 40);
	if (s['selector']) return String(s['selector']).slice(0, 40);
	if (s['message']) return String(s['message']).slice(0, 40);
	if (s['ms'] !== undefined) return `${String(s['ms'])}ms`;
	return '';
}
