//! AI 工具 JSON Schema 定义
//!
//! 所有工具的 OpenAI function calling schema 按类别组织。
//! 工具名即为 ScriptStep 的 kind 值（cdp_/magic_ 前缀的工具）
//! 或独立执行器路由键（app_/file_/dialog_ 前缀的工具）。

use serde_json::{json, Value};

/// 构建单个工具的 OpenAI function schema
/// 自动注入 `additionalProperties: false`（OpenAI strict mode 推荐）
fn tool(name: &str, description: &str, parameters: Value) -> Value {
    let mut params = parameters;
    if params.is_object() {
        params["additionalProperties"] = json!(false);
    }
    json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": params
        }
    })
}

/// 返回所有工具定义
pub fn all_tool_definitions() -> Vec<Value> {
    let mut defs = Vec::with_capacity(194);
    defs.extend(utility_tools());
    defs.extend(cdp_tools());
    defs.extend(magic_tools());
    defs.extend(app_tools());
    defs.extend(auto_tools());
    defs.extend(file_tools());
    defs.extend(dialog_tools());
    defs.extend(captcha_tools());
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
        tool(
            "submit_result",
            "提交最终结果并结束执行。必须通过此工具提交结果，result 参数应只包含纯净的结果数据，不要包含解释、前缀或标记。",
            json!({
                "type": "object",
                "properties": {
                    "result": { "type": "string", "description": "纯净的最终结果文本，不要包含任何多余说明" }
                },
                "required": ["result"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// CDP 工具（58 个）
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
            "cdp_query_all",
            "批量提取所有匹配元素的文本或属性，返回 JSON 数组。比多次调用 cdp_get_text 更高效，适合提取列表、表格等重复元素",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "元素选择器" },
                    "selector_type": selector_type_prop,
                    "extract": {
                        "type": "string",
                        "description": "提取内容：text（默认，innerText）/ html（outerHTML）/ 属性名（如 href、src、data-id）"
                    },
                    "output_key": { "type": "string", "description": "将结果 JSON 数组存入此变量名" }
                },
                "required": ["selector"]
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
        // ── CDP 信息查询工具 ──
        tool(
            "cdp_get_browser_version",
            "获取浏览器版本信息（产品名、版本号、User-Agent、JS/协议版本）",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将版本信息 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_browser_command_line",
            "获取浏览器启动时的命令行参数",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将命令行参数 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_window_for_target",
            "获取目标所在浏览器窗口的信息（windowId、bounds）",
            json!({
                "type": "object",
                "properties": {
                    "target_id": { "type": "string", "description": "目标 ID（可选，默认当前目标）" },
                    "output_key": { "type": "string", "description": "将窗口信息 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_layout_metrics",
            "获取页面布局指标（layoutViewport、visualViewport、contentSize）",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将布局指标 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_document",
            "获取 DOM 根节点树（可控制深度和 Shadow DOM 穿透）",
            json!({
                "type": "object",
                "properties": {
                    "depth": { "type": "integer", "description": "遍历深度，-1 表示全部，默认 1" },
                    "pierce": { "type": "boolean", "description": "是否穿透 Shadow DOM，默认 false" },
                    "output_key": { "type": "string", "description": "将 DOM 树 JSON 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_full_ax_tree",
            "获取完整的无障碍树（Accessibility Tree），用于理解页面语义结构",
            json!({
                "type": "object",
                "properties": {
                    "depth": { "type": "integer", "description": "遍历深度（可选，不填则返回全部）" },
                    "output_key": { "type": "string", "description": "将无障碍树 JSON 存入此变量名" }
                }
            }),
        ),
        // ── Cookie & 存储 (7) ──
        tool(
            "cdp_get_cookies",
            "获取当前页面或指定 URL 的 cookies",
            json!({
                "type": "object",
                "properties": {
                    "urls": { "type": "array", "items": { "type": "string" }, "description": "要获取 cookie 的 URL 列表（可选，不传则返回当前页面 cookies）" },
                    "output_key": { "type": "string", "description": "将 cookie JSON 数组存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_set_cookie",
            "设置单个 cookie",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Cookie 名称" },
                    "value": { "type": "string", "description": "Cookie 值" },
                    "domain": { "type": "string", "description": "Cookie 域名（可选）" },
                    "path": { "type": "string", "description": "Cookie 路径（可选）" },
                    "expires": { "type": "number", "description": "过期时间戳（可选，Unix 秒）" },
                    "http_only": { "type": "boolean", "description": "是否 HttpOnly（可选）" },
                    "secure": { "type": "boolean", "description": "是否仅 HTTPS（可选）" }
                },
                "required": ["name", "value"]
            }),
        ),
        tool(
            "cdp_delete_cookies",
            "删除匹配的 cookies",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "要删除的 Cookie 名称" },
                    "domain": { "type": "string", "description": "Cookie 域名（可选）" },
                    "path": { "type": "string", "description": "Cookie 路径（可选）" }
                },
                "required": ["name"]
            }),
        ),
        tool(
            "cdp_get_local_storage",
            "读取当前页面 localStorage 的指定 key 或全部",
            json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "要读取的 key（可选，不传返回全部）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_set_local_storage",
            "写入当前页面 localStorage",
            json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "localStorage key" },
                    "value": { "type": "string", "description": "要写入的值" }
                },
                "required": ["key", "value"]
            }),
        ),
        tool(
            "cdp_get_session_storage",
            "读取当前页面 sessionStorage 的指定 key 或全部",
            json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "要读取的 key（可选，不传返回全部）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_clear_storage",
            "清除指定来源的存储数据（cookies/localStorage/sessionStorage/cache 等）",
            json!({
                "type": "object",
                "properties": {
                    "origin": { "type": "string", "description": "来源 URL（可选，默认当前页面）" },
                    "storage_types": { "type": "string", "description": "要清除的存储类型，逗号分隔（如 cookies,local_storage,session_storage）" }
                }
            }),
        ),
        // ── 页面信息 & 导航 (3) ──
        tool(
            "cdp_get_current_url",
            "获取当前页面 URL",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将当前 URL 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_page_source",
            "获取页面或指定元素的 HTML 源码",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "CSS 选择器（可选，不传返回整个页面 HTML）" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                    "output_key": { "type": "string", "description": "将 HTML 源码存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_wait_for_navigation",
            "等待页面导航完成（适用于点击后的 SPA 跳转或表单提交）",
            json!({
                "type": "object",
                "properties": {
                    "timeout_ms": { "type": "integer", "description": "超时时间（毫秒），默认 30000" }
                }
            }),
        ),
        // ── 设备模拟 (3) ──
        tool(
            "cdp_emulate_device",
            "模拟移动设备视口和 User-Agent",
            json!({
                "type": "object",
                "properties": {
                    "width": { "type": "integer", "description": "视口宽度" },
                    "height": { "type": "integer", "description": "视口高度" },
                    "device_scale_factor": { "type": "number", "description": "设备缩放因子（可选，默认 1）" },
                    "mobile": { "type": "boolean", "description": "是否为移动设备（可选，默认 false）" },
                    "user_agent": { "type": "string", "description": "自定义 User-Agent（可选）" }
                },
                "required": ["width", "height"]
            }),
        ),
        tool(
            "cdp_set_geolocation",
            "模拟地理位置",
            json!({
                "type": "object",
                "properties": {
                    "latitude": { "type": "number", "description": "纬度" },
                    "longitude": { "type": "number", "description": "经度" },
                    "accuracy": { "type": "number", "description": "精度（米）（可选，默认 1）" }
                },
                "required": ["latitude", "longitude"]
            }),
        ),
        tool(
            "cdp_set_user_agent",
            "运行时修改 User-Agent",
            json!({
                "type": "object",
                "properties": {
                    "user_agent": { "type": "string", "description": "新的 User-Agent 字符串" },
                    "platform": { "type": "string", "description": "平台标识（可选，如 Win32, MacIntel）" }
                },
                "required": ["user_agent"]
            }),
        ),
        // ── 元素操作 & 输入 (6) ──
        tool(
            "cdp_get_element_box",
            "获取元素的包围盒坐标（用于精确定位和截图裁剪）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "目标元素选择器" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                    "output_key": { "type": "string", "description": "将 {x,y,width,height} JSON 存入此变量名" }
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_highlight_element",
            "高亮显示页面元素（调试辅助，截图时标记目标）",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "目标元素选择器" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                    "color": { "type": "string", "description": "高亮颜色（可选，默认 red，支持 CSS 颜色值）" },
                    "duration_ms": { "type": "integer", "description": "高亮持续时间（毫秒，可选，默认 3000）" }
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_mouse_move",
            "移动鼠标到指定坐标（用于 hover 效果、拖拽前置）",
            json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "目标 X 坐标" },
                    "y": { "type": "number", "description": "目标 Y 坐标" }
                },
                "required": ["x", "y"]
            }),
        ),
        tool(
            "cdp_drag_and_drop",
            "拖拽元素从 A 到 B（支持选择器或坐标）",
            json!({
                "type": "object",
                "properties": {
                    "from_selector": { "type": "string", "description": "源元素选择器（与 from_x/from_y 二选一）" },
                    "to_selector": { "type": "string", "description": "目标元素选择器（与 to_x/to_y 二选一）" },
                    "from_x": { "type": "number", "description": "起始 X 坐标" },
                    "from_y": { "type": "number", "description": "起始 Y 坐标" },
                    "to_x": { "type": "number", "description": "目标 X 坐标" },
                    "to_y": { "type": "number", "description": "目标 Y 坐标" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" }
                }
            }),
        ),
        tool(
            "cdp_select_option",
            "选择 <select> 下拉框的选项",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "select 元素选择器" },
                    "value": { "type": "string", "description": "要选中的 value（与 index 二选一）" },
                    "index": { "type": "integer", "description": "要选中的选项索引，0-based（与 value 二选一）" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" },
                    "output_key": { "type": "string", "description": "将选中值存入此变量名" }
                },
                "required": ["selector"]
            }),
        ),
        tool(
            "cdp_check_checkbox",
            "勾选/取消勾选 checkbox 或 radio",
            json!({
                "type": "object",
                "properties": {
                    "selector": { "type": "string", "description": "checkbox/radio 元素选择器" },
                    "checked": { "type": "boolean", "description": "目标状态：true=勾选，false=取消，默认 true" },
                    "selector_type": { "type": "string", "enum": ["css", "xpath", "text"], "description": "选择器类型，默认 css" }
                },
                "required": ["selector"]
            }),
        ),
        // ── 网络 & 导出 (3) ──
        tool(
            "cdp_block_urls",
            "屏蔽匹配模式的 URL（如广告、追踪器），支持 * 通配符",
            json!({
                "type": "object",
                "properties": {
                    "patterns": { "type": "array", "items": { "type": "string" }, "description": "URL 模式列表，支持 * 通配符" }
                },
                "required": ["patterns"]
            }),
        ),
        tool(
            "cdp_pdf",
            "将当前页面导出为 PDF",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "保存路径（可选，不传则返回 base64）" },
                    "landscape": { "type": "boolean", "description": "横向打印，默认 false" },
                    "scale": { "type": "number", "description": "缩放比例（可选，默认 1）" },
                    "paper_width": { "type": "number", "description": "纸张宽度（英寸，可选）" },
                    "paper_height": { "type": "number", "description": "纸张高度（英寸，可选）" },
                    "output_key": { "type": "string", "description": "将文件路径或 base64 存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_intercept_request",
            "拦截并修改网络请求（block=屏蔽, mock=模拟返回, modify=修改 headers）",
            json!({
                "type": "object",
                "properties": {
                    "url_pattern": { "type": "string", "description": "URL 匹配模式，支持 * 通配符" },
                    "action": { "type": "string", "enum": ["block", "mock", "modify"], "description": "拦截动作" },
                    "headers": { "type": "object", "description": "要修改/添加的 headers（modify 模式）" },
                    "body": { "type": "string", "description": "模拟返回的 body（mock 模式）" },
                    "status": { "type": "integer", "description": "模拟返回的状态码（mock 模式，默认 200）" }
                },
                "required": ["url_pattern", "action"]
            }),
        ),
        // ── 事件缓冲 (2) ──
        tool(
            "cdp_get_console_logs",
            "获取浏览器控制台日志（最近 N 条）",
            json!({
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "description": "返回条数上限（可选，默认 50）" },
                    "level": { "type": "string", "enum": ["log", "warn", "error", "info"], "description": "按日志级别过滤（可选）" },
                    "output_key": { "type": "string", "description": "将日志 JSON 数组存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_network_requests",
            "获取最近的网络请求记录",
            json!({
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "description": "返回条数上限（可选，默认 20）" },
                    "url_pattern": { "type": "string", "description": "URL 过滤模式（可选）" },
                    "output_key": { "type": "string", "description": "将请求记录 JSON 数组存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_get_response_body",
            "获取网络请求的响应体（JSON/文本内容）。通过 JS 拦截 fetch/XHR 实现，需在页面发起请求后调用。适合提取 SPA 应用的 API 返回数据，比截图更高效",
            json!({
                "type": "object",
                "properties": {
                    "url_filter": { "type": "string", "description": "URL 关键词过滤（包含匹配），不传则返回所有已捕获响应" },
                    "limit": { "type": "integer", "description": "最多返回条数，默认 10" },
                    "output_key": { "type": "string", "description": "将结果 JSON 数组存入此变量名" }
                }
            }),
        ),
        tool(
            "cdp_handle_dialog",
            "处理浏览器 JavaScript 对话框（alert / confirm / prompt）。accept 接受，dismiss 取消。对于 prompt 类型可通过 prompt_text 设置输入文本",
            json!({
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["accept", "dismiss"],
                        "description": "accept=接受/确认, dismiss=取消/关闭"
                    },
                    "prompt_text": {
                        "type": "string",
                        "description": "prompt 对话框的输入文本（仅 action=accept 时有效）"
                    },
                    "output_key": { "type": "string", "description": "将对话框消息文本存入此变量名" }
                },
                "required": ["action"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Magic Controller 工具（53 个）
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
            "magic_safe_quit",
            "安全退出整个浏览器应用（关闭所有窗口和标签页）",
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
            "通过 Magic Controller 输入文本（模拟键盘输入）。前置条件：目标输入区域必须已处于焦点状态（先用 cdp_click 点击输入框聚焦）",
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
        // ── 窗口状态查询 (4) ──
        tool(
            "magic_get_maximized",
            "查询窗口是否处于最大化状态",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将 true/false 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_minimized",
            "查询窗口是否处于最小化状态",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将 true/false 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_fullscreen",
            "查询窗口是否处于全屏状态",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将 true/false 存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_get_window_state",
            "一次性获取窗口完整状态（bounds + maximized + minimized + fullscreen）",
            json!({
                "type": "object",
                "properties": {
                    "output_key": { "type": "string", "description": "将完整窗口状态 JSON 存入此变量名" }
                }
            }),
        ),
        // ── AI Agent 语义化操作 (13) ──
        tool(
            "magic_get_browser",
            "根据 browser_id 获取指定浏览器窗口信息",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "浏览器窗口 ID" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["browser_id"]
            }),
        ),
        tool(
            "magic_click_at",
            "坐标系点击，将虚拟坐标映射到浏览器窗口像素坐标注入鼠标事件",
            json!({
                "type": "object",
                "properties": {
                    "grid": { "type": "string", "description": "虚拟坐标系尺寸，格式 '宽,高'，如 '1200,800'" },
                    "position": { "type": "string", "description": "目标点坐标，格式 'x,y'，如 '125,60'" },
                    "button": { "type": "string", "enum": ["left", "right", "middle"], "description": "鼠标按钮" },
                    "modifiers": { "type": "array", "items": { "type": "string", "enum": ["shift", "ctrl", "alt", "meta"] }, "description": "修饰键列表" },
                    "click_count": { "type": "integer", "description": "点击次数，1=单击 2=双击 3=三击" },
                    "action": { "type": "string", "enum": ["click", "down", "up", "move"], "description": "动作类型" },
                    "browser_id": { "type": "integer", "description": "目标窗口 ID，省略则使用活动窗口" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["grid", "position"]
            }),
        ),
        tool(
            "magic_click_element",
            "语义化点击浏览器 Chrome UI 元素（工具栏/标签栏/菜单），无需截图",
            json!({
                "type": "object",
                "properties": {
                    "target": { "type": "string", "description": "目标元素标识：back_button, forward_button, reload_button, bookmark_star, avatar_button, app_menu_button, tab_search_button, location_bar, new_tab_button, tab:{index}, tab_close:{index}, app_menu_item:{command_id}" },
                    "browser_id": { "type": "integer", "description": "目标窗口 ID，省略则使用活动窗口" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["target"]
            }),
        ),
        tool(
            "magic_get_ui_elements",
            "查询浏览器 UI 当前状态（工具栏按钮、标签页列表、菜单），供 Agent 决策",
            json!({
                "type": "object",
                "properties": {
                    "browser_id": { "type": "integer", "description": "目标窗口 ID，省略则使用活动窗口" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_navigate_to",
            "导航到指定 URL（使用 Magic Controller，比 CDP 更可靠）",
            json!({
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "目标 URL" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["url"]
            }),
        ),
        tool(
            "magic_query_dom",
            "DOM 元素查询，返回匹配元素候选列表（用于后续 click_dom/fill_dom 定位）",
            json!({
                "type": "object",
                "properties": {
                    "by": { "type": "string", "enum": ["css", "xpath", "text", "aria", "role", "placeholder", "name", "search", "idx"], "description": "选择器类型" },
                    "selector": { "type": "string", "description": "选择器值" },
                    "match": { "type": "string", "enum": ["contains", "icontains", "exact", "regex", "starts_with", "ends_with"], "description": "文本匹配模式" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "limit": { "type": "integer", "description": "返回结果数量上限" },
                    "visible_only": { "type": "boolean", "description": "只返回可见元素" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["by", "selector"]
            }),
        ),
        tool(
            "magic_click_dom",
            "点击 DOM 元素（支持多种选择器方式，比 CDP 更稳定）",
            json!({
                "type": "object",
                "properties": {
                    "by": { "type": "string", "enum": ["css", "xpath", "text", "aria", "role", "placeholder", "name", "search", "idx"], "description": "选择器类型" },
                    "selector": { "type": "string", "description": "选择器值" },
                    "match": { "type": "string", "enum": ["contains", "icontains", "exact", "regex", "starts_with", "ends_with"], "description": "文本匹配模式" },
                    "index": { "type": "integer", "description": "多个匹配结果时选取的索引（从 0 开始）" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "visible_only": { "type": "boolean", "description": "只操作可见元素" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["by", "selector"]
            }),
        ),
        tool(
            "magic_fill_dom",
            "填写表单元素（支持清空后输入，比 CDP 更稳定）",
            json!({
                "type": "object",
                "properties": {
                    "by": { "type": "string", "enum": ["css", "xpath", "text", "aria", "role", "placeholder", "name", "search", "idx"], "description": "选择器类型" },
                    "selector": { "type": "string", "description": "选择器值" },
                    "value": { "type": "string", "description": "要填写的内容" },
                    "match": { "type": "string", "enum": ["contains", "icontains", "exact", "regex", "starts_with", "ends_with"], "description": "文本匹配模式" },
                    "index": { "type": "integer", "description": "多个匹配结果时选取的索引（从 0 开始）" },
                    "clear": { "type": "boolean", "description": "填写前是否先清空，默认 true" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "visible_only": { "type": "boolean", "description": "只操作可见元素" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["by", "selector", "value"]
            }),
        ),
        tool(
            "magic_send_keys",
            "键盘输入（支持特殊键/快捷键组合/文字输入）",
            json!({
                "type": "object",
                "properties": {
                    "keys": { "type": "array", "items": { "type": "string" }, "description": "按键序列，支持 Enter、Tab、Escape、ArrowDown、ctrl+a 等" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["keys"]
            }),
        ),
        tool(
            "magic_get_page_info",
            "获取页面综合状态信息（URL、标题、加载状态、标签页列表等）",
            json!({
                "type": "object",
                "properties": {
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_scroll",
            "页面滚动（按方向/距离，或滚动到指定元素）",
            json!({
                "type": "object",
                "properties": {
                    "direction": { "type": "string", "enum": ["up", "down", "left", "right"], "description": "滚动方向" },
                    "distance": { "type": "integer", "description": "滚动距离（像素）" },
                    "by": { "type": "string", "enum": ["css", "xpath", "text", "aria", "role", "placeholder", "name", "search", "idx"], "description": "元素定位方式（滚动到元素时使用）" },
                    "selector": { "type": "string", "description": "目标元素选择器" },
                    "index": { "type": "integer", "description": "多匹配时选择索引" },
                    "visible_only": { "type": "boolean", "description": "只操作可见元素" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        tool(
            "magic_set_dock_icon_text",
            "设置 Dock 图标文字标签（macOS）",
            json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "显示在 Dock 图标上的文字" },
                    "color": { "type": "string", "description": "文字颜色（十六进制，如 #FF0000）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                },
                "required": ["text"]
            }),
        ),
        tool(
            "magic_get_page_content",
            "获取页面语义快照（结构化 DOM 树、可交互元素、文本内容等）",
            json!({
                "type": "object",
                "properties": {
                    "mode": { "type": "string", "enum": ["summary", "interactive", "content", "a11y", "full"], "description": "快照模式：summary=摘要, interactive=可交互元素, content=文本内容, a11y=无障碍树, full=完整" },
                    "format": { "type": "string", "enum": ["json", "text"], "description": "输出格式" },
                    "tab_id": { "type": "integer", "description": "目标标签页 ID（可选）" },
                    "viewport_only": { "type": "boolean", "description": "只返回视口内元素" },
                    "max_elements": { "type": "integer", "description": "最大元素数量" },
                    "max_text_length": { "type": "integer", "description": "最大文本长度" },
                    "max_depth": { "type": "integer", "description": "DOM 最大深度" },
                    "include_hidden": { "type": "boolean", "description": "是否包含隐藏元素" },
                    "regions": { "type": "array", "items": { "type": "string" }, "description": "只提取指定区域（CSS 选择器列表）" },
                    "exclude_regions": { "type": "array", "items": { "type": "string" }, "description": "排除指定区域（CSS 选择器列表）" },
                    "output_key": { "type": "string", "description": "将结果存入此变量名" }
                }
            }),
        ),
        // ── Cookie 导入 (1) ──
        tool(
            "magic_import_cookies",
            "从 JSON 数据批量导入 cookies 到浏览器",
            json!({
                "type": "object",
                "properties": {
                    "cookies": { "type": "array", "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string" },
                            "value": { "type": "string" },
                            "domain": { "type": "string" },
                            "path": { "type": "string" },
                            "expires": { "type": "number" },
                            "httpOnly": { "type": "boolean" },
                            "secure": { "type": "boolean" }
                        },
                        "required": ["name", "value"]
                    }, "description": "Cookie 数组" },
                    "output_key": { "type": "string", "description": "将导入数量存入此变量名" }
                },
                "required": ["cookies"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// App Data 工具（26 个）— 不含 app_run_script（由 auto_run_script 覆盖）
// ═══════════════════════════════════════════════════════════════════════════

fn app_tools() -> Vec<Value> {
    vec![
        // ── Profile 操作 (10) ──
        tool(
            "app_list_profiles",
            "列出 profile 列表，支持分组和关键字过滤",
            json!({
                "type": "object",
                "properties": {
                    "group_id": { "type": "string", "description": "按分组名称过滤（兼容历史字段名， 可选）" },
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
            "app_set_chat_active_profile",
            "仅 AI Chat 使用：将当前聊天会话的工具目标环境切换到指定 profile。必须先切换，再对该环境执行 cdp_* / magic_* 工具。",
            json!({
                "type": "object",
                "properties": {
                    "profile_id": { "type": "string", "description": "目标 Profile ID，必须已关联到当前聊天会话" }
                },
                "required": ["profile_id"]
            }),
        ),
        tool(
            "app_get_current_profile",
            "获取当前工具目标环境的 profile 信息。AI Chat 中返回当前聊天会话绑定的工具目标环境；自动化脚本中返回当前运行环境。",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        // ── 机型预设操作 (5) ──
        tool(
            "app_list_device_presets",
            "列出机型预设，支持按平台过滤",
            json!({
                "type": "object",
                "properties": {
                    "platform": { "type": "string", "description": "按平台过滤，可选值通常为 windows / macos / linux / android / ios" }
                }
            }),
        ),
        tool(
            "app_get_device_preset",
            "按 ID 获取机型预设详情",
            json!({
                "type": "object",
                "properties": {
                    "preset_id": { "type": "string", "description": "机型预设 ID" }
                },
                "required": ["preset_id"]
            }),
        ),
        tool(
            "app_create_device_preset",
            "创建新的机型预设",
            json!({
                "type": "object",
                "properties": {
                    "label": { "type": "string", "description": "机型名称" },
                    "platform": { "type": "string", "description": "平台，如 windows / macos / linux / android / ios" },
                    "platform_version": { "type": "string", "description": "平台版本，如 14.0.0" },
                    "viewport_width": { "type": "integer", "description": "默认视口宽度" },
                    "viewport_height": { "type": "integer", "description": "默认视口高度" },
                    "device_scale_factor": { "type": "number", "description": "默认 DPR / 设备像素比" },
                    "touch_points": { "type": "integer", "description": "最大触控点数" },
                    "custom_platform": { "type": "string", "description": "自定义 platform 字符串" },
                    "arch": { "type": "string", "description": "架构，如 x86 / arm" },
                    "bitness": { "type": "string", "description": "位数，如 64" },
                    "mobile": { "type": "boolean", "description": "是否为移动端机型" },
                    "form_factor": { "type": "string", "description": "形态，如 Desktop / Mobile / Tablet" },
                    "user_agent_template": { "type": "string", "description": "UA 模板，必须包含 {version}" },
                    "custom_gl_vendor": { "type": "string", "description": "WebGL vendor" },
                    "custom_gl_renderer": { "type": "string", "description": "WebGL renderer" },
                    "custom_cpu_cores": { "type": "integer", "description": "CPU 核心数" },
                    "custom_ram_gb": { "type": "integer", "description": "RAM 大小（GB）" }
                },
                "required": [
                    "label",
                    "platform",
                    "platform_version",
                    "viewport_width",
                    "viewport_height",
                    "device_scale_factor",
                    "touch_points",
                    "custom_platform",
                    "arch",
                    "bitness",
                    "mobile",
                    "form_factor",
                    "user_agent_template",
                    "custom_gl_vendor",
                    "custom_gl_renderer",
                    "custom_cpu_cores",
                    "custom_ram_gb"
                ]
            }),
        ),
        tool(
            "app_update_device_preset",
            "更新已有机型预设（可能需要用户确认）",
            json!({
                "type": "object",
                "properties": {
                    "preset_id": { "type": "string", "description": "机型预设 ID" },
                    "label": { "type": "string", "description": "机型名称" },
                    "platform": { "type": "string", "description": "平台，如 windows / macos / linux / android / ios" },
                    "platform_version": { "type": "string", "description": "平台版本，如 14.0.0" },
                    "viewport_width": { "type": "integer", "description": "默认视口宽度" },
                    "viewport_height": { "type": "integer", "description": "默认视口高度" },
                    "device_scale_factor": { "type": "number", "description": "默认 DPR / 设备像素比" },
                    "touch_points": { "type": "integer", "description": "最大触控点数" },
                    "custom_platform": { "type": "string", "description": "自定义 platform 字符串" },
                    "arch": { "type": "string", "description": "架构，如 x86 / arm" },
                    "bitness": { "type": "string", "description": "位数，如 64" },
                    "mobile": { "type": "boolean", "description": "是否为移动端机型" },
                    "form_factor": { "type": "string", "description": "形态，如 Desktop / Mobile / Tablet" },
                    "user_agent_template": { "type": "string", "description": "UA 模板，必须包含 {version}" },
                    "custom_gl_vendor": { "type": "string", "description": "WebGL vendor" },
                    "custom_gl_renderer": { "type": "string", "description": "WebGL renderer" },
                    "custom_cpu_cores": { "type": "integer", "description": "CPU 核心数" },
                    "custom_ram_gb": { "type": "integer", "description": "RAM 大小（GB）" }
                },
                "required": [
                    "preset_id",
                    "label",
                    "platform",
                    "platform_version",
                    "viewport_width",
                    "viewport_height",
                    "device_scale_factor",
                    "touch_points",
                    "custom_platform",
                    "arch",
                    "bitness",
                    "mobile",
                    "form_factor",
                    "user_agent_template",
                    "custom_gl_vendor",
                    "custom_gl_renderer",
                    "custom_cpu_cores",
                    "custom_ram_gb"
                ]
            }),
        ),
        tool(
            "app_delete_device_preset",
            "删除机型预设（可能需要用户确认）",
            json!({
                "type": "object",
                "properties": {
                    "preset_id": { "type": "string", "description": "要删除的机型预设 ID" }
                },
                "required": ["preset_id"]
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
                    "browser_bg_color": { "type": "string", "description": "分组默认背景色（十六进制，如 #FF5733，可选）" },
                    "toolbar_label_mode": { "type": "string", "description": "分组默认标识模式：id_only 或 group_name_and_id（可选）" }
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
                    "browser_bg_color": { "type": "string", "description": "新的默认背景色（十六进制，可选）" },
                    "toolbar_label_mode": { "type": "string", "description": "新的默认标识模式：id_only 或 group_name_and_id（可选）" }
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" }
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" },
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" },
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" }
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" }
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
                    "path": { "type": "string", "description": "app 内 fs 文件系统中的相对路径，`.` 表示 fs 根目录" }
                },
                "required": ["path"]
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Dialog 工具（13 个）—— 通过前端 UI 弹窗实现
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
        // ── 新增弹窗工具 ──────────────────────────────────────────────────────
        tool(
            "dialog_select",
            "向用户展示选项选择弹窗，支持单选/多选。适用于让用户从预定义选项中做出选择",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "提示信息（可选）" },
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": { "type": "string", "description": "显示文本" },
                                "value": { "type": "string", "description": "返回值" },
                                "description": { "type": "string", "description": "选项说明（可选）" }
                            },
                            "required": ["label", "value"]
                        },
                        "description": "选项列表（2-20个）"
                    },
                    "multi_select": { "type": "boolean", "description": "是否允许多选，默认 false" },
                    "max_select": { "type": "integer", "description": "多选时最大选择数（可选）" }
                },
                "required": ["options"]
            }),
        ),
        tool(
            "dialog_form",
            "向用户展示多字段表单弹窗，一次性收集多个输入。避免连续弹多个 dialog_input",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "表单顶部说明文字（可选）" },
                    "fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": { "type": "string", "description": "字段 key，用于返回值" },
                                "label": { "type": "string", "description": "显示标签" },
                                "type": { "type": "string", "enum": ["text", "number", "password", "textarea", "select", "checkbox", "date", "email", "url"], "description": "字段类型，默认 text" },
                                "required": { "type": "boolean", "description": "是否必填" },
                                "default_value": { "type": "string", "description": "默认值" },
                                "placeholder": { "type": "string", "description": "占位符" },
                                "options": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "label": { "type": "string" },
                                            "value": { "type": "string" }
                                        }
                                    },
                                    "description": "type=select 时的选项列表"
                                },
                                "validation": { "type": "string", "description": "正则校验表达式（可选）" },
                                "hint": { "type": "string", "description": "字段下方提示文字（可选）" }
                            },
                            "required": ["name", "label"]
                        },
                        "description": "表单字段列表（1-15个）"
                    },
                    "submit_label": { "type": "string", "description": "提交按钮文字，默认'确定'" }
                },
                "required": ["fields"]
            }),
        ),
        tool(
            "dialog_table",
            "向用户展示数据表格弹窗，可选择行。适用于展示抓取结果、对比数据等结构化信息",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "表格上方说明文字（可选）" },
                    "columns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": { "type": "string", "description": "数据字段名" },
                                "label": { "type": "string", "description": "列标题" },
                                "width": { "type": "integer", "description": "列宽 px（可选）" },
                                "align": { "type": "string", "enum": ["left", "center", "right"], "description": "对齐方式，默认 left" }
                            },
                            "required": ["key", "label"]
                        }
                    },
                    "rows": {
                        "type": "array",
                        "items": { "type": "object" },
                        "description": "行数据数组"
                    },
                    "selectable": { "type": "boolean", "description": "是否允许用户选择行，默认 false" },
                    "multi_select": { "type": "boolean", "description": "是否允许多选行，默认 false" },
                    "max_height": { "type": "integer", "description": "表格最大高度 px，默认 400" }
                },
                "required": ["columns", "rows"]
            }),
        ),
        tool(
            "dialog_image",
            "向用户展示图片预览弹窗，可附带输入框（如验证码输入）和自定义操作按钮",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "图片说明（可选）" },
                    "image": { "type": "string", "description": "base64 编码图片数据或本地文件路径" },
                    "image_format": { "type": "string", "enum": ["png", "jpeg", "webp", "gif"], "description": "图片格式，默认 png" },
                    "input_label": { "type": "string", "description": "如提供，显示文本输入框（如验证码输入）" },
                    "input_placeholder": { "type": "string", "description": "输入框占位符" },
                    "actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": { "type": "string", "description": "按钮文字" },
                                "value": { "type": "string", "description": "返回值" }
                            },
                            "required": ["label", "value"]
                        },
                        "description": "自定义操作按钮（可选）"
                    }
                },
                "required": ["image"]
            }),
        ),
        tool(
            "dialog_countdown",
            "向用户展示倒计时确认弹窗，用于危险操作前给用户反悔时间",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "message": { "type": "string", "description": "操作说明" },
                    "seconds": { "type": "integer", "description": "倒计时秒数（3-60）" },
                    "level": { "type": "string", "enum": ["info", "warning", "danger"], "description": "级别，默认 warning" },
                    "action_label": { "type": "string", "description": "倒计时结束后的操作按钮文字，默认'继续执行'" },
                    "auto_proceed": { "type": "boolean", "description": "倒计时结束后是否自动执行，默认 false" }
                },
                "required": ["message", "seconds"]
            }),
        ),
        tool(
            "dialog_toast",
            "显示通知提示（toast），可附带操作按钮。无按钮时不阻塞，有按钮时等待用户操作",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "通知标题（可选）" },
                    "message": { "type": "string", "description": "通知内容" },
                    "level": { "type": "string", "enum": ["info", "success", "warning", "error"], "description": "级别，默认 info" },
                    "duration_ms": { "type": "integer", "description": "自动消失时间（ms），0=不自动消失，默认 5000" },
                    "actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": { "type": "string", "description": "按钮文字" },
                                "value": { "type": "string", "description": "返回值" }
                            },
                            "required": ["label", "value"]
                        },
                        "description": "操作按钮列表（最多 2 个）"
                    },
                    "persistent": { "type": "boolean", "description": "是否持久显示直到用户操作，默认 false" }
                },
                "required": ["message"]
            }),
        ),
        tool(
            "dialog_markdown",
            "向用户展示 Markdown 格式的富文本弹窗，支持表格、代码块等。适用于展示报告、分析结果",
            json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "弹窗标题（可选）" },
                    "content": { "type": "string", "description": "Markdown 格式内容" },
                    "max_height": { "type": "integer", "description": "内容区最大高度 px，默认 500" },
                    "width": { "type": "string", "enum": ["sm", "md", "lg", "xl"], "description": "弹窗宽度，默认 md" },
                    "actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": { "type": "string", "description": "按钮文字" },
                                "value": { "type": "string", "description": "返回值" },
                                "variant": { "type": "string", "enum": ["default", "destructive", "outline"], "description": "按钮样式，默认 default" }
                            },
                            "required": ["label", "value"]
                        },
                        "description": "自定义按钮（可选，默认只有关闭）"
                    },
                    "copyable": { "type": "boolean", "description": "是否显示复制按钮，默认 false" }
                },
                "required": ["content"]
            }),
        ),
    ]
}

