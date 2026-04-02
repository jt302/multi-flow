//! AI 工具 JSON Schema 定义
//!
//! 所有工具的 OpenAI function calling schema 按类别组织。
//! 工具名即为 ScriptStep 的 kind 值（cdp_/magic_ 前缀的工具）
//! 或独立执行器路由键（app_/file_/dialog_ 前缀的工具）。

use serde_json::{json, Value};

/// 构建单个工具的 OpenAI function schema
fn tool(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters
        }
    })
}

/// 返回所有工具定义
pub fn all_tool_definitions() -> Vec<Value> {
    let mut defs = Vec::with_capacity(120);
    defs.extend(utility_tools());
    defs.extend(cdp_tools());
    defs.extend(magic_tools());
    defs.extend(app_tools());
    defs.extend(file_tools());
    defs.extend(dialog_tools());
    defs
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility 工具
// ═══════════════════════════════════════════════════════════════════════════

fn utility_tools() -> Vec<Value> {
    vec![
        tool(
            "wait",
            "等待指定毫秒数",
            json!({
                "type": "object",
                "properties": {
                    "ms": { "type": "integer", "description": "等待时长（毫秒）" }
                },
                "required": ["ms"]
            }),
        ),
        tool(
            "print",
            "输出日志信息",
            json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "要输出的文本" },
                    "level": { "type": "string", "enum": ["info", "warn", "error", "debug"], "description": "日志级别，默认 info" }
                },
                "required": ["text"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// CDP 工具（25 个）
// ═══════════════════════════════════════════════════════════════════════════

fn cdp_tools() -> Vec<Value> {
    let selector_type_prop = json!({
        "type": "string",
        "enum": ["css", "xpath", "text"],
        "description": "选择器类型，默认 css。css=CSS选择器, xpath=XPath表达式, text=按可见文本匹配"
    });

    vec![
        tool(
            "cdp_navigate",
            "导航到指定 URL",
            json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "目标 URL" },
                    "output_key": { "type": "string", "description": "将 URL 存入此变量名" }
                },
                "required": ["url"]
            }),
        ),
        tool(
            "cdp_reload",
            "重新加载当前页面",
            json!({
                "type": "object",
                "properties": {
                    "ignore_cache": { "type": "boolean", "description": "是否忽略缓存，默认 false" }
                }
            }),
        ),
        tool(
            "cdp_go_back",
            "浏览器后退",
            json!({
                "type": "object",
                "properties": {
                    "steps": { "type": "integer", "description": "后退步数，默认 1" }
                }
            }),
        ),
        tool(
            "cdp_go_forward",
            "浏览器前进",
            json!({
                "type": "object",
                "properties": {
                    "steps": { "type": "integer", "description": "前进步数，默认 1" }
                }
            }),
        ),
        tool(
            "cdp_click",
            "点击页面元素",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_type",
            "聚焦元素并输入文本（通过 CDP Input.insertText）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "text": { "type": "string", "description": "要输入的文本" }
                },
                "required": ["selector", "text"]
            }),
        ),
        tool(
            "cdp_set_input_value",
            "通过 JS 直接设置 input 元素的 value 并触发 input/change 事件",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "value": { "type": "string", "description": "要设置的值" }
                },
                "required": ["selector", "value"]
            }),
        ),
        tool(
            "cdp_get_text",
            "获取元素的文本内容（innerText/textContent）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "output_key": { "type": "string", "description": "将文本存入此变量名" }
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_get_attribute",
            "获取元素的指定 HTML 属性值",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "attribute": { "type": "string", "description": "属性名，如 href、src、class 等" },
                    "output_key": { "type": "string", "description": "将属性值存入此变量名" }
                },
                "required": ["selector", "attribute"]
            }),
        ),
        tool(
            "cdp_wait_for_selector",
            "等待元素出现在 DOM 中",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "timeout_ms": { "type": "integer", "description": "超时毫秒数，默认 10000" }
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_wait_for_page_load",
            "等待页面完全加载（readyState = complete）",
            json!({
                "type": "object",
                "properties": {
                    "timeout_ms": { "type": "integer", "description": "超时毫秒数，默认 30000" }
                }
            }),
        ),
        tool(
            "cdp_scroll_to",
            "滚动页面到指定元素或坐标位置",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器（可选，与 x/y 二选一）" },
                    "selector_type": selector_type_prop,
                    "x": { "type": "integer", "description": "横向滚动坐标" },
                    "y": { "type": "integer", "description": "纵向滚动坐标" }
                }
            }),
        ),
        tool(
            "cdp_screenshot",
            "截取当前页面截图（自动保存文件，支持视觉分析）",
            json!({
                "type": "object",
                "properties": {
                    "format": { "type": "string", "enum": ["png", "jpeg"], "description": "图片格式，默认 png" },
                    "quality": { "type": "integer", "description": "JPEG 质量（1-100），仅 jpeg 格式有效" },
                    "output_path": { "type": "string", "description": "保存到磁盘的绝对路径（可选，默认自动生成）" },
                    "output_key_file_path": { "type": "string", "description": "将文件路径存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_execute_js",
            "在页面执行 JavaScript 代码并返回结果",
            json!({
                "type": "object",
                "properties": {
                    "expression": { "type": "string", "description": "JavaScript 代码（与 file_path 二选一）" },
                    "file_path": { "type": "string", "description": "JS 文件路径（优先于 expression）" },
                    "output_key": { "type": "string", "description": "将返回值存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_open_new_tab",
            "在浏览器中打开新标签页",
            json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "要打开的 URL" },
                    "output_key": { "type": "string", "description": "将新标签页的 targetId 存入此变量名" }
                },
                "required": ["url"]
            }),
        ),
        tool(
            "cdp_get_all_tabs",
            "获取所有标签页信息（返回 JSON 数组）",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将标签页列表 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_switch_tab",
            "切换到指定标签页",
            json!({
                "type": "object",
                "properties": {
                    "target_id": { "type": "string", "description": "目标标签页的 targetId" }
                },
                "required": ["target_id"]
            }),
        ),
        tool(
            "cdp_close_tab_by_target",
            "关闭指定标签页",
            json!({
                "type": "object",
                "properties": {
                    "target_id": { "type": "string", "description": "要关闭的标签页 targetId" }
                },
                "required": ["target_id"]
            }),
        ),
        tool(
            "cdp_upload_file",
            "向文件 input 元素设置文件（仅支持 CSS 选择器）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "文件 input 元素的 CSS 选择器" },
                    "selector_type": selector_type_prop,
                    "files": { "type": "array", "items": { "type": "string" }, "description": "文件绝对路径数组" }
                },
                "required": ["selector", "files"]
            }),
        ),
        tool(
            "cdp_download_file",
            "设置浏览器下载路径（后续下载自动保存到此目录）",
            json!({
                "type": "object",
                "properties": {
                    "download_path": { "type": "string", "description": "下载目录的绝对路径" }
                },
                "required": ["download_path"]
            }),
        ),
        tool(
            "cdp_clipboard",
            "执行剪贴板操作（复制/粘贴/全选）",
            json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["copy", "paste", "select_all"], "description": "操作类型" }
                },
                "required": ["action"]
            }),
        ),
        tool(
            "cdp_press_key",
            "模拟按键（单个键）",
            json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "键名，如 Enter, Tab, Escape, ArrowDown 等" }
                },
                "required": ["key"]
            }),
        ),
        tool(
            "cdp_shortcut",
            "模拟键盘快捷键组合",
            json!({
                "type": "object",
                "properties": {
                    "modifiers": { "type": "array", "items": { "type": "string", "enum": ["alt", "ctrl", "meta", "shift"] }, "description": "修饰键列表" },
                    "key": { "type": "string", "description": "主键名" }
                },
                "required": ["modifiers", "key"]
            }),
        ),
        tool(
            "cdp_input_text",
            "多来源文本输入（内联文本/文件/变量）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "text_source": { "type": "string", "enum": ["inline", "file", "variable"], "description": "文本来源类型，默认 inline" },
                    "text": { "type": "string", "description": "内联文本（text_source=inline 时使用）" },
                    "file_path": { "type": "string", "description": "文件路径（text_source=file 时使用）" },
                    "var_name": { "type": "string", "description": "变量名（text_source=variable 时使用）" }
                },
                "required": ["selector"]
            }),
        ),
        // 原始 CDP 方法调用
        tool(
            "cdp",
            "调用任意 CDP（Chrome DevTools Protocol）方法",
            json!({
                "type": "object",
                "properties": {
                    "method": { "type": "string", "description": "CDP 方法名，如 Runtime.evaluate, Network.enable 等" },
                    "params": { "type": "object", "description": "方法参数（JSON 对象）" },
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                },
                "required": ["method"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Magic Controller 工具（47 个）
// ═══════════════════════════════════════════════════════════════════════════

fn magic_tools() -> Vec<Value> {
    vec![
        // ── 窗口控制 (11) ──
        tool(
            "magic_set_bounds",
            "设置浏览器窗口位置和大小",
            json!({
                "type": "object",
                "properties": {
                    "x": { "type": "integer", "description": "窗口左上角 X 坐标" },
                    "y": { "type": "integer", "description": "窗口左上角 Y 坐标" },
                    "width": { "type": "integer", "description": "窗口宽度" },
                    "height": { "type": "integer", "description": "窗口高度" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_bounds",
            "获取浏览器窗口位置和大小",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_set_maximized",
            "最大化浏览器窗口",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_minimized",
            "最小化浏览器窗口",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_closed",
            "关闭浏览器窗口",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_restored",
            "恢复浏览器窗口（从最大化/最小化恢复）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_fullscreen",
            "全屏浏览器窗口",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_bg_color",
            "设置浏览器背景颜色",
            json!({
                "type": "object",
                "properties": {
                    "r": { "type": "integer", "description": "红色分量 (0-255)" },
                    "g": { "type": "integer", "description": "绿色分量 (0-255)" },
                    "b": { "type": "integer", "description": "蓝色分量 (0-255)" }
                }
            }),
        ),
        tool(
            "magic_set_toolbar_text",
            "设置浏览器工具栏显示文本",
            json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "显示的文本" }
                },
                "required": ["text"]
            }),
        ),
        tool(
            "magic_set_app_top_most",
            "将浏览器窗口置顶",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_set_master_indicator_visible",
            "显示/隐藏主控指示器标签",
            json!({
                "type": "object",
                "properties": {
                    "visible": { "type": "boolean", "description": "是否显示" },
                    "label": { "type": "string", "description": "标签文本" }
                }
            }),
        ),
        // ── 标签页管理 (8) ──
        tool(
            "magic_open_new_tab",
            "打开新标签页",
            json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "要打开的 URL" },
                    "browser_id": { "type": "integer", "description": "目标浏览器 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["url"]
            }),
        ),
        tool(
            "magic_close_tab",
            "关闭指定标签页",
            json!({
                "type": "object",
                "properties": {
                    "tab_id": { "type": "integer", "description": "标签页 ID" }
                },
                "required": ["tab_id"]
            }),
        ),
        tool(
            "magic_activate_tab",
            "激活指定标签页",
            json!({
                "type": "object",
                "properties": {
                    "tab_id": { "type": "integer", "description": "标签页 ID" }
                },
                "required": ["tab_id"]
            }),
        ),
        tool(
            "magic_activate_tab_by_index",
            "按索引激活标签页",
            json!({
                "type": "object",
                "properties": {
                    "index": { "type": "integer", "description": "标签页索引（从 0 开始）" },
                    "browser_id": { "type": "integer", "description": "目标浏览器 ID（可选）" }
                },
                "required": ["index"]
            }),
        ),
        tool(
            "magic_close_inactive_tabs",
            "关闭所有非活跃标签页",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "magic_open_new_window",
            "打开新浏览器窗口",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_type_string",
            "通过 Magic Controller 输入文本（模拟键盘输入）",
            json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "要输入的文本" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" }
                },
                "required": ["text"]
            }),
        ),
        // ── 浏览器查询 (7) ──
        tool(
            "magic_get_browsers",
            "获取所有浏览器实例列表",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_active_browser",
            "获取当前活跃的浏览器实例",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_tabs",
            "获取指定浏览器的标签页列表",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID" },
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_active_tabs",
            "获取所有活跃标签页",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_switches",
            "获取浏览器启动参数",
            json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "参数名（可选，不填返回全部）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_host_name",
            "获取浏览器环境主机名",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_mac_address",
            "获取浏览器环境 MAC 地址",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        // ── 书签管理 (11) ──
        tool(
            "magic_get_bookmarks",
            "获取所有书签",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将书签树 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_create_bookmark",
            "创建书签",
            json!({
                "type": "object",
                "properties": {
                    "parent_id": { "type": "string", "description": "父文件夹 ID（可选）" },
                    "title": { "type": "string", "description": "书签标题" },
                    "url": { "type": "string", "description": "书签 URL" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["title", "url"]
            }),
        ),
        tool(
            "magic_create_bookmark_folder",
            "创建书签文件夹",
            json!({
                "type": "object",
                "properties": {
                    "parent_id": { "type": "string", "description": "父文件夹 ID（可选）" },
                    "title": { "type": "string", "description": "文件夹标题" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["title"]
            }),
        ),
        tool(
            "magic_update_bookmark",
            "更新书签标题或URL",
            json!({
                "type": "object",
                "properties": {
                    "node_id": { "type": "string", "description": "书签节点 ID" },
                    "title": { "type": "string", "description": "新标题（可选）" },
                    "url": { "type": "string", "description": "新 URL（可选）" }
                },
                "required": ["node_id"]
            }),
        ),
        tool(
            "magic_move_bookmark",
            "移动书签到其他文件夹",
            json!({
                "type": "object",
                "properties": {
                    "node_id": { "type": "string", "description": "书签节点 ID" },
                    "new_parent_id": { "type": "string", "description": "目标文件夹 ID" }
                },
                "required": ["node_id", "new_parent_id"]
            }),
        ),
        tool(
            "magic_remove_bookmark",
            "删除书签",
            json!({
                "type": "object",
                "properties": {
                    "node_id": { "type": "string", "description": "书签节点 ID" }
                },
                "required": ["node_id"]
            }),
        ),
        tool(
            "magic_bookmark_current_tab",
            "收藏当前标签页为书签",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" },
                    "parent_id": { "type": "string", "description": "父文件夹 ID（可选）" }
                }
            }),
        ),
        tool(
            "magic_unbookmark_current_tab",
            "取消收藏当前标签页",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" }
                }
            }),
        ),
        tool(
            "magic_is_current_tab_bookmarked",
            "检查当前标签页是否已收藏",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_export_bookmark_state",
            "导出书签状态",
            json!({
                "type": "object",
                "properties": {
                    "environment_id": { "type": "string", "description": "环境 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        // ── Cookie 管理 (2) ──
        tool(
            "magic_get_managed_cookies",
            "获取浏览器管理的 Cookie 列表",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_export_cookie_state",
            "导出 Cookie 状态",
            json!({
                "type": "object",
                "properties": {
                    "mode": { "type": "string", "description": "导出模式" },
                    "url": { "type": "string", "description": "限定 URL（可选）" },
                    "environment_id": { "type": "string", "description": "环境 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["mode"]
            }),
        ),
        // ── 扩展管理 (5) ──
        tool(
            "magic_get_managed_extensions",
            "获取所有已安装的浏览器扩展信息",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将扩展列表 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_trigger_extension_action",
            "触发扩展图标动作（模拟点击扩展图标）",
            json!({
                "type": "object",
                "properties": {
                    "extension_id": { "type": "string", "description": "32位扩展 ID" },
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" }
                },
                "required": ["extension_id"]
            }),
        ),
        tool(
            "magic_close_extension_popup",
            "关闭当前打开的扩展弹窗",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" }
                }
            }),
        ),
        tool(
            "magic_enable_extension",
            "启用浏览器扩展（运行时生效，不持久化）",
            json!({
                "type": "object",
                "properties": {
                    "extension_id": { "type": "string", "description": "32位扩展 ID" }
                },
                "required": ["extension_id"]
            }),
        ),
        tool(
            "magic_disable_extension",
            "禁用浏览器扩展（运行时生效，不持久化）",
            json!({
                "type": "object",
                "properties": {
                    "extension_id": { "type": "string", "description": "32位扩展 ID" }
                },
                "required": ["extension_id"]
            }),
        ),
        // ── 同步控制 (4) ──
        tool(
            "magic_toggle_sync_mode",
            "切换窗口同步模式（master/slave/disabled）",
            json!({
                "type": "object",
                "properties": {
                    "role": { "type": "string", "description": "同步角色: master, slave, disabled" },
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" },
                    "session_id": { "type": "string", "description": "同步会话 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["role"]
            }),
        ),
        tool(
            "magic_get_sync_mode",
            "获取当前同步模式",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_is_master",
            "检查当前浏览器是否为同步主控",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_sync_status",
            "获取同步状态详情",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        // ── 截图 (1) ──
        tool(
            "magic_capture_app_shell",
            "带壳截图（截取整个浏览器窗口，包含工具栏和标签页）",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器 ID（可选）" },
                    "format": { "type": "string", "enum": ["png", "jpeg"], "description": "图片格式，默认 png" },
                    "output_path": { "type": "string", "description": "保存路径（可选，默认自动生成）" },
                    "output_key_file_path": { "type": "string", "description": "将文件路径存入此变量名" }
                }
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// App Data 工具（20 个）
// ═══════════════════════════════════════════════════════════════════════════

fn app_tools() -> Vec<Value> {
    vec![
        // ── Profile 操作 (9) ──
        tool(
            "app_list_profiles",
            "列出 profile 列表，支持分组和关键字过滤",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "按分组 ID 过滤（可选）" },
                    "keyword": { "type": "string", "description": "按名称关键字搜索（可选）" },
                    "include_deleted": { "type": "boolean", "description": "是否包含已删除的 profile，默认 false" }
                }
            }),
        ),
        tool(
            "app_get_profile",
            "按 ID 获取 profile 详细信息",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "Profile ID" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_create_profile",
            "创建新的 profile",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Profile 名称" },
                    "group_id": { "type": "string", "description": "所属分组 ID（可选）" },
                    "note": { "type": "string", "description": "备注（可选）" }
                },
                "required": ["name"]
            }),
        ),
        tool(
            "app_update_profile",
            "更新 profile 基本信息",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "Profile ID" },
                    "name": { "type": "string", "description": "新名称（可选）" },
                    "group_id": { "type": "string", "description": "新分组 ID（可选）" },
                    "note": { "type": "string", "description": "新备注（可选）" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_delete_profile",
            "删除 profile（可能需要用户确认）",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "要删除的 Profile ID" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_start_profile",
            "启动 profile 的浏览器环境",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "Profile ID" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_stop_profile",
            "停止 profile 的浏览器环境",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "Profile ID" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_get_running_profiles",
            "获取所有正在运行的 profile 列表（含端口信息）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "app_get_current_profile",
            "获取当前自动化正在操作的 profile 信息",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        // ── 分组操作 (6) ──
        tool(
            "app_list_groups",
            "列出所有 profile 分组",
            json!({
                "type": "object",
                "properties": {
                    "include_deleted": { "type": "boolean", "description": "是否包含已删除分组，默认 false" }
                }
            }),
        ),
        tool(
            "app_get_group",
            "按 ID 获取分组信息",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "分组 ID" }
                },
                "required": ["group_id"]
            }),
        ),
        tool(
            "app_create_group",
            "创建新分组",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "分组名称" },
                    "color": { "type": "string", "description": "分组颜色（十六进制，如 #FF5733）（可选）" }
                },
                "required": ["name"]
            }),
        ),
        tool(
            "app_update_group",
            "更新分组信息",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "分组 ID" },
                    "name": { "type": "string", "description": "新名称（可选）" },
                    "color": { "type": "string", "description": "新颜色（可选）" }
                },
                "required": ["group_id"]
            }),
        ),
        tool(
            "app_delete_group",
            "删除分组（可能需要用户确认）",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "要删除的分组 ID" }
                },
                "required": ["group_id"]
            }),
        ),
        tool(
            "app_get_profiles_in_group",
            "获取指定分组内的所有 profile",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "分组 ID" }
                },
                "required": ["group_id"]
            }),
        ),
        // ── 代理操作 (2) ──
        tool(
            "app_list_proxies",
            "列出所有代理",
            json!({
                "type": "object",
                "properties": {
                    "keyword": { "type": "string", "description": "按名称搜索（可选）" },
                    "protocol": { "type": "string", "description": "按协议过滤: http, https, socks5（可选）" }
                }
            }),
        ),
        tool(
            "app_get_proxy",
            "按 ID 获取代理详情",
            json!({
                "type": "object",
                "properties": {
                    "proxy_id": { "type": "string", "description": "代理 ID" }
                },
                "required": ["proxy_id"]
            }),
        ),
        // ── 插件操作 (2) ──
        tool(
            "app_list_plugins",
            "列出所有已安装的插件包",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "app_get_plugin",
            "按 ID 获取插件包详情",
            json!({
                "type": "object",
                "properties": {
                    "plugin_id": { "type": "string", "description": "插件包 ID" }
                },
                "required": ["plugin_id"]
            }),
        ),
        // ── 会话查询 (1) ──
        tool(
            "app_get_engine_sessions",
            "获取所有引擎会话信息（运行中的浏览器进程）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// File I/O 工具（6 个）
// ═══════════════════════════════════════════════════════════════════════════

fn file_tools() -> Vec<Value> {
    vec![
        tool(
            "file_read",
            "读取文本文件内容（最大 10MB）",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "文件绝对路径" }
                },
                "required": ["path"]
            }),
        ),
        tool(
            "file_write",
            "写入文本到文件（覆盖已有内容）",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "文件绝对路径" },
                    "content": { "type": "string", "description": "要写入的文本内容" }
                },
                "required": ["path", "content"]
            }),
        ),
        tool(
            "file_append",
            "追加文本到文件末尾",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "文件绝对路径" },
                    "content": { "type": "string", "description": "要追加的文本内容" }
                },
                "required": ["path", "content"]
            }),
        ),
        tool(
            "file_list_dir",
            "列出目录内容",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "目录绝对路径" }
                },
                "required": ["path"]
            }),
        ),
        tool(
            "file_exists",
            "检查文件或目录是否存在",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "文件或目录的绝对路径" }
                },
                "required": ["path"]
            }),
        ),
        tool(
            "file_mkdir",
            "递归创建目录",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "要创建的目录绝对路径" }
                },
                "required": ["path"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Dialog 工具（6 个）—— 通过前端 UI 弹窗实现
// ═══════════════════════════════════════════════════════════════════════════

fn dialog_tools() -> Vec<Value> {
    vec![
        tool(
            "dialog_message",
            "向用户显示消息弹窗",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "消息内容" },
                    "level": { "type": "string", "enum": ["info", "warning", "error", "success"], "description": "消息级别，默认 info" }
                },
                "required": ["message"]
            }),
        ),
        tool(
            "dialog_confirm",
            "向用户展示确认弹窗（是/否选择）",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "确认消息" }
                },
                "required": ["message"]
            }),
        ),
        tool(
            "dialog_input",
            "向用户展示输入弹窗",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "提示消息" },
                    "label": { "type": "string", "description": "输入框标签（可选）" },
                    "default_value": { "type": "string", "description": "输入框默认值（可选）" },
                    "placeholder": { "type": "string", "description": "输入框占位符（可选）" }
                },
                "required": ["message"]
            }),
        ),
        tool(
            "dialog_save_file",
            "打开文件保存对话框，让用户选择保存位置",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "对话框标题（可选）" },
                    "default_name": { "type": "string", "description": "默认文件名（可选）" },
                    "filters": { "type": "array", "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string", "description": "过滤器名称（如 Text Files）" },
                            "extensions": { "type": "array", "items": { "type": "string" }, "description": "扩展名列表（如 [\"txt\", \"md\"]）" }
                        }
                    }, "description": "文件类型过滤器（可选）" },
                    "content": { "type": "string", "description": "要保存的文件内容（可选，若提供则自动写入所选路径）" }
                }
            }),
        ),
        tool(
            "dialog_open_file",
            "打开文件选择对话框，让用户选择文件",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "对话框标题（可选）" },
                    "multiple": { "type": "boolean", "description": "是否允许多选，默认 false" },
                    "filters": { "type": "array", "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string", "description": "过滤器名称" },
                            "extensions": { "type": "array", "items": { "type": "string" }, "description": "扩展名列表" }
                        }
                    }, "description": "文件类型过滤器（可选）" }
                }
            }),
        ),
        tool(
            "dialog_select_folder",
            "打开文件夹选择对话框，让用户选择目录",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "对话框标题（可选）" }
                }
            }),
        ),
    ]
}
