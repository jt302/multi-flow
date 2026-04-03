# Multi-Flow AI 工具开发者参考文档

> **最后更新日期**: 2026-04-03
> **工具总数**: 114 个
> **分类**: 6 个（Utility / CDP / Magic Controller / App Data / File I/O / Dialog）

---

## 目录

- [1. 概述](#1-概述)
- [2. 架构说明](#2-架构说明)
- [3. 工具分类详细参考](#3-工具分类详细参考)
  - [3.1 Utility 工具（3 个）](#31-utility-工具3-个)
  - [3.2 CDP 工具（31 个）](#32-cdp-工具31-个)
  - [3.3 Magic Controller 工具（48 个）](#33-magic-controller-工具48-个)
  - [3.4 App Data 工具（20 个）](#34-app-data-工具20-个)
  - [3.5 File I/O 工具（6 个）](#35-file-io-工具6-个)
  - [3.6 Dialog 工具（6 个）](#36-dialog-工具6-个)
- [4. 新增工具流程](#4-新增工具流程)
- [5. 维护指引](#5-维护指引)

---

## 1. 概述

Multi-Flow 的自动化系统为 AI Agent 提供了 **114 个工具**，覆盖浏览器控制、应用数据管理、文件操作、用户交互等完整能力。

### 工具系统架构

```
ToolRegistry（注册表）
  ├── 工具定义（tool_defs.rs）── OpenAI function calling JSON Schema
  ├── 类别筛选（ToolFilter）── 按前缀路由
  └── 执行分发
       ├── cdp_* / magic_* / utility → ScriptStep 委托 execute_step
       ├── app_*                     → app_tools 模块直接调用 Service
       ├── file_*                    → file_tools 模块直接调用 std::fs
       └── dialog_*                  → dialog_tools 模块通过 Tauri 事件与前端通信
```

### 支持的 LLM Provider

| Provider   | 说明                                           |
| ---------- | ---------------------------------------------- |
| OpenAI     | GPT-4o / GPT-4o-mini 等，原生 function calling |
| Anthropic  | Claude 系列，tool_use 格式                     |
| DeepSeek   | DeepSeek-V3 / Chat 等                          |
| Groq       | 高速推理，兼容 OpenAI 格式                     |
| Together   | 开源模型托管平台                               |
| Ollama     | 本地部署模型                                   |
| Gemini     | Google Gemini 系列                             |
| OpenRouter | 多模型路由网关                                 |
| Custom     | 自定义 OpenAI 兼容端点                         |

### 工具定义格式

所有工具定义遵循 **OpenAI function calling JSON Schema** 格式：

```json
{
	"type": "function",
	"function": {
		"name": "tool_name",
		"description": "工具描述",
		"parameters": {
			"type": "object",
			"properties": {
				"param_name": {
					"type": "string",
					"description": "参数描述"
				}
			},
			"required": ["param_name"]
		}
	}
}
```

### 工具分类统计

| 类别             | 前缀                               | 数量 | 说明                                        |
| ---------------- | ---------------------------------- | ---- | ------------------------------------------- |
| Utility          | `wait` / `print` / `submit_result` | 3    | 基础控制工具                                |
| CDP              | `cdp_` / `cdp`                     | 31   | Chrome DevTools Protocol 浏览器操控         |
| Magic Controller | `magic_`                           | 48   | 自研 Chromium Magic Controller API          |
| App Data         | `app_`                             | 20   | 应用数据 CRUD（Profile/Group/Proxy/Plugin） |
| File I/O         | `file_`                            | 6    | 文件系统操作                                |
| Dialog           | `dialog_`                          | 6    | 用户交互弹窗                                |

---

## 2. 架构说明

### 核心文件清单

| 文件                                              | 职责                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `src-tauri/src/services/ai_tools/tool_defs.rs`    | 所有工具的 JSON Schema 定义（`all_tool_definitions()`）          |
| `src-tauri/src/services/ai_tools/mod.rs`          | ToolRegistry 注册/路由/执行, ToolFilter, ToolContext, ToolResult |
| `src-tauri/src/services/ai_tools/app_tools.rs`    | App 类工具执行器（Profile/Group/Proxy/Plugin/Session）           |
| `src-tauri/src/services/ai_tools/file_tools.rs`   | File 类工具执行器（读写/目录/存在性检查）                        |
| `src-tauri/src/services/ai_tools/dialog_tools.rs` | Dialog 类工具执行器（通过 Tauri 事件与前端 UI 弹窗交互）         |
| `src-tauri/src/services/ai_prompts.rs`            | 系统提示词构建                                                   |
| `src-tauri/src/services/ai_service.rs`            | LLM API 集成（多 Provider 支持、tool calling 循环）              |
| `src-tauri/src/commands/automation_commands.rs`   | AI 步骤执行入口、`execute_step` 函数                             |

### 执行流程

```
AiAgent 步骤
  → load_ai_config()          -- 加载 AI Provider 配置
  → build_system_prompt()     -- 构建系统提示词
  → ToolFilter                -- 按类别筛选可用工具
  → chat_with_tools()         -- 发起 LLM API 调用
  → 多轮 tool calling loop   -- 循环处理工具调用直到 AI 返回最终结果
  → submit_result             -- 提交结果结束执行
```

### 工具路由机制

`ToolRegistry::execute()` 根据工具名前缀进行路由分发：

| 前缀模式                           | 路由目标                  | 执行方式                                 |
| ---------------------------------- | ------------------------- | ---------------------------------------- |
| `cdp_*` / `cdp`                    | `execute_via_script_step` | 构造 ScriptStep 委托 `execute_step`      |
| `magic_*`                          | `execute_via_script_step` | 构造 ScriptStep 委托 `execute_step`      |
| `wait` / `print` / `submit_result` | `execute_via_script_step` | 构造 ScriptStep 委托 `execute_step`      |
| `app_*`                            | `app_tools::execute`      | 直接调用 AppState 中的 Service           |
| `file_*`                           | `file_tools::execute`     | 直接调用 `std::fs`                       |
| `dialog_*`                         | `dialog_tools::execute`   | 通过 Tauri 事件 + oneshot 通道与前端通信 |

### 核心类型

```rust
/// 工具执行上下文
pub struct ToolContext<'a> {
    pub cdp: Option<&'a CdpClient>,       // CDP 连接
    pub http_client: &'a reqwest::Client, // HTTP 客户端
    pub magic_port: Option<u16>,          // Magic Controller 端口
    pub app: &'a AppHandle,               // Tauri 应用句柄
    pub run_id: &'a str,                  // 运行 ID
    pub step_index: usize,                // 步骤索引
    pub vars: &'a RunVariables,           // 运行时变量
    pub logs: &'a mut Vec<RunLogEntry>,   // 运行日志
    pub script_ai_config: Option<&'a AiProviderConfig>, // AI 配置
}

/// 工具执行结果
pub struct ToolResult {
    pub text: Option<String>,             // 文本输出（返回给 AI）
    pub image_base64: Option<String>,     // 图片 base64（截图专用）
    pub vars: HashMap<String, String>,    // 输出变量映射
}
```

---

## 3. 工具分类详细参考

### 3.1 Utility 工具（3 个）

基础控制工具，用于流程控制和日志输出。

#### `wait`

等待指定毫秒数。

| 参数 | 类型    | 必需 | 描述             |
| ---- | ------- | ---- | ---------------- |
| `ms` | integer | ✅   | 等待时长（毫秒） |

**返回值**: 无

---

#### `print`

输出日志信息。

| 参数    | 类型   | 必需 | 描述                                                               |
| ------- | ------ | ---- | ------------------------------------------------------------------ |
| `text`  | string | ✅   | 要输出的文本                                                       |
| `level` | string | ❌   | 日志级别，默认 `info`。可选值: `info` / `warn` / `error` / `debug` |

**返回值**: 无

---

#### `submit_result`

提交最终结果并结束执行。必须通过此工具提交结果，result 参数应只包含纯净的结果数据。

| 参数     | 类型   | 必需 | 描述                                     |
| -------- | ------ | ---- | ---------------------------------------- |
| `result` | string | ✅   | 纯净的最终结果文本，不要包含任何多余说明 |

**返回值**: 结束 AI 执行循环

---

### 3.2 CDP 工具（31 个）

通过 Chrome DevTools Protocol 操控浏览器页面。所有带 `selector` 参数的工具均支持 `selector_type` 可选参数（`css` / `xpath` / `text`，默认 `css`）。

#### 导航（Navigation）

##### `cdp_navigate`

导航到指定 URL。

| 参数         | 类型   | 必需 | 描述                |
| ------------ | ------ | ---- | ------------------- |
| `url`        | string | ✅   | 目标 URL            |
| `output_key` | string | ❌   | 将 URL 存入此变量名 |

**返回值**: 导航结果

---

##### `cdp_reload`

重新加载当前页面。

| 参数           | 类型    | 必需 | 描述                     |
| -------------- | ------- | ---- | ------------------------ |
| `ignore_cache` | boolean | ❌   | 是否忽略缓存，默认 false |

**返回值**: 无

---

##### `cdp_go_back`

浏览器后退。

| 参数    | 类型    | 必需 | 描述             |
| ------- | ------- | ---- | ---------------- |
| `steps` | integer | ❌   | 后退步数，默认 1 |

**返回值**: 无

---

##### `cdp_go_forward`

浏览器前进。

| 参数    | 类型    | 必需 | 描述             |
| ------- | ------- | ---- | ---------------- |
| `steps` | integer | ❌   | 前进步数，默认 1 |

**返回值**: 无

---

#### 交互（Interaction）

##### `cdp_click`

点击页面元素。

| 参数            | 类型   | 必需 | 描述                                             |
| --------------- | ------ | ---- | ------------------------------------------------ |
| `selector`      | string | ✅   | 元素选择器                                       |
| `selector_type` | string | ❌   | 选择器类型: `css` / `xpath` / `text`，默认 `css` |

**返回值**: 无

---

##### `cdp_type`

聚焦元素并输入文本（通过 CDP `Input.insertText`）。

| 参数            | 类型   | 必需 | 描述                   |
| --------------- | ------ | ---- | ---------------------- |
| `selector`      | string | ✅   | 元素选择器             |
| `selector_type` | string | ❌   | 选择器类型，默认 `css` |
| `text`          | string | ✅   | 要输入的文本           |

**返回值**: 无

---

##### `cdp_set_input_value`

通过 JS 直接设置 input 元素的 value 并触发 input/change 事件。

| 参数            | 类型   | 必需 | 描述                   |
| --------------- | ------ | ---- | ---------------------- |
| `selector`      | string | ✅   | 元素选择器             |
| `selector_type` | string | ❌   | 选择器类型，默认 `css` |
| `value`         | string | ✅   | 要设置的值             |

**返回值**: 无

---

##### `cdp_input_text`

多来源文本输入（内联文本/文件/变量）。

| 参数            | 类型   | 必需 | 描述                                                                |
| --------------- | ------ | ---- | ------------------------------------------------------------------- |
| `selector`      | string | ✅   | 元素选择器                                                          |
| `selector_type` | string | ❌   | 选择器类型，默认 `css`                                              |
| `text_source`   | string | ❌   | 文本来源类型，默认 `inline`。可选值: `inline` / `file` / `variable` |
| `text`          | string | ❌   | 内联文本（`text_source=inline` 时使用）                             |
| `file_path`     | string | ❌   | 文件路径（`text_source=file` 时使用）                               |
| `var_name`      | string | ❌   | 变量名（`text_source=variable` 时使用）                             |

**返回值**: 无

---

#### 数据提取（Data Extraction）

##### `cdp_get_text`

获取元素的文本内容（innerText/textContent）。

| 参数            | 类型   | 必需 | 描述                   |
| --------------- | ------ | ---- | ---------------------- |
| `selector`      | string | ✅   | 元素选择器             |
| `selector_type` | string | ❌   | 选择器类型，默认 `css` |
| `output_key`    | string | ❌   | 将文本存入此变量名     |

**返回值**: 元素文本内容

---

##### `cdp_get_attribute`

获取元素的指定 HTML 属性值。

| 参数            | 类型   | 必需 | 描述                                 |
| --------------- | ------ | ---- | ------------------------------------ |
| `selector`      | string | ✅   | 元素选择器                           |
| `selector_type` | string | ❌   | 选择器类型，默认 `css`               |
| `attribute`     | string | ✅   | 属性名，如 `href`、`src`、`class` 等 |
| `output_key`    | string | ❌   | 将属性值存入此变量名                 |

**返回值**: 属性值字符串

---

##### `cdp_execute_js`

在页面执行 JavaScript 代码并返回结果。

| 参数         | 类型   | 必需 | 描述                                     |
| ------------ | ------ | ---- | ---------------------------------------- |
| `expression` | string | ❌   | JavaScript 代码（与 `file_path` 二选一） |
| `file_path`  | string | ❌   | JS 文件路径（优先于 `expression`）       |
| `output_key` | string | ❌   | 将返回值存入此变量名                     |

**返回值**: JavaScript 执行结果

---

#### 等待与滚动（Wait / Scroll）

##### `cdp_wait_for_selector`

等待元素出现在 DOM 中。

| 参数            | 类型    | 必需 | 描述                   |
| --------------- | ------- | ---- | ---------------------- |
| `selector`      | string  | ✅   | 元素选择器             |
| `selector_type` | string  | ❌   | 选择器类型，默认 `css` |
| `timeout_ms`    | integer | ❌   | 超时毫秒数，默认 10000 |

**返回值**: 无

---

##### `cdp_wait_for_page_load`

等待页面完全加载（readyState = complete）。

| 参数         | 类型    | 必需 | 描述                   |
| ------------ | ------- | ---- | ---------------------- |
| `timeout_ms` | integer | ❌   | 超时毫秒数，默认 30000 |

**返回值**: 无

---

##### `cdp_scroll_to`

滚动页面到指定元素或坐标位置。

| 参数            | 类型    | 必需 | 描述                        |
| --------------- | ------- | ---- | --------------------------- |
| `selector`      | string  | ❌   | 元素选择器（与 x/y 二选一） |
| `selector_type` | string  | ❌   | 选择器类型，默认 `css`      |
| `x`             | integer | ❌   | 横向滚动坐标                |
| `y`             | integer | ❌   | 纵向滚动坐标                |

**返回值**: 无

---

#### 标签页管理（Tab Management）

##### `cdp_open_new_tab`

在浏览器中打开新标签页。

| 参数         | 类型   | 必需 | 描述                               |
| ------------ | ------ | ---- | ---------------------------------- |
| `url`        | string | ✅   | 要打开的 URL                       |
| `output_key` | string | ❌   | 将新标签页的 targetId 存入此变量名 |

**返回值**: 新标签页的 targetId

---

##### `cdp_get_all_tabs`

获取所有标签页信息。

| 参数         | 类型   | 必需 | 描述                           |
| ------------ | ------ | ---- | ------------------------------ |
| `output_key` | string | ❌   | 将标签页列表 JSON 存入此变量名 |

**返回值**: 标签页列表 JSON 数组

---

##### `cdp_switch_tab`

切换到指定标签页。

| 参数        | 类型   | 必需 | 描述                  |
| ----------- | ------ | ---- | --------------------- |
| `target_id` | string | ✅   | 目标标签页的 targetId |

**返回值**: 无

---

##### `cdp_close_tab_by_target`

关闭指定标签页。

| 参数        | 类型   | 必需 | 描述                    |
| ----------- | ------ | ---- | ----------------------- |
| `target_id` | string | ✅   | 要关闭的标签页 targetId |

**返回值**: 无

---

#### 媒体与文件（Media / File）

##### `cdp_screenshot`

截取当前页面截图（自动保存文件，支持视觉分析）。

| 参数                   | 类型    | 必需 | 描述                                   |
| ---------------------- | ------- | ---- | -------------------------------------- |
| `format`               | string  | ❌   | 图片格式: `png` / `jpeg`，默认 `png`   |
| `quality`              | integer | ❌   | JPEG 质量（1-100），仅 `jpeg` 格式有效 |
| `output_path`          | string  | ❌   | 保存到磁盘的绝对路径（默认自动生成）   |
| `output_key_file_path` | string  | ❌   | 将文件路径存入此变量名                 |

**返回值**: 截图文件路径；图片 base64 注入 AI 对话历史供视觉分析

---

##### `cdp_upload_file`

向文件 input 元素设置文件。

| 参数            | 类型          | 必需 | 描述                         |
| --------------- | ------------- | ---- | ---------------------------- |
| `selector`      | string        | ✅   | 文件 input 元素的 CSS 选择器 |
| `selector_type` | string        | ❌   | 选择器类型，默认 `css`       |
| `files`         | array[string] | ✅   | 文件绝对路径数组             |

**返回值**: 无

---

##### `cdp_download_file`

设置浏览器下载路径（后续下载自动保存到此目录）。

| 参数            | 类型   | 必需 | 描述               |
| --------------- | ------ | ---- | ------------------ |
| `download_path` | string | ✅   | 下载目录的绝对路径 |

**返回值**: 无

---

#### 键盘操作（Keyboard）

##### `cdp_clipboard`

执行剪贴板操作（复制/粘贴/全选）。

| 参数     | 类型   | 必需 | 描述                                      |
| -------- | ------ | ---- | ----------------------------------------- |
| `action` | string | ✅   | 操作类型: `copy` / `paste` / `select_all` |

**返回值**: 无

---

##### `cdp_press_key`

模拟按键（单个键）。

| 参数  | 类型   | 必需 | 描述                                              |
| ----- | ------ | ---- | ------------------------------------------------- |
| `key` | string | ✅   | 键名，如 `Enter`、`Tab`、`Escape`、`ArrowDown` 等 |

**返回值**: 无

---

##### `cdp_shortcut`

模拟键盘快捷键组合。

| 参数        | 类型          | 必需 | 描述                                          |
| ----------- | ------------- | ---- | --------------------------------------------- |
| `modifiers` | array[string] | ✅   | 修饰键列表: `alt` / `ctrl` / `meta` / `shift` |
| `key`       | string        | ✅   | 主键名                                        |

**返回值**: 无

---

#### 原始 CDP 调用（Raw CDP）

##### `cdp`

调用任意 CDP（Chrome DevTools Protocol）方法。

| 参数         | 类型   | 必需 | 描述                                                   |
| ------------ | ------ | ---- | ------------------------------------------------------ |
| `method`     | string | ✅   | CDP 方法名，如 `Runtime.evaluate`、`Network.enable` 等 |
| `params`     | object | ❌   | 方法参数（JSON 对象）                                  |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名                               |

**返回值**: CDP 方法返回的 JSON 结果

---

#### 信息查询（Info）

##### `cdp_get_browser_version`

获取浏览器版本信息（产品名、版本号、User-Agent、JS/协议版本）。

| 参数         | 类型   | 必需 | 描述                         |
| ------------ | ------ | ---- | ---------------------------- |
| `output_key` | string | ❌   | 将版本信息 JSON 存入此变量名 |

**返回值**: 版本信息 JSON

---

##### `cdp_get_browser_command_line`

获取浏览器启动时的命令行参数。

| 参数         | 类型   | 必需 | 描述                           |
| ------------ | ------ | ---- | ------------------------------ |
| `output_key` | string | ❌   | 将命令行参数 JSON 存入此变量名 |

**返回值**: 命令行参数 JSON

---

##### `cdp_get_window_for_target`

获取目标所在浏览器窗口的信息（windowId、bounds）。

| 参数         | 类型   | 必需 | 描述                         |
| ------------ | ------ | ---- | ---------------------------- |
| `target_id`  | string | ❌   | 目标 ID（默认当前目标）      |
| `output_key` | string | ❌   | 将窗口信息 JSON 存入此变量名 |

**返回值**: 窗口信息 JSON（windowId、bounds）

---

##### `cdp_get_layout_metrics`

获取页面布局指标（layoutViewport、visualViewport、contentSize）。

| 参数         | 类型   | 必需 | 描述                         |
| ------------ | ------ | ---- | ---------------------------- |
| `output_key` | string | ❌   | 将布局指标 JSON 存入此变量名 |

**返回值**: 布局指标 JSON

---

##### `cdp_get_document`

获取 DOM 根节点树（可控制深度和 Shadow DOM 穿透）。

| 参数         | 类型    | 必需 | 描述                              |
| ------------ | ------- | ---- | --------------------------------- |
| `depth`      | integer | ❌   | 遍历深度，`-1` 表示全部，默认 `1` |
| `pierce`     | boolean | ❌   | 是否穿透 Shadow DOM，默认 `false` |
| `output_key` | string  | ❌   | 将 DOM 树 JSON 存入此变量名       |

**返回值**: DOM 树 JSON

---

##### `cdp_get_full_ax_tree`

获取完整的无障碍树（Accessibility Tree），用于理解页面语义结构。

| 参数         | 类型    | 必需 | 描述                         |
| ------------ | ------- | ---- | ---------------------------- |
| `depth`      | integer | ❌   | 遍历深度（不填则返回全部）   |
| `output_key` | string  | ❌   | 将无障碍树 JSON 存入此变量名 |

**返回值**: 无障碍树 JSON

---

### 3.3 Magic Controller 工具（48 个）

通过自研 Chromium 的 Magic Controller HTTP API 控制浏览器。这些工具通过 `magic_port` 与 Chromium 实例通信。

#### 窗口控制（12 个）

##### `magic_set_bounds`

设置浏览器窗口位置和大小。

| 参数         | 类型    | 必需 | 描述               |
| ------------ | ------- | ---- | ------------------ |
| `x`          | integer | ❌   | 窗口左上角 X 坐标  |
| `y`          | integer | ❌   | 窗口左上角 Y 坐标  |
| `width`      | integer | ❌   | 窗口宽度           |
| `height`     | integer | ❌   | 窗口高度           |
| `output_key` | string  | ❌   | 将结果存入此变量名 |

**返回值**: 设置结果

---

##### `magic_get_bounds`

获取浏览器窗口位置和大小。

| 参数         | 类型   | 必需 | 描述                     |
| ------------ | ------ | ---- | ------------------------ |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: 窗口位置和大小 JSON（x, y, width, height）

---

##### `magic_set_maximized`

最大化浏览器窗口。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_minimized`

最小化浏览器窗口。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_closed`

关闭浏览器窗口。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_safe_quit`

安全退出整个浏览器应用（关闭所有窗口和标签页）。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_restored`

恢复浏览器窗口（从最大化/最小化恢复）。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_fullscreen`

全屏浏览器窗口。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_bg_color`

设置浏览器背景颜色。

| 参数 | 类型    | 必需 | 描述             |
| ---- | ------- | ---- | ---------------- |
| `r`  | integer | ❌   | 红色分量 (0-255) |
| `g`  | integer | ❌   | 绿色分量 (0-255) |
| `b`  | integer | ❌   | 蓝色分量 (0-255) |

**返回值**: 无

---

##### `magic_set_toolbar_text`

设置浏览器工具栏显示文本。

| 参数   | 类型   | 必需 | 描述       |
| ------ | ------ | ---- | ---------- |
| `text` | string | ✅   | 显示的文本 |

**返回值**: 无

---

##### `magic_set_app_top_most`

将浏览器窗口置顶。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_set_master_indicator_visible`

显示/隐藏主控指示器标签。

| 参数      | 类型    | 必需 | 描述     |
| --------- | ------- | ---- | -------- |
| `visible` | boolean | ❌   | 是否显示 |
| `label`   | string  | ❌   | 标签文本 |

**返回值**: 无

---

#### 标签页管理（7 个）

##### `magic_open_new_tab`

打开新标签页。

| 参数         | 类型    | 必需 | 描述               |
| ------------ | ------- | ---- | ------------------ |
| `url`        | string  | ✅   | 要打开的 URL       |
| `browser_id` | integer | ❌   | 目标浏览器 ID      |
| `output_key` | string  | ❌   | 将结果存入此变量名 |

**返回值**: 新标签页信息

---

##### `magic_close_tab`

关闭指定标签页。

| 参数     | 类型    | 必需 | 描述      |
| -------- | ------- | ---- | --------- |
| `tab_id` | integer | ✅   | 标签页 ID |

**返回值**: 无

---

##### `magic_activate_tab`

激活指定标签页。

| 参数     | 类型    | 必需 | 描述      |
| -------- | ------- | ---- | --------- |
| `tab_id` | integer | ✅   | 标签页 ID |

**返回值**: 无

---

##### `magic_activate_tab_by_index`

按索引激活标签页。

| 参数         | 类型    | 必需 | 描述                    |
| ------------ | ------- | ---- | ----------------------- |
| `index`      | integer | ✅   | 标签页索引（从 0 开始） |
| `browser_id` | integer | ❌   | 目标浏览器 ID           |

**返回值**: 无

---

##### `magic_close_inactive_tabs`

关闭所有非活跃标签页。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 无

---

##### `magic_open_new_window`

打开新浏览器窗口。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 新窗口信息

---

##### `magic_type_string`

通过 Magic Controller 输入文本（模拟键盘输入）。

| 参数     | 类型    | 必需 | 描述          |
| -------- | ------- | ---- | ------------- |
| `text`   | string  | ✅   | 要输入的文本  |
| `tab_id` | integer | ❌   | 目标标签页 ID |

**返回值**: 无

---

#### 浏览器查询（7 个）

##### `magic_get_browsers`

获取所有浏览器实例列表。

| 参数         | 类型   | 必需 | 描述                     |
| ------------ | ------ | ---- | ------------------------ |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: 浏览器实例列表 JSON

---

##### `magic_get_active_browser`

获取当前活跃的浏览器实例。

| 参数         | 类型   | 必需 | 描述                     |
| ------------ | ------ | ---- | ------------------------ |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: 活跃浏览器实例 JSON

---

##### `magic_get_tabs`

获取指定浏览器的标签页列表。

| 参数         | 类型    | 必需 | 描述                     |
| ------------ | ------- | ---- | ------------------------ |
| `browser_id` | integer | ❌   | 浏览器 ID                |
| `output_key` | string  | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: 标签页列表 JSON

---

##### `magic_get_active_tabs`

获取所有活跃标签页。

| 参数         | 类型   | 必需 | 描述                     |
| ------------ | ------ | ---- | ------------------------ |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: 活跃标签页列表 JSON

---

##### `magic_get_switches`

获取浏览器启动参数。

| 参数         | 类型   | 必需 | 描述                   |
| ------------ | ------ | ---- | ---------------------- |
| `key`        | string | ❌   | 参数名（不填返回全部） |
| `output_key` | string | ❌   | 将结果存入此变量名     |

**返回值**: 启动参数 JSON

---

##### `magic_get_host_name`

获取浏览器环境主机名。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 主机名字符串

---

##### `magic_get_mac_address`

获取浏览器环境 MAC 地址。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: MAC 地址字符串

---

#### 书签管理（10 个）

##### `magic_get_bookmarks`

获取所有书签。

| 参数         | 类型   | 必需 | 描述                       |
| ------------ | ------ | ---- | -------------------------- |
| `output_key` | string | ❌   | 将书签树 JSON 存入此变量名 |

**返回值**: 书签树 JSON

---

##### `magic_create_bookmark`

创建书签。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `parent_id`  | string | ❌   | 父文件夹 ID        |
| `title`      | string | ✅   | 书签标题           |
| `url`        | string | ✅   | 书签 URL           |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 创建的书签信息 JSON

---

##### `magic_create_bookmark_folder`

创建书签文件夹。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `parent_id`  | string | ❌   | 父文件夹 ID        |
| `title`      | string | ✅   | 文件夹标题         |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 创建的文件夹信息 JSON

---

##### `magic_update_bookmark`

更新书签标题或 URL。

| 参数      | 类型   | 必需 | 描述        |
| --------- | ------ | ---- | ----------- |
| `node_id` | string | ✅   | 书签节点 ID |
| `title`   | string | ❌   | 新标题      |
| `url`     | string | ❌   | 新 URL      |

**返回值**: 更新后的书签信息

---

##### `magic_move_bookmark`

移动书签到其他文件夹。

| 参数            | 类型   | 必需 | 描述          |
| --------------- | ------ | ---- | ------------- |
| `node_id`       | string | ✅   | 书签节点 ID   |
| `new_parent_id` | string | ✅   | 目标文件夹 ID |

**返回值**: 无

---

##### `magic_remove_bookmark`

删除书签。

| 参数      | 类型   | 必需 | 描述        |
| --------- | ------ | ---- | ----------- |
| `node_id` | string | ✅   | 书签节点 ID |

**返回值**: 无

---

##### `magic_bookmark_current_tab`

收藏当前标签页为书签。

| 参数         | 类型    | 必需 | 描述        |
| ------------ | ------- | ---- | ----------- |
| `browser_id` | integer | ❌   | 浏览器 ID   |
| `parent_id`  | string  | ❌   | 父文件夹 ID |

**返回值**: 创建的书签信息

---

##### `magic_unbookmark_current_tab`

取消收藏当前标签页。

| 参数         | 类型    | 必需 | 描述      |
| ------------ | ------- | ---- | --------- |
| `browser_id` | integer | ❌   | 浏览器 ID |

**返回值**: 无

---

##### `magic_is_current_tab_bookmarked`

检查当前标签页是否已收藏。

| 参数         | 类型    | 必需 | 描述               |
| ------------ | ------- | ---- | ------------------ |
| `browser_id` | integer | ❌   | 浏览器 ID          |
| `output_key` | string  | ❌   | 将结果存入此变量名 |

**返回值**: `true` / `false`

---

##### `magic_export_bookmark_state`

导出书签状态。

| 参数             | 类型   | 必需 | 描述               |
| ---------------- | ------ | ---- | ------------------ |
| `environment_id` | string | ❌   | 环境 ID            |
| `output_key`     | string | ❌   | 将结果存入此变量名 |

**返回值**: 书签状态 JSON

---

#### Cookie 管理（2 个）

##### `magic_get_managed_cookies`

获取浏览器管理的 Cookie 列表。

| 参数         | 类型   | 必需 | 描述                     |
| ------------ | ------ | ---- | ------------------------ |
| `output_key` | string | ❌   | 将结果 JSON 存入此变量名 |

**返回值**: Cookie 列表 JSON

---

##### `magic_export_cookie_state`

导出 Cookie 状态。

| 参数             | 类型   | 必需 | 描述               |
| ---------------- | ------ | ---- | ------------------ |
| `mode`           | string | ✅   | 导出模式           |
| `url`            | string | ❌   | 限定 URL           |
| `environment_id` | string | ❌   | 环境 ID            |
| `output_key`     | string | ❌   | 将结果存入此变量名 |

**返回值**: Cookie 状态 JSON

---

#### 扩展管理（5 个）

##### `magic_get_managed_extensions`

获取所有已安装的浏览器扩展信息。

| 参数         | 类型   | 必需 | 描述                         |
| ------------ | ------ | ---- | ---------------------------- |
| `output_key` | string | ❌   | 将扩展列表 JSON 存入此变量名 |

**返回值**: 扩展信息列表 JSON

---

##### `magic_trigger_extension_action`

触发扩展图标动作（模拟点击扩展图标）。

| 参数           | 类型    | 必需 | 描述         |
| -------------- | ------- | ---- | ------------ |
| `extension_id` | string  | ✅   | 32 位扩展 ID |
| `browser_id`   | integer | ❌   | 浏览器 ID    |

**返回值**: 无

---

##### `magic_close_extension_popup`

关闭当前打开的扩展弹窗。

| 参数         | 类型    | 必需 | 描述      |
| ------------ | ------- | ---- | --------- |
| `browser_id` | integer | ❌   | 浏览器 ID |

**返回值**: 无

---

##### `magic_enable_extension`

启用浏览器扩展（运行时生效，不持久化）。

| 参数           | 类型   | 必需 | 描述         |
| -------------- | ------ | ---- | ------------ |
| `extension_id` | string | ✅   | 32 位扩展 ID |

**返回值**: 无

---

##### `magic_disable_extension`

禁用浏览器扩展（运行时生效，不持久化）。

| 参数           | 类型   | 必需 | 描述         |
| -------------- | ------ | ---- | ------------ |
| `extension_id` | string | ✅   | 32 位扩展 ID |

**返回值**: 无

---

#### 同步控制（4 个）

##### `magic_toggle_sync_mode`

切换窗口同步模式（master/slave/disabled）。

| 参数         | 类型    | 必需 | 描述                                      |
| ------------ | ------- | ---- | ----------------------------------------- |
| `role`       | string  | ✅   | 同步角色: `master` / `slave` / `disabled` |
| `browser_id` | integer | ❌   | 浏览器 ID                                 |
| `session_id` | string  | ❌   | 同步会话 ID                               |
| `output_key` | string  | ❌   | 将结果存入此变量名                        |

**返回值**: 切换结果

---

##### `magic_get_sync_mode`

获取当前同步模式。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 当前同步模式字符串

---

##### `magic_get_is_master`

检查当前浏览器是否为同步主控。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: `true` / `false`

---

##### `magic_get_sync_status`

获取同步状态详情。

| 参数         | 类型   | 必需 | 描述               |
| ------------ | ------ | ---- | ------------------ |
| `output_key` | string | ❌   | 将结果存入此变量名 |

**返回值**: 同步状态详情 JSON

---

#### 截图（1 个）

##### `magic_capture_app_shell`

带壳截图（截取整个浏览器窗口，包含工具栏和标签页）。

| 参数                   | 类型    | 必需 | 描述                                 |
| ---------------------- | ------- | ---- | ------------------------------------ |
| `browser_id`           | integer | ❌   | 浏览器 ID                            |
| `format`               | string  | ❌   | 图片格式: `png` / `jpeg`，默认 `png` |
| `output_path`          | string  | ❌   | 保存路径（默认自动生成）             |
| `output_key_file_path` | string  | ❌   | 将文件路径存入此变量名               |

**返回值**: 截图文件路径；图片 base64 注入 AI 对话历史供视觉分析

---

### 3.4 App Data 工具（20 个）

通过 `AppState` 中的 Service 操作应用数据。所有返回值均为序列化后的 JSON 字符串。

#### Profile 操作（9 个）

##### `app_list_profiles`

列出 profile 列表，支持分组和关键字过滤。

| 参数              | 类型    | 必需 | 描述                                   |
| ----------------- | ------- | ---- | -------------------------------------- |
| `group_id`        | string  | ❌   | 按分组 ID 过滤                         |
| `keyword`         | string  | ❌   | 按名称关键字搜索                       |
| `include_deleted` | boolean | ❌   | 是否包含已删除的 profile，默认 `false` |

**返回值**: Profile 列表 JSON（分页，默认最多 1000 条）

---

##### `app_get_profile`

按 ID 获取 profile 详细信息。

| 参数         | 类型   | 必需 | 描述       |
| ------------ | ------ | ---- | ---------- |
| `profile_id` | string | ✅   | Profile ID |

**返回值**: Profile 详情 JSON

---

##### `app_create_profile`

创建新的 profile。

| 参数       | 类型   | 必需 | 描述         |
| ---------- | ------ | ---- | ------------ |
| `name`     | string | ✅   | Profile 名称 |
| `group_id` | string | ❌   | 所属分组 ID  |
| `note`     | string | ❌   | 备注         |

**返回值**: 创建的 Profile JSON

---

##### `app_update_profile`

更新 profile 基本信息。

| 参数         | 类型   | 必需 | 描述       |
| ------------ | ------ | ---- | ---------- |
| `profile_id` | string | ✅   | Profile ID |
| `name`       | string | ❌   | 新名称     |
| `group_id`   | string | ❌   | 新分组 ID  |
| `note`       | string | ❌   | 新备注     |

**返回值**: 更新后的 Profile JSON

---

##### `app_delete_profile`

删除 profile。

| 参数         | 类型   | 必需 | 描述                |
| ------------ | ------ | ---- | ------------------- |
| `profile_id` | string | ✅   | 要删除的 Profile ID |

**返回值**: 删除结果

---

##### `app_start_profile`

启动 profile 的浏览器环境。

| 参数         | 类型   | 必需 | 描述       |
| ------------ | ------ | ---- | ---------- |
| `profile_id` | string | ✅   | Profile ID |

**返回值**: 启动结果（含端口信息）

---

##### `app_stop_profile`

停止 profile 的浏览器环境。

| 参数         | 类型   | 必需 | 描述       |
| ------------ | ------ | ---- | ---------- |
| `profile_id` | string | ✅   | Profile ID |

**返回值**: 停止结果

---

##### `app_get_running_profiles`

获取所有正在运行的 profile 列表（含端口信息）。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 运行中的 Profile 列表 JSON

---

##### `app_get_current_profile`

获取当前自动化正在操作的 profile 信息。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 当前 Profile 详情 JSON

---

#### 分组操作（6 个）

##### `app_list_groups`

列出所有 profile 分组。

| 参数              | 类型    | 必需 | 描述                             |
| ----------------- | ------- | ---- | -------------------------------- |
| `include_deleted` | boolean | ❌   | 是否包含已删除分组，默认 `false` |

**返回值**: 分组列表 JSON

---

##### `app_get_group`

按 ID 获取分组信息。

| 参数       | 类型   | 必需 | 描述    |
| ---------- | ------ | ---- | ------- |
| `group_id` | string | ✅   | 分组 ID |

**返回值**: 分组详情 JSON

---

##### `app_create_group`

创建新分组。

| 参数    | 类型   | 必需 | 描述                               |
| ------- | ------ | ---- | ---------------------------------- |
| `name`  | string | ✅   | 分组名称                           |
| `color` | string | ❌   | 分组颜色（十六进制，如 `#FF5733`） |

**返回值**: 创建的分组 JSON

---

##### `app_update_group`

更新分组信息。

| 参数       | 类型   | 必需 | 描述    |
| ---------- | ------ | ---- | ------- |
| `group_id` | string | ✅   | 分组 ID |
| `name`     | string | ❌   | 新名称  |
| `color`    | string | ❌   | 新颜色  |

**返回值**: 更新后的分组 JSON

---

##### `app_delete_group`

删除分组。

| 参数       | 类型   | 必需 | 描述            |
| ---------- | ------ | ---- | --------------- |
| `group_id` | string | ✅   | 要删除的分组 ID |

**返回值**: 删除结果

---

##### `app_get_profiles_in_group`

获取指定分组内的所有 profile。

| 参数       | 类型   | 必需 | 描述    |
| ---------- | ------ | ---- | ------- |
| `group_id` | string | ✅   | 分组 ID |

**返回值**: Profile 列表 JSON

---

#### 代理操作（2 个）

##### `app_list_proxies`

列出所有代理。

| 参数       | 类型   | 必需 | 描述                                    |
| ---------- | ------ | ---- | --------------------------------------- |
| `keyword`  | string | ❌   | 按名称搜索                              |
| `protocol` | string | ❌   | 按协议过滤: `http` / `https` / `socks5` |

**返回值**: 代理列表 JSON

---

##### `app_get_proxy`

按 ID 获取代理详情。

| 参数       | 类型   | 必需 | 描述    |
| ---------- | ------ | ---- | ------- |
| `proxy_id` | string | ✅   | 代理 ID |

**返回值**: 代理详情 JSON

---

#### 插件操作（2 个）

##### `app_list_plugins`

列出所有已安装的插件包。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 插件列表 JSON

---

##### `app_get_plugin`

按 ID 获取插件包详情。

| 参数        | 类型   | 必需 | 描述      |
| ----------- | ------ | ---- | --------- |
| `plugin_id` | string | ✅   | 插件包 ID |

**返回值**: 插件详情 JSON

---

#### 会话查询（1 个）

##### `app_get_engine_sessions`

获取所有引擎会话信息（运行中的浏览器进程）。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 引擎会话列表 JSON

---

### 3.5 File I/O 工具（6 个）

安全的文件系统操作，带有大小限制（10MB）和路径遍历保护。

##### `file_read`

读取文本文件内容（最大 10MB）。

| 参数   | 类型   | 必需 | 描述         |
| ------ | ------ | ---- | ------------ |
| `path` | string | ✅   | 文件绝对路径 |

**返回值**: 文件文本内容

---

##### `file_write`

写入文本到文件（覆盖已有内容）。

| 参数      | 类型   | 必需 | 描述             |
| --------- | ------ | ---- | ---------------- |
| `path`    | string | ✅   | 文件绝对路径     |
| `content` | string | ✅   | 要写入的文本内容 |

**返回值**: 写入确认

---

##### `file_append`

追加文本到文件末尾。

| 参数      | 类型   | 必需 | 描述             |
| --------- | ------ | ---- | ---------------- |
| `path`    | string | ✅   | 文件绝对路径     |
| `content` | string | ✅   | 要追加的文本内容 |

**返回值**: 追加确认

---

##### `file_list_dir`

列出目录内容。

| 参数   | 类型   | 必需 | 描述         |
| ------ | ------ | ---- | ------------ |
| `path` | string | ✅   | 目录绝对路径 |

**返回值**: 目录内容列表

---

##### `file_exists`

检查文件或目录是否存在。

| 参数   | 类型   | 必需 | 描述                 |
| ------ | ------ | ---- | -------------------- |
| `path` | string | ✅   | 文件或目录的绝对路径 |

**返回值**: `true` / `false`

---

##### `file_mkdir`

递归创建目录。

| 参数   | 类型   | 必需 | 描述                 |
| ------ | ------ | ---- | -------------------- |
| `path` | string | ✅   | 要创建的目录绝对路径 |

**返回值**: 创建确认

---

### 3.6 Dialog 工具（6 个）

通过 Tauri 事件与前端 UI 弹窗交互。工作流程：后端 `app.emit("ai-dialog-request")` → 前端展示弹窗 → 前端调用 `submit_ai_dialog_response` → 后端 oneshot 通道接收结果。

##### `dialog_message`

向用户显示消息弹窗。

| 参数      | 类型   | 必需 | 描述                                                                    |
| --------- | ------ | ---- | ----------------------------------------------------------------------- |
| `title`   | string | ❌   | 弹窗标题                                                                |
| `message` | string | ✅   | 消息内容                                                                |
| `level`   | string | ❌   | 消息级别，默认 `info`。可选值: `info` / `warning` / `error` / `success` |

**返回值**: 用户确认

---

##### `dialog_confirm`

向用户展示确认弹窗（是/否选择）。

| 参数      | 类型   | 必需 | 描述     |
| --------- | ------ | ---- | -------- |
| `title`   | string | ❌   | 弹窗标题 |
| `message` | string | ✅   | 确认消息 |

**返回值**: `true`（确认）/ `false`（取消）

---

##### `dialog_input`

向用户展示输入弹窗。

| 参数            | 类型   | 必需 | 描述         |
| --------------- | ------ | ---- | ------------ |
| `title`         | string | ❌   | 弹窗标题     |
| `message`       | string | ✅   | 提示消息     |
| `label`         | string | ❌   | 输入框标签   |
| `default_value` | string | ❌   | 输入框默认值 |
| `placeholder`   | string | ❌   | 输入框占位符 |

**返回值**: 用户输入的文本

---

##### `dialog_save_file`

打开文件保存对话框，让用户选择保存位置。

| 参数           | 类型          | 必需 | 描述                                                                   |
| -------------- | ------------- | ---- | ---------------------------------------------------------------------- |
| `title`        | string        | ❌   | 对话框标题                                                             |
| `default_name` | string        | ❌   | 默认文件名                                                             |
| `filters`      | array[object] | ❌   | 文件类型过滤器，每项包含 `name`(string) 和 `extensions`(array[string]) |
| `content`      | string        | ❌   | 要保存的文件内容（若提供则自动写入所选路径）                           |

**返回值**: 用户选择的保存路径

---

##### `dialog_open_file`

打开文件选择对话框，让用户选择文件。

| 参数       | 类型          | 必需 | 描述                                                                   |
| ---------- | ------------- | ---- | ---------------------------------------------------------------------- |
| `title`    | string        | ❌   | 对话框标题                                                             |
| `multiple` | boolean       | ❌   | 是否允许多选，默认 `false`                                             |
| `filters`  | array[object] | ❌   | 文件类型过滤器，每项包含 `name`(string) 和 `extensions`(array[string]) |

**返回值**: 选中文件路径（单选为字符串，多选为 JSON 数组）

---

##### `dialog_select_folder`

打开文件夹选择对话框，让用户选择目录。

| 参数    | 类型   | 必需 | 描述       |
| ------- | ------ | ---- | ---------- |
| `title` | string | ❌   | 对话框标题 |

**返回值**: 选中目录路径

---

## 4. 新增工具流程

添加新工具需要修改以下文件：

| 步骤 | 文件                                           | 操作                                                                                                                                                   |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `src-tauri/src/services/ai_tools/tool_defs.rs` | 在对应类别函数中添加 JSON Schema 定义                                                                                                                  |
| 2    | `src-tauri/src/services/ai_tools/mod.rs`       | 如果是新类别，需要在 `tool_category()` 和 `ToolRegistry::execute()` 中添加路由                                                                         |
| 3    | 对应执行器文件                                 | 在 `app_tools.rs` / `file_tools.rs` / `dialog_tools.rs` 中添加执行逻辑；CDP/Magic/Utility 工具走 ScriptStep 路径，需在 `automation_commands.rs` 中处理 |
| 4    | `src-tauri/src/services/ai_prompts.rs`         | 如需更新系统提示词（如工具使用说明）                                                                                                                   |
| 5    | `docs/ai/ai-tools-developer.md`                | **更新本文档**                                                                                                                                         |
| 6    | `docs/ai/ai-tools-agent.md`                    | **同步更新 Agent 使用文档**                                                                                                                            |

### 工具定义模板

```rust
tool(
    "category_tool_name",
    "工具描述（简洁明确）",
    json!({
        "type": "object",
        "properties": {
            "param_name": {
                "type": "string",
                "description": "参数描述"
            }
        },
        "required": ["param_name"]  // 必需参数列表
    }),
),
```

---

## 5. 维护指引

### 文档更新规则

- **新增或修改 AI 工具时，必须同步更新本文档**
- 确保与 `docs/ai/ai-tools-agent.md`（Agent 使用文档）保持一致
- 更新文件顶部的「最后更新日期」和「工具总数」
- 新增工具需在对应类别章节添加完整的参数表和返回值说明

### 工具数量校验

可通过以下方式验证工具总数：

```bash
# 统计 tool_defs.rs 中的工具定义数量
grep -c 'tool(' src-tauri/src/services/ai_tools/tool_defs.rs
```

### 类别计数参考

| 类别             | 数量    | 校验方式                       |
| ---------------- | ------- | ------------------------------ |
| Utility          | 3       | `utility_tools()`              |
| CDP              | 31      | `cdp_tools()`                  |
| Magic Controller | 48      | `magic_tools()`                |
| App Data         | 20      | `app_tools()`                  |
| File I/O         | 6       | `file_tools()`                 |
| Dialog           | 6       | `dialog_tools()`               |
| **总计**         | **114** | `all_tool_definitions().len()` |