fn captcha_tools() -> Vec<Value> {
    vec![
        tool(
            "captcha_detect",
            "检测当前页面上的 CAPTCHA 类型和参数（sitekey 等），返回 JSON 包含 type / sitekey / params",
            json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        ),
        tool(
            "captcha_solve",
            "求解指定类型的 CAPTCHA 并返回 token。需要先配置求解服务。",
            json!({
                "type": "object",
                "properties": {
                    "captcha_type": {
                        "type": "string",
                        "enum": ["recaptcha_v2", "recaptcha_v3", "hcaptcha", "turnstile", "geetest", "funcaptcha", "image", "auto"],
                        "description": "CAPTCHA 类型，auto 自动检测"
                    },
                    "sitekey": { "type": "string", "description": "站点密钥（从 captcha_detect 获取）" },
                    "page_action": { "type": "string", "description": "reCAPTCHA v3 action 参数" },
                    "image_base64": { "type": "string", "description": "图片验证码的 base64 数据" }
                },
                "required": ["captcha_type"]
            }),
        ),
        tool(
            "captcha_inject_token",
            "将求解得到的 token 注入到页面对应的 CAPTCHA 表单字段中，并严格检查页面是否真正通过验证；仅注入成功但页面仍被拦截会返回失败",
            json!({
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["recaptcha", "hcaptcha", "turnstile"],
                        "description": "CAPTCHA 类型"
                    },
                    "token": { "type": "string", "description": "求解服务返回的 token" }
                },
                "required": ["type", "token"]
            }),
        ),
        tool(
            "captcha_solve_and_inject",
            "一键求解并注入：自动检测页面 CAPTCHA → 求解 → 注入 token → 严格验证页面是否真正通过；如果页面仍被验证码/风控拦截则返回失败",
            json!({
                "type": "object",
                "properties": {
                    "auto_submit": {
                        "type": "boolean",
                        "description": "注入后是否自动提交表单（默认 false）"
                    }
                },
                "required": []
            }),
        ),
        tool(
            "captcha_get_balance",
            "查询当前 CAPTCHA 求解服务的账户余额",
            json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        ),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto 工具（19 个）—— 自动化管理：脚本/运行/AI配置/CAPTCHA配置
