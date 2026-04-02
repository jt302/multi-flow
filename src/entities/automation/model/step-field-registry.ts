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
  navigate: [
    { type: 'text', key: 'url', label: 'URL' },
    { type: 'output_key' },
  ],

  // ── 等待 ──────────────────────────────────────────────────────────────────
  wait: [{ type: 'number', key: 'ms', label: '等待毫秒数' }],

  // ── 点击 ──────────────────────────────────────────────────────────────────
  click: [{ type: 'selector' }],

  // ── 输入文本 ──────────────────────────────────────────────────────────────
  type: [
    { type: 'selector' },
    { type: 'text', key: 'text', label: '输入文本' },
  ],

  // ── 截图（Magic Controller） ──────────────────────────────────────────────
  screenshot: [{ type: 'output_key' }],

  // ── 通用 Magic / CDP 命令（复杂结构，不提供标准字段） ──────────────────────
  magic: [],
  cdp: [],

  // ── 等待用户操作（含输入框、超时配置） ───────────────────────────────────
  // 字段较多且有条件逻辑，保留在面板直接渲染，此处记录标准部分
  wait_for_user: [
    { type: 'text', key: 'message', label: '提示消息', multiline: true },
    { type: 'text', key: 'input_label', label: '输入框标签（留空则无输入框）' },
    { type: 'output_key' },
    { type: 'number', key: 'timeout_ms', label: '超时毫秒数（0=不超时）' },
  ],

  // ── 条件分支（then/else 子步骤由 canvas 特殊渲染） ───────────────────────
  condition: [
    { type: 'text', key: 'condition_expr', label: '条件表达式' },
  ],

  // ── 循环（body_steps 由 canvas 特殊渲染） ─────────────────────────────────
  loop: [
    { type: 'number', key: 'count', label: '循环次数' },
    { type: 'text', key: 'iter_var', label: '迭代变量名（可选）' },
  ],

  // ── 流程控制（无字段） ─────────────────────────────────────────────────────
  break: [],
  continue: [],

  // ── 打印日志 ──────────────────────────────────────────────────────────────
  print: [
    {
      type: 'text',
      key: 'text',
      label: '打印内容（支持 {{变量}}）',
      multiline: true,
    },
    {
      type: 'select',
      key: 'level',
      label: '日志级别',
      options: [
        { value: 'info', label: 'info' },
        { value: 'warn', label: 'warn' },
        { value: 'error', label: 'error' },
        { value: 'debug', label: 'debug' },
      ],
    },
  ],

  // ── AI 步骤 ───────────────────────────────────────────────────────────────
  ai_prompt: [
    {
      type: 'text',
      key: 'prompt',
      label: 'Prompt（支持 {{变量}}）',
      multiline: true,
    },
    { type: 'text', key: 'image_var', label: '图片变量名（可选）' },
    { type: 'output_key' },
  ],

  ai_extract: [
    {
      type: 'text',
      key: 'prompt',
      label: 'Prompt（支持 {{变量}}）',
      multiline: true,
    },
    // output_key_map 是复杂数组结构，由面板直接渲染
  ],

  ai_agent: [
    {
      type: 'text',
      key: 'system_prompt',
      label: '系统提示词',
      multiline: true,
    },
    {
      type: 'text',
      key: 'initial_message',
      label: '初始消息（支持 {{变量}}）',
      multiline: true,
    },
    { type: 'number', key: 'max_steps', label: '最大循环轮次' },
    { type: 'output_key' },
  ],

  // ── CDP 具名步骤 ──────────────────────────────────────────────────────────
  cdp_navigate: [
    { type: 'text', key: 'url', label: 'URL' },
    { type: 'output_key' },
  ],

  cdp_reload: [
    { type: 'checkbox', key: 'ignore_cache', label: '忽略缓存' },
  ],

  cdp_click: [{ type: 'selector' }],

  cdp_type: [
    { type: 'selector' },
    { type: 'text', key: 'text', label: '输入文本' },
  ],

  cdp_scroll_to: [{ type: 'selector', label: '元素选择器（可选）', optional: true }],

  cdp_wait_for_selector: [
    { type: 'selector' },
    { type: 'number', key: 'timeout_ms', label: '超时毫秒数' },
  ],

  cdp_wait_for_page_load: [
    { type: 'number', key: 'timeout_ms', label: '超时毫秒数' },
  ],

  cdp_get_text: [
    { type: 'selector' },
    { type: 'output_key' },
  ],

  cdp_get_attribute: [
    { type: 'selector' },
    { type: 'text', key: 'attribute', label: '属性名' },
    { type: 'output_key' },
  ],

  cdp_set_input_value: [
    { type: 'selector' },
    { type: 'text', key: 'value', label: '值' },
  ],

  cdp_screenshot: [
    { type: 'output_key', key: 'output_key_file_path', label: '文件路径变量名' },
    {
      type: 'file_path',
      key: 'output_path',
      label: '保存路径',
      mode: 'save',
      filters: [{ name: '图片文件', extensions: ['png', 'jpeg', 'jpg'] }],
    },
  ],

  cdp_open_new_tab: [
    { type: 'text', key: 'url', label: 'URL' },
    { type: 'output_key' },
  ],

  cdp_get_all_tabs: [{ type: 'output_key' }],

  cdp_switch_tab: [
    { type: 'text', key: 'target_id', label: 'Target ID（支持 {{变量}}）' },
  ],

  cdp_close_tab: [
    { type: 'text', key: 'target_id', label: 'Target ID（支持 {{变量}}）' },
  ],

  cdp_go_back: [{ type: 'number', key: 'steps', label: '步数' }],

  cdp_go_forward: [{ type: 'number', key: 'steps', label: '步数' }],

  cdp_upload_file: [
    { type: 'selector' },
    { type: 'text', key: 'files.0', label: '文件路径（支持 {{变量}}）' },
  ],

  cdp_download_file: [
    {
      type: 'file_path',
      key: 'download_path',
      label: '下载目录',
      mode: 'directory',
    },
  ],

  cdp_clipboard: [
    {
      type: 'select',
      key: 'action',
      label: '操作',
      options: [
        { value: 'copy', label: '复制 (Copy)' },
        { value: 'paste', label: '粘贴 (Paste)' },
        { value: 'select_all', label: '全选 (Select All)' },
      ],
    },
  ],

  // cdp_execute_js: 含文件路径对话框和 JS 代码多行输入，field 混合，保留部分
  cdp_execute_js: [
    { type: 'text', key: 'expression', label: 'JS 代码', multiline: true },
    {
      type: 'file_path',
      key: 'file_path',
      label: 'JS 文件路径（可选，优先于代码）',
      mode: 'open',
      filters: [{ name: 'JS文件', extensions: ['js', 'mjs'] }],
    },
    { type: 'output_key' },
  ],

  // cdp_input_text: text_source 决定后续字段，使用 conditional 类型
  cdp_input_text: [
    { type: 'selector' },
    {
      type: 'select',
      key: 'text_source',
      label: '文本来源',
      options: [
        { value: 'inline', label: '直接输入' },
        { value: 'file', label: '从文件读取' },
        { value: 'variable', label: '从变量读取' },
      ],
    },
    {
      type: 'conditional',
      watchKey: 'text_source',
      conditions: {
        inline: [
          { type: 'text', key: 'text', label: '输入文本', multiline: true },
        ],
        file: [
          {
            type: 'file_path',
            key: 'file_path',
            label: '文本文件路径',
            mode: 'open',
            filters: [
              { name: '文本文件', extensions: ['txt', 'md', 'csv'] },
            ],
          },
        ],
        variable: [
          { type: 'text', key: 'var_name', label: '变量名（不含 {{}}）' },
        ],
      },
    },
  ],

  // ── Magic Controller 具名步骤 ─────────────────────────────────────────────

  // 窗口外观
  magic_set_bounds: [
    { type: 'number', key: 'x', label: 'X' },
    { type: 'number', key: 'y', label: 'Y' },
    { type: 'number', key: 'width', label: '宽度' },
    { type: 'number', key: 'height', label: '高度' },
  ],

  magic_get_bounds: [{ type: 'output_key' }],

  magic_set_maximized: [],
  magic_set_minimized: [],
  magic_set_closed: [],
  magic_set_restored: [],
  magic_set_fullscreen: [],

  magic_set_bg_color: [
    { type: 'number', key: 'r', label: 'R (0-255)', min: 0 },
    { type: 'number', key: 'g', label: 'G (0-255)', min: 0 },
    { type: 'number', key: 'b', label: 'B (0-255)', min: 0 },
  ],

  magic_set_toolbar_text: [
    { type: 'text', key: 'text', label: '工具栏文字' },
  ],

  magic_set_app_top_most: [],

  magic_set_master_indicator_visible: [
    { type: 'checkbox', key: 'visible', label: '是否可见' },
    { type: 'text', key: 'label', label: '标签文字（可选）' },
  ],

  // 标签页与窗口操作
  magic_open_new_tab: [
    { type: 'text', key: 'url', label: 'URL' },
    { type: 'output_key' },
  ],

  magic_close_tab: [
    { type: 'number', key: 'tab_id', label: 'Tab ID' },
  ],

  magic_activate_tab: [
    { type: 'number', key: 'tab_id', label: 'Tab ID' },
  ],

  magic_activate_tab_by_index: [
    { type: 'number', key: 'index', label: '标签页索引' },
  ],

  magic_close_inactive_tabs: [],

  magic_open_new_window: [{ type: 'output_key' }],

  magic_type_string: [
    { type: 'text', key: 'text', label: '输入文本（支持 {{变量}}）' },
  ],

  // 浏览器信息查询
  magic_get_browsers: [{ type: 'output_key' }],

  magic_get_active_browser: [{ type: 'output_key' }],

  magic_get_tabs: [
    { type: 'number', key: 'browser_id', label: 'Browser ID' },
    { type: 'output_key' },
  ],

  magic_get_active_tabs: [{ type: 'output_key' }],

  magic_get_switches: [
    { type: 'text', key: 'key', label: 'Switch Key' },
    { type: 'output_key' },
  ],

  magic_get_host_name: [{ type: 'output_key' }],

  magic_get_mac_address: [{ type: 'output_key' }],

  // 书签
  magic_get_bookmarks: [{ type: 'output_key' }],

  magic_create_bookmark: [
    { type: 'text', key: 'parent_id', label: '父节点 ID' },
    { type: 'text', key: 'title', label: '标题' },
    { type: 'text', key: 'url', label: 'URL' },
    { type: 'output_key' },
  ],

  magic_create_bookmark_folder: [
    { type: 'text', key: 'parent_id', label: '父节点 ID' },
    { type: 'text', key: 'title', label: '文件夹名称' },
    { type: 'output_key' },
  ],

  magic_update_bookmark: [
    { type: 'text', key: 'node_id', label: '节点 ID' },
    { type: 'text', key: 'title', label: '新标题（可选）' },
    { type: 'text', key: 'url', label: '新 URL（可选）' },
  ],

  magic_move_bookmark: [
    { type: 'text', key: 'node_id', label: '节点 ID' },
    { type: 'text', key: 'new_parent_id', label: '新父节点 ID' },
  ],

  magic_remove_bookmark: [
    { type: 'text', key: 'node_id', label: '节点 ID' },
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
      label: '导出模式',
      options: [
        { value: 'all', label: '全部' },
        { value: 'url', label: '按 URL' },
      ],
    },
    { type: 'text', key: 'url', label: 'URL（mode=url 时有效）' },
    { type: 'output_key' },
  ],

  // 扩展
  magic_get_managed_extensions: [{ type: 'output_key' }],

  magic_trigger_extension_action: [
    { type: 'text', key: 'extension_id', label: '扩展 ID' },
  ],

  magic_close_extension_popup: [],

  // 同步模式
  magic_toggle_sync_mode: [
    { type: 'text', key: 'role', label: '角色（master/slave）' },
    { type: 'output_key' },
  ],

  magic_get_sync_mode: [{ type: 'output_key' }],

  magic_get_is_master: [{ type: 'output_key' }],

  magic_get_sync_status: [{ type: 'output_key' }],

  // 截图（app 壳）
  magic_capture_app_shell: [
    { type: 'output_key', key: 'output_key_file_path', label: '文件路径变量名' },
    {
      type: 'file_path',
      key: 'output_path',
      label: '保存路径',
      mode: 'save',
      filters: [{ name: '图片文件', extensions: ['png', 'jpeg', 'jpg'] }],
    },
  ],
};