// ═══════════════════════════════════════════════════════════════════════════

fn auto_tools() -> Vec<Value> {
    vec![
        // ── 脚本管理（6）──
        tool(
            "auto_list_scripts",
            "列出所有自动化脚本（返回 id、name、description、step_count、关联环境 ID 等摘要信息）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "auto_get_script",
            "获取自动化脚本完整详情，包含步骤定义、变量 schema、关联环境等",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "脚本 ID" }
                },
                "required": ["script_id"]
            }),
        ),
        tool(
            "auto_create_script",
            "创建新的自动化脚本",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "脚本名称" },
                    "description": { "type": "string", "description": "脚本描述（可选）" },
                    "steps": {
                        "type": "array",
                        "description": "步骤列表（可选，通常通过可视化编辑器配置）",
                        "items": { "type": "object" }
                    },
                    "associated_profile_ids": {
                        "type": "array",
                        "description": "关联的环境 ID 列表（可选）",
                        "items": { "type": "string" }
                    },
                    "ai_config_id": { "type": "string", "description": "使用的 AI 配置 ID（可选）" }
                },
                "required": ["name"]
            }),
        ),
        tool(
            "auto_update_script",
            "更新已有自动化脚本的名称、描述、关联环境等信息（未传入的字段保持原值）",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "要更新的脚本 ID" },
                    "name": { "type": "string", "description": "新名称（可选）" },
                    "description": { "type": "string", "description": "新描述（可选）" },
                    "steps": {
                        "type": "array",
                        "description": "新步骤列表（可选）",
                        "items": { "type": "object" }
                    },
                    "associated_profile_ids": {
                        "type": "array",
                        "description": "新的关联环境 ID 列表（可选）",
                        "items": { "type": "string" }
                    },
                    "ai_config_id": { "type": "string", "description": "使用的 AI 配置 ID（可选）" }
                },
                "required": ["script_id"]
            }),
        ),
        tool(
            "auto_delete_script",
            "永久删除自动化脚本（不可撤销）",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "要删除的脚本 ID" }
                },
                "required": ["script_id"]
            }),
        ),
        tool(
            "auto_export_script",
            "将自动化脚本导出为 JSON 字符串（可用于备份或迁移）",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "脚本 ID" }
                },
                "required": ["script_id"]
            }),
        ),

        // ── 运行管理（5）──
        tool(
            "auto_run_script",
            "在指定环境中异步执行自动化脚本，立即返回 run_id。注意：不能运行当前正在执行的脚本（防止递归）",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "要执行的脚本 ID" },
                    "profile_id": {
                        "type": "string",
                        "description": "在此环境中运行（可选，不传则使用脚本关联的首个环境）"
                    },
                    "initial_vars": {
                        "type": "object",
                        "description": "初始变量键值对（可选）"
                    }
                },
                "required": ["script_id"]
            }),
        ),
        tool(
            "auto_list_runs",
            "列出指定脚本的运行历史（包含状态、时间、错误信息等）",
            json!({
                "type": "object",
                "properties": {
                    "script_id": { "type": "string", "description": "脚本 ID" }
                },
                "required": ["script_id"]
            }),
        ),
        tool(
            "auto_list_active_runs",
            "列出当前所有正在运行的 run_id",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "auto_get_run",
            "获取单次脚本运行的详细信息（状态、步骤结果、日志等）",
            json!({
                "type": "object",
                "properties": {
                    "run_id": { "type": "string", "description": "运行 ID" }
                },
                "required": ["run_id"]
            }),
        ),
        tool(
            "auto_cancel_run",
            "取消正在执行的自动化运行",
            json!({
                "type": "object",
                "properties": {
                    "run_id": { "type": "string", "description": "要取消的运行 ID" }
                },
                "required": ["run_id"]
            }),
        ),

        // ── AI Provider 配置（4）──
        tool(
            "auto_list_ai_configs",
            "列出所有 AI Provider 配置（API Key 已脱敏，仅显示末 4 位）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "auto_create_ai_config",
            "创建新的 AI Provider 配置",
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "配置名称" },
                    "provider": {
                        "type": "string",
                        "description": "Provider 类型: openai | anthropic | deepseek | groq | together | ollama | gemini | openrouter | custom"
                    },
                    "base_url": { "type": "string", "description": "API Base URL（覆盖 provider 默认值）" },
                    "api_key": { "type": "string", "description": "API Key" },
                    "model": { "type": "string", "description": "默认模型名称" },
                    "locale": { "type": "string", "description": "Agent prompt 语言: zh | en（默认 zh）" }
                },
                "required": ["name"]
            }),
        ),
        tool(
            "auto_update_ai_config",
            "更新已有 AI Provider 配置",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "配置 ID" },
                    "name": { "type": "string", "description": "配置名称" },
                    "provider": { "type": "string", "description": "Provider 类型" },
                    "base_url": { "type": "string", "description": "API Base URL" },
                    "api_key": { "type": "string", "description": "API Key（传入完整值）" },
                    "model": { "type": "string", "description": "默认模型名称" },
                    "locale": { "type": "string", "description": "Agent prompt 语言: zh | en" }
                },
                "required": ["id", "name"]
            }),
        ),
        tool(
            "auto_delete_ai_config",
            "删除 AI Provider 配置（不可撤销）",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "要删除的配置 ID" }
                },
                "required": ["id"]
            }),
        ),

        // ── CAPTCHA Provider 配置（4）──
        tool(
            "auto_list_captcha_configs",
            "列出所有 CAPTCHA 求解服务配置（API Key 已脱敏）",
            json!({
                "type": "object",
                "properties": {}
            }),
        ),
        tool(
            "auto_create_captcha_config",
            "创建新的 CAPTCHA 求解服务配置",
            json!({
                "type": "object",
                "properties": {
                    "provider": {
                        "type": "string",
                        "enum": ["2captcha", "capsolver", "anticaptcha", "capmonster"],
                        "description": "服务商名称"
                    },
                    "api_key": { "type": "string", "description": "API Key" },
                    "base_url": { "type": "string", "description": "自定义 API Base URL（可选）" },
                    "is_default": { "type": "boolean", "description": "是否设为默认配置" }
                },
                "required": ["provider", "api_key"]
            }),
        ),
        tool(
            "auto_update_captcha_config",
            "更新已有 CAPTCHA 求解服务配置",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "配置 ID" },
                    "provider": {
                        "type": "string",
                        "enum": ["2captcha", "capsolver", "anticaptcha", "capmonster"],
                        "description": "服务商名称"
                    },
                    "api_key": { "type": "string", "description": "API Key（传入完整值）" },
                    "base_url": { "type": "string", "description": "自定义 API Base URL（可选）" },
                    "is_default": { "type": "boolean", "description": "是否设为默认配置" }
                },
                "required": ["id", "provider", "api_key"]
            }),
        ),
        tool(
            "auto_delete_captcha_config",
            "删除 CAPTCHA 求解服务配置（不可撤销）",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "要删除的配置 ID" }
                },
                "required": ["id"]
            }),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::all_tool_definitions;

    fn tool_def<'a>(defs: &'a [serde_json::Value], name: &str) -> &'a serde_json::Value {
        defs.iter()
            .find(|def| {
                def.get("function")
                    .and_then(|value| value.get("name"))
                    .and_then(|value| value.as_str())
                    == Some(name)
            })
            .unwrap_or_else(|| panic!("tool definition not found: {name}"))
    }

    #[test]
    fn device_preset_crud_tool_definitions_exist() {
        let defs = all_tool_definitions();

        for name in [
            "app_list_device_presets",
            "app_get_device_preset",
            "app_create_device_preset",
            "app_update_device_preset",
            "app_delete_device_preset",
        ] {
            let _ = tool_def(&defs, name);
        }
    }

    #[test]
    fn device_preset_mutation_tools_require_expected_fields() {
        let defs = all_tool_definitions();

        let create_required = tool_def(&defs, "app_create_device_preset")
            .get("function")
            .and_then(|value| value.get("parameters"))
            .and_then(|value| value.get("required"))
            .and_then(|value| value.as_array())
            .expect("create required fields");
        let update_required = tool_def(&defs, "app_update_device_preset")
            .get("function")
            .and_then(|value| value.get("parameters"))
            .and_then(|value| value.get("required"))
            .and_then(|value| value.as_array())
            .expect("update required fields");
        let get_required = tool_def(&defs, "app_get_device_preset")
            .get("function")
            .and_then(|value| value.get("parameters"))
            .and_then(|value| value.get("required"))
            .and_then(|value| value.as_array())
            .expect("get required fields");
        let delete_required = tool_def(&defs, "app_delete_device_preset")
            .get("function")
            .and_then(|value| value.get("parameters"))
            .and_then(|value| value.get("required"))
            .and_then(|value| value.as_array())
            .expect("delete required fields");

        let required_names = |items: &[serde_json::Value]| {
            items
                .iter()
                .filter_map(|value| value.as_str().map(str::to_string))
                .collect::<Vec<_>>()
        };

        let create_required = required_names(create_required);
        let update_required = required_names(update_required);
        let get_required = required_names(get_required);
        let delete_required = required_names(delete_required);

        for field in [
            "label",
            "platform",
            "platform_version",
            "viewport_width",
            "viewport_height",
            "device_scale_factor",
            "touch_points",
            "custom_platform",
            "arch",
            "bitness",
            "mobile",
            "form_factor",
            "user_agent_template",
            "custom_gl_vendor",
            "custom_gl_renderer",
            "custom_cpu_cores",
            "custom_ram_gb",
        ] {
            assert!(
                create_required.iter().any(|value| value == field),
                "missing create field: {field}"
            );
            assert!(
                update_required.iter().any(|value| value == field),
                "missing update field: {field}"
            );
        }

        assert!(update_required.iter().any(|value| value == "preset_id"));
        assert_eq!(get_required, vec!["preset_id".to_string()]);
        assert_eq!(delete_required, vec!["preset_id".to_string()]);
    }
}
