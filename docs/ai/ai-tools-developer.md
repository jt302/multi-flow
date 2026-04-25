# Multi-Flow AI 工具开发者参考文档

> **最后更新日期**: 2026-04-17
> **工具总数**: 196 个
> **分类**: 8 个（Utility / CDP / Magic Controller / App Data / Auto / File I/O / Dialog / Captcha）

---

## 目录

- [1. 概述](#1-概述)
- [2. 架构说明](#2-架构说明)
- [3. 工具分类详细参考](#3-工具分类详细参考)
  - [3.1 Utility 工具（4 个）](#31-utility-工具4-个)
  - [3.2 CDP 工具（42 个启用 + 14 个已禁用）](#32-cdp-工具42-个启用--14-个已禁用)
  - [3.3 Magic Controller 工具（66 个）](#33-magic-controller-工具66-个)
  - [3.4 App Data 工具（26 个）](#34-app-data-工具26-个)
  - [3.5 Auto 工具（19 个）](#35-auto-工具19-个)
  - [3.6 File I/O 工具（6 个）](#36-file-io-工具6-个)
  - [3.7 Dialog 工具（13 个）](#37-dialog-工具13-个)
  - [3.8 Captcha 工具（5 个）](#38-captcha-工具5-个)
- [4. 工具权限管理](#4-工具权限管理)
- [5. 新增工具流程](#5-新增工具流程)
- [6. 维护指引](#6-维护指引)

---

## 1. 概述

Multi-Flow 的自动化系统为 AI Agent 提供了 **196 个工具**，覆盖浏览器控制、应用数据管理、自动化管理、文件操作、用户交互等完整能力。

### 工具系统架构

```
ToolRegistry（注册表）
  ├── 工具定义（tool_defs.rs）── OpenAI function calling JSON Schema
  ├── 类别筛选（ToolFilter）── 按前缀路由
  └── 执行分发
       ├── cdp_* / magic_* / utility → ScriptStep 委托 execute_step
       ├── app_*                     → app_tools 模块直接调用 Service
       ├── file_*                    → file_tools 模块直接调用 std::fs（限制在 appData/fs）
       └── dialog_*                  → dialog_tools 模块通过 Tauri 事件与前端通信
```

### 截图发模说明

- 截图原图继续落盘，前端预览仍使用原图。
- 发给模型的截图会自动优化：
  - 小图保留原格式
  - 超预算图片自动缩放，并可能转成更小的 `jpeg`
- 所以 AI 侧收到的视觉输入格式不固定，可能是 `png`，也可能是 `jpeg`。

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
| Utility          | `wait` / `print` / `submit_result` / `exec_command` | 4    | 等待、日志、提交结果、受控命令执行          |
| CDP              | `cdp_` / `cdp`                     | 56   | 页面交互（导航、点击、输入、提取、截图、JS执行等） |
| Magic Controller | `magic_`                           | 66   | 通过 Magic Controller 控制浏览器窗口和原生功能 |
| App Data         | `app_`                             | 26   | 读写 Multi-Flow 应用数据（Profile、机型预设、分组、代理等） |
| Auto             | `auto_`                            | 19   | 自动化管理（脚本/运行/AI配置/CAPTCHA配置 CRUD） |
| File I/O         | `file_`                            | 6    | app 内 `fs` 文件系统读写                    |
| Dialog           | `dialog_`                          | 13   | 向用户展示 UI 弹窗获取反馈                  |
| Captcha          | `captcha_`                         | 5    | CAPTCHA 检测与自动求解                      |
| **合计**         |                                    | **196** |                                          |

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
| `exec_command`                     | `exec_tools::execute`     | 受控命令执行，带风险分级、运行时探测和确认 |
| `app_*`                            | `app_tools::execute`      | 直接调用 AppState 中的 Service           |
| `file_*`                           | `file_tools::execute`     | 直接调用 `std::fs`（限制在 `appData/fs`） |
| `dialog_*`                         | `dialog_tools::execute`   | 通过 Tauri 事件 + oneshot 通道与前端通信 |

### 核心类型

```rust
/// 工具执行上下文
pub struct ToolContext<'a> {
    pub cdp: Option<&'a CdpClient>,       // CDP 连接
    pub http_client: &'a reqwest::Client, // HTTP 客户端
    pub magic_port: Option<u16>,          // Magic Controller 端口
    pub current_profile_id: Option<&'a str>, // 当前工具目标环境
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

### 3.1 Utility 工具（4 个）

基础控制工具，用于流程控制、日志输出和受控命令执行。

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

#### `exec_command`

执行受控命令行能力。默认先探测命令是否存在，再按风险规则决定直跑、确认或拒绝。

| 参数 | 类型 | 必需 | 描述 |
| ---- | ---- | ---- | ---- |
| `command` | string | ✅ | 可执行文件名，只允许单个命令名 |
| `args` | string[] | ❌ | 参数数组，不接受整段 shell |
| `cwd` | string | ❌ | 工作目录，默认当前 workspace 根目录 |
| `timeout_ms` | integer | ❌ | 超时，默认 30000 |
| `env` | object | ❌ | 额外环境变量，仅允许白名单 key |
| `output_mode` | string | ❌ | `stdout` 或 `combined` |
| `check_runtime` | boolean | ❌ | 是否先探测命令是否存在，默认 `true` |
| `require_confirmation` | boolean | ❌ | AI 主动要求确认时设为 `true` |

**返回值**:
- 命令缺失时返回 `missing_runtime`，包含安装建议
- 高风险命令返回确认请求或直接拒绝
- 执行完成后返回状态、退出码、输出、耗时、运行时版本信息

---

### 3.2 CDP 工具（42 个启用 + 14 个已禁用）

通过 Chrome DevTools Protocol 操控浏览器页面。所有带 `selector` 参数的工具均支持 `selector_type` 可选参数（`css` / `xpath` / `text`，默认 `css`）。

> ⚠️ **Magic 优先策略（2026-04-18 起）**：以下 14 个 CDP 工具已在 `src-tauri/src/services/ai_tools/tool_defs.rs::cdp_tools()` 中被行注释禁用，Agent 不会看到它们。相同功能请调用 Magic Controller 等价工具（更稳定、Chromium 原生实现）：
>
> | 已禁用 CDP 工具             | 请改用 Magic 工具                                    |
> | --------------------------- | ---------------------------------------------------- |
> | `cdp_navigate`              | `magic_navigate_to`                                  |
> | `cdp_reload`                | `magic_click_element`（target=`reload_button`）      |
> | `cdp_go_back`               | `magic_click_element`（target=`back_button`）        |
> | `cdp_go_forward`            | `magic_click_element`（target=`forward_button`）     |
> | `cdp_click`                 | `magic_click_dom`                                    |
> | `cdp_scroll_to`             | `magic_scroll`                                       |
> | `cdp_wait_for_page_load`    | `magic_get_page_info`                                |
> | `cdp_open_new_tab`          | `magic_open_new_tab`                                 |
> | `cdp_get_all_tabs`          | `magic_get_tabs` / `magic_get_active_tabs`           |
> | `cdp_switch_tab`            | `magic_activate_tab` / `magic_activate_tab_by_index` |
> | `cdp_close_tab_by_target`   | `magic_close_tab`                                    |
> | `cdp_press_key`             | `magic_send_keys`                                    |
> | `cdp_shortcut`              | `magic_send_keys`                                    |
> | `cdp_get_current_url`       | `magic_get_page_info`                                |
>
> 恢复方式：在 `tool_defs.rs` 的 `cdp_tools()` 中取消对应 `// TODO(magic-migration):` 区块的行注释即可重新启用。下面列出的这 14 个工具定义保留供文档参考，实际运行时 Agent 无法调用。

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
| `format`               | string  | ❌   | 图片格式: `png` / `jpeg`，默认 `png`。原图按该格式落盘，发模时可能被自动优化为更小格式 |
| `quality`              | integer | ❌   | JPEG 质量（1-100），仅 `jpeg` 格式有效 |
| `output_path`          | string  | ❌   | 保存到磁盘的绝对路径（默认自动生成）   |
| `output_key_file_path` | string  | ❌   | 将文件路径存入此变量名                 |

**返回值**: 截图文件路径；发给 AI 的图片会自动压缩，格式可能是 `png` 或 `jpeg`

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

#### Storage / Cookie

##### `cdp_get_cookies`

获取当前页面或指定 URL 的 Cookie。

| 参数         | 类型          | 必需 | 描述                                         |
| ------------ | ------------- | ---- | -------------------------------------------- |
| `urls`       | array[string] | ❌   | 指定 URL 列表，不传则返回当前页面 Cookie     |
| `output_key` | string        | ❌   | 将 Cookie JSON 数组存入此变量名              |

**返回值**: Cookie 数组 JSON

---

##### `cdp_set_cookie`

设置单个 Cookie。

| 参数        | 类型    | 必需 | 描述                     |
| ----------- | ------- | ---- | ------------------------ |
| `name`      | string  | ✅   | Cookie 名称              |
| `value`     | string  | ✅   | Cookie 值                |
| `domain`    | string  | ❌   | Cookie 域名              |
| `path`      | string  | ❌   | Cookie 路径              |
| `expires`   | number  | ❌   | 过期时间戳（Unix 秒）    |
| `http_only` | boolean | ❌   | 是否 HttpOnly            |
| `secure`    | boolean | ❌   | 是否仅 HTTPS             |

**返回值**: 无

---

##### `cdp_delete_cookies`

删除匹配的 Cookie。

| 参数     | 类型   | 必需 | 描述           |
| -------- | ------ | ---- | -------------- |
| `name`   | string | ✅   | Cookie 名称    |
| `domain` | string | ❌   | Cookie 域名    |
| `path`   | string | ❌   | Cookie 路径    |

**返回值**: 无

---

##### `cdp_get_local_storage`

读取当前页面 localStorage 的指定 key 或全部。

| 参数         | 类型   | 必需 | 描述                             |
| ------------ | ------ | ---- | -------------------------------- |
| `key`        | string | ❌   | 要读取的 key（不传返回全部）     |
| `output_key` | string | ❌   | 将结果存入此变量名               |

**返回值**: 值字符串或 `{key: value}` 对象

---

##### `cdp_set_local_storage`

写入当前页面 localStorage。

| 参数    | 类型   | 必需 | 描述             |
| ------- | ------ | ---- | ---------------- |
| `key`   | string | ✅   | localStorage key |
| `value` | string | ✅   | 要写入的值       |

**返回值**: 无

---

##### `cdp_get_session_storage`

读取当前页面 sessionStorage 的指定 key 或全部。

| 参数         | 类型   | 必需 | 描述                             |
| ------------ | ------ | ---- | -------------------------------- |
| `key`        | string | ❌   | 要读取的 key（不传返回全部）     |
| `output_key` | string | ❌   | 将结果存入此变量名               |

**返回值**: 值字符串或 `{key: value}` 对象

---

##### `cdp_clear_storage` ⚠️

清除指定来源的存储数据（cookies / localStorage / sessionStorage / cache 等）。

| 参数            | 类型   | 必需 | 描述                                                                    |
| --------------- | ------ | ---- | ----------------------------------------------------------------------- |
| `origin`        | string | ❌   | 来源 URL（不传则默认当前页面）                                          |
| `storage_types` | string | ❌   | 要清除的存储类型，逗号分隔，如 `cookies,local_storage,session_storage`  |

**返回值**: 无

---

#### 页面信息（Page Info）

##### `cdp_get_current_url`

获取当前页面 URL。

| 参数         | 类型   | 必需 | 描述                   |
| ------------ | ------ | ---- | ---------------------- |
| `output_key` | string | ❌   | 将当前 URL 存入此变量名 |

**返回值**: URL 字符串

---

##### `cdp_get_page_source`

获取页面或指定元素的 HTML 源码。

| 参数            | 类型   | 必需 | 描述                                               |
| --------------- | ------ | ---- | -------------------------------------------------- |
| `selector`      | string | ❌   | CSS 选择器（不传则返回完整 document HTML）         |
| `selector_type` | string | ❌   | 选择器类型，默认 `css`                             |
| `output_key`    | string | ❌   | 将 HTML 源码存入此变量名                           |

**返回值**: HTML 字符串

---

##### `cdp_wait_for_navigation`

等待页面导航完成（适用于点击后的 SPA 跳转或表单提交）。

| 参数         | 类型    | 必需 | 描述                   |
| ------------ | ------- | ---- | ---------------------- |
| `timeout_ms` | integer | ❌   | 超时时间（毫秒），默认 30000 |

**返回值**: 无

---

#### 设备模拟（Device Emulation）

##### `cdp_emulate_device`

模拟移动设备视口和 User-Agent。

| 参数                  | 类型    | 必需 | 描述                         |
| --------------------- | ------- | ---- | ---------------------------- |
| `width`               | integer | ✅   | 视口宽度                     |
| `height`              | integer | ✅   | 视口高度                     |
| `device_scale_factor` | number  | ❌   | 设备缩放因子（默认 1）       |
| `mobile`              | boolean | ❌   | 是否为移动设备（默认 false） |
| `user_agent`          | string  | ❌   | 自定义 User-Agent            |

**返回值**: 无

---

##### `cdp_set_geolocation`

模拟地理位置。

| 参数        | 类型   | 必需 | 描述                       |
| ----------- | ------ | ---- | -------------------------- |
| `latitude`  | number | ✅   | 纬度                       |
| `longitude` | number | ✅   | 经度                       |
| `accuracy`  | number | ❌   | 精度（米），默认 1         |

**返回值**: 无

---

##### `cdp_set_user_agent`

运行时修改 User-Agent。

| 参数         | 类型   | 必需 | 描述                                    |
| ------------ | ------ | ---- | --------------------------------------- |
| `user_agent` | string | ✅   | 新的 User-Agent 字符串                  |
| `platform`   | string | ❌   | 平台标识（如 `Win32`、`MacIntel`）      |

**返回值**: 无

---

#### 高级交互（Advanced Interaction）

##### `cdp_get_element_box`

获取元素的包围盒坐标（用于精确定位和截图裁剪）。

| 参数            | 类型   | 必需 | 描述                                        |
| --------------- | ------ | ---- | ------------------------------------------- |
| `selector`      | string | ✅   | 目标元素选择器                              |
| `selector_type` | string | ❌   | 选择器类型，默认 `css`                      |
| `output_key`    | string | ❌   | 将 `{x, y, width, height}` JSON 存入此变量名 |

**返回值**: `{x, y, width, height}`

---

##### `cdp_highlight_element`

高亮显示页面元素（调试辅助，截图时标记目标）。

| 参数            | 类型    | 必需 | 描述                                    |
| --------------- | ------- | ---- | --------------------------------------- |
| `selector`      | string  | ✅   | 目标元素选择器                          |
| `selector_type` | string  | ❌   | 选择器类型，默认 `css`                  |
| `color`         | string  | ❌   | 高亮颜色（默认 red，支持 CSS 颜色值）   |
| `duration_ms`   | integer | ❌   | 高亮持续时间（毫秒，默认 3000）         |

**返回值**: 无

---

##### `cdp_mouse_move`

移动鼠标到指定坐标（用于 hover 效果、拖拽前置）。

| 参数 | 类型   | 必需 | 描述       |
| ---- | ------ | ---- | ---------- |
| `x`  | number | ✅   | 目标 X 坐标 |
| `y`  | number | ✅   | 目标 Y 坐标 |

**返回值**: 无

---

##### `cdp_drag_and_drop`

拖拽元素从 A 到 B（支持选择器或坐标）。

| 参数            | 类型   | 必需 | 描述                                  |
| --------------- | ------ | ---- | ------------------------------------- |
| `from_selector` | string | ❌   | 源元素选择器（与 `from_x/from_y` 二选一） |
| `to_selector`   | string | ❌   | 目标元素选择器（与 `to_x/to_y` 二选一）  |
| `from_x`        | number | ❌   | 起始 X 坐标                           |
| `from_y`        | number | ❌   | 起始 Y 坐标                           |
| `to_x`          | number | ❌   | 目标 X 坐标                           |
| `to_y`          | number | ❌   | 目标 Y 坐标                           |
| `selector_type` | string | ❌   | 选择器类型，默认 `css`                |

**返回值**: 无

---

##### `cdp_select_option`

选择 `<select>` 下拉框的选项。

| 参数            | 类型    | 必需 | 描述                               |
| --------------- | ------- | ---- | ---------------------------------- |
| `selector`      | string  | ✅   | select 元素选择器                  |
| `value`         | string  | ❌   | 要选中的 value（与 `index` 二选一）|
| `index`         | integer | ❌   | 要选中的选项索引，0-based          |
| `selector_type` | string  | ❌   | 选择器类型，默认 `css`             |
| `output_key`    | string  | ❌   | 将选中值存入此变量名               |

**返回值**: 无

---

##### `cdp_check_checkbox`

勾选/取消勾选 checkbox 或 radio。

| 参数            | 类型    | 必需 | 描述                                |
| --------------- | ------- | ---- | ----------------------------------- |
| `selector`      | string  | ✅   | checkbox/radio 元素选择器           |
| `checked`       | boolean | ❌   | 目标状态：true=勾选，false=取消，默认 true |
| `selector_type` | string  | ❌   | 选择器类型，默认 `css`              |

**返回值**: 无

---

#### 网络与调试（Network / Debug）

##### `cdp_block_urls`

屏蔽匹配模式的 URL（如广告、追踪器），支持 `*` 通配符。

| 参数       | 类型          | 必需 | 描述                            |
| ---------- | ------------- | ---- | ------------------------------- |
| `patterns` | array[string] | ✅   | URL 模式列表，支持 `*` 通配符  |

**返回值**: 无

---

##### `cdp_intercept_request`

拦截并修改网络请求（block=屏蔽, mock=模拟返回, modify=修改 headers）。

| 参数          | 类型   | 必需 | 描述                                |
| ------------- | ------ | ---- | ----------------------------------- |
| `url_pattern` | string | ✅   | URL 匹配模式，支持 `*` 通配符      |
| `action`      | string | ✅   | 拦截动作: `block` / `mock` / `modify` |
| `headers`     | object | ❌   | 要修改/添加的 headers（modify 模式）|
| `body`        | string | ❌   | 模拟返回的 body（mock 模式）        |
| `status`      | integer| ❌   | 模拟返回的状态码（mock 模式，默认 200）|

**返回值**: 无

---

##### `cdp_get_console_logs`

获取浏览器控制台日志（最近 N 条）。

| 参数         | 类型    | 必需 | 描述                                              |
| ------------ | ------- | ---- | ------------------------------------------------- |
| `limit`      | integer | ❌   | 返回条数上限（默认 50）                           |
| `level`      | string  | ❌   | 按级别过滤: `log` / `warn` / `error` / `info`     |
| `output_key` | string  | ❌   | 将日志 JSON 数组存入此变量名                      |

**返回值**: 日志条目数组 JSON

---

##### `cdp_get_network_requests`

获取最近的网络请求记录（通过 JS 注入实现，不捕获响应体）。

| 参数           | 类型    | 必需 | 描述                         |
| -------------- | ------- | ---- | ---------------------------- |
| `limit`        | integer | ❌   | 返回条数上限（默认 20）      |
| `url_pattern`  | string  | ❌   | URL 过滤模式                 |
| `output_key`   | string  | ❌   | 将请求记录 JSON 数组存入此变量名 |

**返回值**: 请求记录数组（含 URL、方法、状态码、MIME 类型）

---

##### `cdp_pdf`

将当前页面导出为 PDF。

| 参数             | 类型    | 必需 | 描述                               |
| ---------------- | ------- | ---- | ---------------------------------- |
| `path`           | string  | ❌   | 保存路径（不传则返回 base64）      |
| `landscape`      | boolean | ❌   | 横向打印，默认 false               |
| `scale`          | number  | ❌   | 缩放比例（默认 1）                 |
| `paper_width`    | number  | ❌   | 纸张宽度（英寸）                   |
| `paper_height`   | number  | ❌   | 纸张高度（英寸）                   |
| `output_key`     | string  | ❌   | 将文件路径或 base64 存入此变量名   |

**返回值**: 文件路径或 base64 字符串

---

##### `cdp_handle_dialog`

处理浏览器 JavaScript 对话框（alert / confirm / prompt）。

| 参数          | 类型   | 必需 | 描述                                          |
| ------------- | ------ | ---- | --------------------------------------------- |
| `action`      | string | ✅   | `accept`=接受/确认，`dismiss`=取消/关闭       |
| `prompt_text` | string | ❌   | prompt 对话框的输入文本（仅 `action=accept` 时有效） |

**返回值**: 无

---

### 3.3 Magic Controller 工具（66 个）

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

通过 Magic Controller 输入文本（模拟键盘输入）。这是文本输入的**首选工具**，相比 `cdp_type` 更接近真实键盘输入行为。

**前置条件**: 目标输入区域必须已处于焦点状态。调用前需先通过 `cdp_click` 点击输入框使其获得焦点。

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

#### 扩展管理（3 个，新脚本推荐）

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

兼容旧脚本：`magic_enable_extension` / `magic_disable_extension` 仍可被历史自动化执行，但已从新建工具定义中移除。新脚本应通过环境插件配置和 `extension-state-file` 管理扩展启用状态。

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
| `format`               | string  | ❌   | 图片格式: `png` / `jpeg`，默认 `png`。原图按该格式落盘，发模时可能被自动优化为更小格式 |
| `output_path`          | string  | ❌   | 保存路径（默认自动生成）             |
| `output_key_file_path` | string  | ❌   | 将文件路径存入此变量名               |

**返回值**: 截图文件路径；发给 AI 的图片会自动压缩，格式可能是 `png` 或 `jpeg`

---

#### 窗口状态查询（4 个）

##### `magic_get_maximized`

查询窗口是否处于最大化状态。

| 参数         | 类型   | 必需 | 描述                    |
| ------------ | ------ | ---- | ----------------------- |
| `output_key` | string | ❌   | 将 true/false 存入此变量名 |

**返回值**: `true` / `false`

---

##### `magic_get_minimized`

查询窗口是否处于最小化状态。

| 参数         | 类型   | 必需 | 描述                    |
| ------------ | ------ | ---- | ----------------------- |
| `output_key` | string | ❌   | 将 true/false 存入此变量名 |

**返回值**: `true` / `false`

---

##### `magic_get_fullscreen`

查询窗口是否处于全屏状态。

| 参数         | 类型   | 必需 | 描述                    |
| ------------ | ------ | ---- | ----------------------- |
| `output_key` | string | ❌   | 将 true/false 存入此变量名 |

**返回值**: `true` / `false`

---

##### `magic_get_window_state`

一次性获取窗口完整状态（bounds + maximized + minimized + fullscreen）。

| 参数         | 类型   | 必需 | 描述                       |
| ------------ | ------ | ---- | -------------------------- |
| `output_key` | string | ❌   | 将完整窗口状态 JSON 存入此变量名 |

**返回值**: 窗口状态 JSON（含 bounds、maximized、minimized、fullscreen 字段）

---

#### Cookie 导入（1 个）

##### `magic_import_cookies`

从 JSON 数据批量导入 Cookie 到浏览器。

| 参数         | 类型          | 必需 | 描述                                                          |
| ------------ | ------------- | ---- | ------------------------------------------------------------- |
| `cookies`    | array[object] | ✅   | Cookie 数组，每项含 `name`(必需)、`value`(必需)、`domain`、`path`、`expires`、`httpOnly`、`secure` |
| `output_key` | string        | ❌   | 将导入数量存入此变量名                                        |

**返回值**: 导入数量

---

#### AI Agent 语义化操作（13 个）

##### `magic_get_browser`

根据 browser_id 获取指定浏览器窗口信息。

| 参数         | 类型    | 必需 | 描述                   |
| ------------ | ------- | ---- | ---------------------- |
| `browser_id` | integer | ✅   | 浏览器窗口 ID          |
| `output_key` | string  | ❌   | 将结果存入此变量名     |

**返回值**: 浏览器窗口信息 JSON

---

##### `magic_click_at`

坐标系点击，将虚拟坐标映射到浏览器窗口像素坐标并注入鼠标事件。

| 参数          | 类型     | 必需 | 描述                                         |
| ------------- | -------- | ---- | -------------------------------------------- |
| `grid`        | string   | ✅   | 虚拟坐标系尺寸，格式 `'宽,高'`，如 `'1200,800'` |
| `position`    | string   | ✅   | 目标点坐标，格式 `'x,y'`，如 `'125,60'`     |
| `button`      | string   | ❌   | 鼠标按钮：`left` / `right` / `middle`       |
| `modifiers`   | string[] | ❌   | 修饰键列表：`shift` / `ctrl` / `alt` / `meta` |
| `click_count` | integer  | ❌   | 点击次数，1=单击 2=双击 3=三击              |
| `action`      | string   | ❌   | 动作类型：`click` / `down` / `up` / `move`  |
| `browser_id`  | integer  | ❌   | 目标窗口 ID，省略则使用活动窗口              |
| `output_key`  | string   | ❌   | 将结果存入此变量名                           |

**返回值**: 点击结果

---

##### `magic_click_element`

语义化点击浏览器 Chrome UI 元素（工具栏/标签栏/菜单），无需截图。

| 参数         | 类型    | 必需 | 描述                                                         |
| ------------ | ------- | ---- | ------------------------------------------------------------ |
| `target`     | string  | ✅   | 目标元素标识：`back_button`、`forward_button`、`reload_button`、`bookmark_star`、`avatar_button`、`app_menu_button`、`tab_search_button`、`location_bar`、`new_tab_button`、`tab:{index}`、`tab_close:{index}`、`app_menu_item:{command_id}` |
| `browser_id` | integer | ❌   | 目标窗口 ID，省略则使用活动窗口                              |
| `output_key` | string  | ❌   | 将结果存入此变量名                                           |

**返回值**: 点击结果

---

##### `magic_get_ui_elements`

查询浏览器 UI 当前状态（工具栏按钮、标签页列表、菜单），供 Agent 决策。

| 参数         | 类型    | 必需 | 描述                            |
| ------------ | ------- | ---- | ------------------------------- |
| `browser_id` | integer | ❌   | 目标窗口 ID，省略则使用活动窗口 |
| `output_key` | string  | ❌   | 将结果存入此变量名              |

**返回值**: UI 元素树 JSON

---

##### `magic_navigate_to`

导航到指定 URL（使用 Magic Controller，比 CDP 更可靠）。

| 参数         | 类型    | 必需 | 描述                   |
| ------------ | ------- | ---- | ---------------------- |
| `url`        | string  | ✅   | 目标 URL               |
| `tab_id`     | integer | ❌   | 目标标签页 ID          |
| `output_key` | string  | ❌   | 将结果存入此变量名     |

**返回值**: 导航结果

---

##### `magic_query_dom`

DOM 元素查询，返回匹配元素候选列表（用于后续 `magic_click_dom`/`magic_fill_dom` 定位）。

| 参数           | 类型    | 必需 | 描述                                                                  |
| -------------- | ------- | ---- | --------------------------------------------------------------------- |
| `by`           | string  | ✅   | 选择器类型：`css` / `xpath` / `text` / `aria` / `role` / `placeholder` / `name` / `search` / `idx` |
| `selector`     | string  | ✅   | 选择器值                                                              |
| `match`        | string  | ❌   | 文本匹配模式：`contains` / `icontains` / `exact` / `regex` / `starts_with` / `ends_with` |
| `tab_id`       | integer | ❌   | 目标标签页 ID                                                         |
| `limit`        | integer | ❌   | 返回结果数量上限                                                      |
| `visible_only` | boolean | ❌   | 只返回可见元素                                                        |
| `output_key`   | string  | ❌   | 将结果存入此变量名                                                    |

**返回值**: 匹配元素列表 JSON

---

##### `magic_click_dom`

点击 DOM 元素（支持多种选择器方式，比 CDP 更稳定）。

| 参数           | 类型    | 必需 | 描述                               |
| -------------- | ------- | ---- | ---------------------------------- |
| `by`           | string  | ✅   | 选择器类型（同 `magic_query_dom`） |
| `selector`     | string  | ✅   | 选择器值                           |
| `match`        | string  | ❌   | 文本匹配模式（同上）               |
| `index`        | integer | ❌   | 多个匹配结果时选取的索引（从 0 开始） |
| `tab_id`       | integer | ❌   | 目标标签页 ID                      |
| `visible_only` | boolean | ❌   | 只操作可见元素                     |
| `output_key`   | string  | ❌   | 将结果存入此变量名                 |

**返回值**: 点击结果

---

##### `magic_fill_dom`

填写表单元素（支持清空后输入，比 CDP 更稳定）。

| 参数           | 类型    | 必需 | 描述                                    |
| -------------- | ------- | ---- | --------------------------------------- |
| `by`           | string  | ✅   | 选择器类型（同 `magic_query_dom`）      |
| `selector`     | string  | ✅   | 选择器值                                |
| `value`        | string  | ✅   | 要填写的内容                            |
| `match`        | string  | ❌   | 文本匹配模式（同上）                    |
| `index`        | integer | ❌   | 多个匹配结果时选取的索引（从 0 开始）   |
| `clear`        | boolean | ❌   | 填写前是否先清空，默认 `true`           |
| `tab_id`       | integer | ❌   | 目标标签页 ID                           |
| `visible_only` | boolean | ❌   | 只操作可见元素                          |
| `output_key`   | string  | ❌   | 将结果存入此变量名                      |

**返回值**: 填写结果

---

##### `magic_send_keys`

键盘输入（支持特殊键/快捷键组合/文字输入）。

| 参数         | 类型     | 必需 | 描述                                                |
| ------------ | -------- | ---- | --------------------------------------------------- |
| `keys`       | string[] | ✅   | 按键序列，支持 `Enter`、`Tab`、`Escape`、`ArrowDown`、`ctrl+a` 等 |
| `tab_id`     | integer  | ❌   | 目标标签页 ID                                       |
| `output_key` | string   | ❌   | 将结果存入此变量名                                  |

**返回值**: 输入结果

---

##### `magic_get_page_info`

获取页面综合状态信息（URL、标题、加载状态、标签页列表等）。

| 参数         | 类型    | 必需 | 描述                   |
| ------------ | ------- | ---- | ---------------------- |
| `tab_id`     | integer | ❌   | 目标标签页 ID          |
| `output_key` | string  | ❌   | 将结果存入此变量名     |

**返回值**: 页面综合状态 JSON

---

##### `magic_scroll`

页面滚动（按方向/距离，或滚动到指定元素）。

| 参数           | 类型    | 必需 | 描述                               |
| -------------- | ------- | ---- | ---------------------------------- |
| `direction`    | string  | ❌   | 滚动方向：`up` / `down` / `left` / `right` |
| `distance`     | integer | ❌   | 滚动距离（像素）                   |
| `by`           | string  | ❌   | 元素定位方式（滚动到元素时使用）   |
| `selector`     | string  | ❌   | 目标元素选择器                     |
| `index`        | integer | ❌   | 多匹配时选择索引                   |
| `visible_only` | boolean | ❌   | 只操作可见元素                     |
| `tab_id`       | integer | ❌   | 目标标签页 ID                      |
| `output_key`   | string  | ❌   | 将结果存入此变量名                 |

**返回值**: 滚动结果

---

##### `magic_set_dock_icon_text`

设置 Dock 图标文字标签（macOS）。

| 参数         | 类型   | 必需 | 描述                              |
| ------------ | ------ | ---- | --------------------------------- |
| `text`       | string | ✅   | 显示在 Dock 图标上的文字          |
| `color`      | string | ❌   | 文字颜色（十六进制，如 `#FF0000`） |
| `output_key` | string | ❌   | 将结果存入此变量名                |

**返回值**: 设置结果

---

##### `magic_get_page_content`

获取页面语义快照（结构化 DOM 树、可交互元素、文本内容等）。

| 参数              | 类型     | 必需 | 描述                                                    |
| ----------------- | -------- | ---- | ------------------------------------------------------- |
| `mode`            | string   | ❌   | 快照模式：`summary` / `interactive` / `content` / `a11y` / `full` |
| `format`          | string   | ❌   | 输出格式：`json` / `text`                               |
| `tab_id`          | integer  | ❌   | 目标标签页 ID                                           |
| `viewport_only`   | boolean  | ❌   | 只返回视口内元素                                        |
| `max_elements`    | integer  | ❌   | 最大元素数量                                            |
| `max_text_length` | integer  | ❌   | 最大文本长度                                            |
| `max_depth`       | integer  | ❌   | DOM 最大深度                                            |
| `include_hidden`  | boolean  | ❌   | 是否包含隐藏元素                                        |
| `regions`         | string[] | ❌   | 只提取指定区域（CSS 选择器列表）                        |
| `exclude_regions` | string[] | ❌   | 排除指定区域（CSS 选择器列表）                          |
| `output_key`      | string   | ❌   | 将结果存入此变量名                                      |

**返回值**: 页面语义快照（JSON 或文本）

---

### 3.4 App Data 工具（26 个）

通过 `AppState` 中的 Service 操作应用数据。所有返回值均为序列化后的 JSON 字符串。

#### Profile 操作（10 个）

##### `app_list_profiles`

列出 profile 列表，支持分组和关键字过滤。

| 参数              | 类型    | 必需 | 描述                                   |
| ----------------- | ------- | ---- | -------------------------------------- |
| `group_id`        | string  | ❌   | 按分组名称过滤（兼容历史字段名）       |
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

删除已停止的 profile（移入回收站）。运行中的环境必须先调用 `app_stop_profile` 停止。

| 参数         | 类型   | 必需 | 描述                |
| ------------ | ------ | ---- | ------------------- |
| `profile_id` | string | ✅   | 要删除的 Profile ID，必须处于停止状态 |

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

##### `app_set_chat_active_profile`

仅 AI Chat 使用：切换当前聊天会话的工具目标环境。切换成功后，后续 `cdp_*` / `magic_*` 工具都会作用到该环境。

| 参数         | 类型   | 必需 | 描述                                        |
| ------------ | ------ | ---- | ------------------------------------------- |
| `profile_id` | string | ✅   | 目标 Profile ID，且必须已关联到当前聊天会话 |

**返回值**: 更新后的 ChatSession JSON

---

##### `app_get_current_profile`

获取当前工具目标环境的 profile 信息。AI Chat 中返回当前聊天会话绑定的工具目标环境；自动化脚本中返回当前运行环境。

| 参数       | 类型 | 必需 | 描述 |
| ---------- | ---- | ---- | ---- |
| （无参数） | —    | —    | —    |

**返回值**: 当前 Profile 详情 JSON

---

#### 机型预设操作（5 个）

##### `app_list_device_presets`

列出机型预设，支持按平台过滤。

| 参数       | 类型   | 必需 | 描述                                                           |
| ---------- | ------ | ---- | -------------------------------------------------------------- |
| `platform` | string | ❌   | 按平台过滤，如 `windows` / `macos` / `linux` / `android` / `ios` |

**返回值**: 机型预设列表 JSON

---

##### `app_get_device_preset`

按 ID 获取机型预设详情。

| 参数        | 类型   | 必需 | 描述        |
| ----------- | ------ | ---- | ----------- |
| `preset_id` | string | ✅   | 机型预设 ID |

**返回值**: 机型预设详情 JSON

---

##### `app_create_device_preset`

创建新的机型预设。

| 参数                   | 类型    | 必需 | 描述                                  |
| ---------------------- | ------- | ---- | ------------------------------------- |
| `label`                | string  | ✅   | 机型名称                              |
| `platform`             | string  | ✅   | 平台，如 `windows` / `android`        |
| `platform_version`     | string  | ✅   | 平台版本，如 `14.0.0`                 |
| `viewport_width`       | integer | ✅   | 默认视口宽度                          |
| `viewport_height`      | integer | ✅   | 默认视口高度                          |
| `device_scale_factor`  | number  | ✅   | 默认 DPR / 设备像素比                 |
| `touch_points`         | integer | ✅   | 最大触控点数                          |
| `custom_platform`      | string  | ✅   | 自定义 platform 字符串                |
| `arch`                 | string  | ✅   | 架构，如 `x86` / `arm`                |
| `bitness`              | string  | ✅   | 位数，如 `64`                         |
| `mobile`               | boolean | ✅   | 是否为移动端机型                      |
| `form_factor`          | string  | ✅   | 形态，如 `Desktop` / `Mobile` / `Tablet` |
| `user_agent_template`  | string  | ✅   | UA 模板，必须包含 `{version}`         |
| `custom_gl_vendor`     | string  | ✅   | WebGL vendor                          |
| `custom_gl_renderer`   | string  | ✅   | WebGL renderer                        |
| `custom_cpu_cores`     | integer | ✅   | CPU 核心数                            |
| `custom_ram_gb`        | integer | ✅   | RAM 大小（GB）                        |

**返回值**: 创建后的机型预设 JSON

---

##### `app_update_device_preset`

更新已有机型预设，并自动同步引用该预设的活跃环境。

| 参数                   | 类型    | 必需 | 描述                          |
| ---------------------- | ------- | ---- | ----------------------------- |
| `preset_id`            | string  | ✅   | 机型预设 ID                   |
| `label`                | string  | ✅   | 机型名称                      |
| `platform`             | string  | ✅   | 平台                          |
| `platform_version`     | string  | ✅   | 平台版本                      |
| `viewport_width`       | integer | ✅   | 默认视口宽度                  |
| `viewport_height`      | integer | ✅   | 默认视口高度                  |
| `device_scale_factor`  | number  | ✅   | 默认 DPR / 设备像素比         |
| `touch_points`         | integer | ✅   | 最大触控点数                  |
| `custom_platform`      | string  | ✅   | 自定义 platform 字符串        |
| `arch`                 | string  | ✅   | 架构                          |
| `bitness`              | string  | ✅   | 位数                          |
| `mobile`               | boolean | ✅   | 是否为移动端机型              |
| `form_factor`          | string  | ✅   | 形态                          |
| `user_agent_template`  | string  | ✅   | UA 模板，必须包含 `{version}` |
| `custom_gl_vendor`     | string  | ✅   | WebGL vendor                  |
| `custom_gl_renderer`   | string  | ✅   | WebGL renderer                |
| `custom_cpu_cores`     | integer | ✅   | CPU 核心数                    |
| `custom_ram_gb`        | integer | ✅   | RAM 大小（GB）                |
| `browser_version`      | string  | ✅   | Chromium 伪装版本             |

**返回值**: `{ preset, synced_count }`

---

##### `app_delete_device_preset`

删除机型预设。

| 参数        | 类型   | 必需 | 描述              |
| ----------- | ------ | ---- | ----------------- |
| `preset_id` | string | ✅   | 要删除的机型预设 ID |

**返回值**: 删除结果

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

| 参数                 | 类型   | 必需 | 描述                                                  |
| -------------------- | ------ | ---- | ----------------------------------------------------- |
| `name`               | string | ✅   | 分组名称                                              |
| `browser_bg_color`   | string | ❌   | 分组默认背景色（十六进制，如 `#FF5733`）              |
| `toolbar_label_mode` | string | ❌   | 分组默认标识模式：`id_only` / `group_name_and_id`     |

**返回值**: 创建的分组 JSON

---

##### `app_update_group`

更新分组信息。

| 参数                 | 类型   | 必需 | 描述                                              |
| -------------------- | ------ | ---- | ------------------------------------------------- |
| `group_id`           | string | ✅   | 分组 ID                                           |
| `name`               | string | ❌   | 新名称                                            |
| `browser_bg_color`   | string | ❌   | 新的默认背景色（十六进制）                        |
| `toolbar_label_mode` | string | ❌   | 新的默认标识模式：`id_only` / `group_name_and_id` |

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

### 3.5 Auto 工具（19 个）

自动化管理工具，供 AI Agent 管理脚本、运行、AI Provider 和 CAPTCHA Provider 配置。

**执行器**: `src-tauri/src/services/ai_tools/auto_tools.rs`
**前缀**: `auto_`，路由类别 `"auto"`

#### 脚本管理（6 个）

| 工具名 | 必填参数 | 说明 |
|--------|----------|------|
| `auto_list_scripts` | — | 列出所有脚本摘要（id、name、step_count 等） |
| `auto_get_script` | `script_id` | 获取脚本完整详情（含步骤、变量 schema） |
| `auto_create_script` | `name` | 创建脚本（可选 description、steps、associated_profile_ids、ai_config_id） |
| `auto_update_script` | `script_id` | 更新脚本（未传字段保持原值） |
| `auto_delete_script` | `script_id` | 永久删除脚本（不可撤销） |
| `auto_export_script` | `script_id` | 导出脚本为格式化 JSON 字符串 |

#### 运行管理（5 个）

| 工具名 | 必填参数 | 说明 |
|--------|----------|------|
| `auto_run_script` | `script_id` | 异步执行脚本，返回 `{ run_id }`（含递归防护） |
| `auto_list_runs` | `script_id` | 列出脚本运行历史 |
| `auto_list_active_runs` | — | 列出当前所有活跃 run_id |
| `auto_get_run` | `run_id` | 获取运行详情（状态、步骤结果、日志） |
| `auto_cancel_run` | `run_id` | 取消正在执行的运行 |

> **注意**: `auto_run_script` 包含递归防护——若目标 `script_id` 与当前运行脚本相同，执行将被拒绝。

#### AI Provider 配置管理（4 个）

| 工具名 | 必填参数 | 说明 |
|--------|----------|------|
| `auto_list_ai_configs` | — | 列出所有 AI 配置（API Key 脱敏，仅显示末 4 位） |
| `auto_create_ai_config` | `name` | 创建 AI 配置（可选 provider、base_url、api_key、model、locale） |
| `auto_update_ai_config` | `id`, `name` | 更新 AI 配置 |
| `auto_delete_ai_config` | `id` | 删除 AI 配置（不可撤销） |

#### CAPTCHA Provider 配置管理（4 个）

| 工具名 | 必填参数 | 说明 |
|--------|----------|------|
| `auto_list_captcha_configs` | — | 列出所有 CAPTCHA 配置（API Key 脱敏） |
| `auto_create_captcha_config` | `provider`, `api_key` | 创建 CAPTCHA 配置（provider: 2captcha \| capsolver \| anticaptcha \| capmonster） |
| `auto_update_captcha_config` | `id`, `provider`, `api_key` | 更新 CAPTCHA 配置 |
| `auto_delete_captcha_config` | `id` | 删除 CAPTCHA 配置（不可撤销） |

---

### 3.6 File I/O 工具（6 个）

安全的文件系统操作，固定限制在 `appData/fs` 根目录下，带有大小限制（10MB）和路径遍历保护。所有 `path` 参数都必须是 `fs` 内相对路径，`.` 表示 `fs` 根目录。

##### `file_read`

读取文本文件内容（最大 10MB）。

| 参数   | 类型   | 必需 | 描述         |
| ------ | ------ | ---- | ------------ |
| `path` | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |

**返回值**: 文件文本内容

---

##### `file_write`

写入文本到文件（覆盖已有内容）。

| 参数      | 类型   | 必需 | 描述             |
| --------- | ------ | ---- | ---------------- |
| `path`    | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |
| `content` | string | ✅   | 要写入的文本内容 |

**返回值**: 写入确认

---

##### `file_append`

追加文本到文件末尾。

| 参数      | 类型   | 必需 | 描述             |
| --------- | ------ | ---- | ---------------- |
| `path`    | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |
| `content` | string | ✅   | 要追加的文本内容 |

**返回值**: 追加确认

---

##### `file_list_dir`

列出目录内容。

| 参数   | 类型   | 必需 | 描述         |
| ------ | ------ | ---- | ------------ |
| `path` | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |

**返回值**: 目录内容列表

---

##### `file_exists`

检查文件或目录是否存在。

| 参数   | 类型   | 必需 | 描述                 |
| ------ | ------ | ---- | -------------------- |
| `path` | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |

**返回值**: `true` / `false`

---

##### `file_mkdir`

递归创建目录。

| 参数   | 类型   | 必需 | 描述                 |
| ------ | ------ | ---- | -------------------- |
| `path` | string | ✅   | `appData/fs` 内相对路径，`.` 表示 `fs` 根目录 |

**返回值**: 创建确认

---

### 3.7 Dialog 工具（13 个）

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

##### `dialog_select`

向用户展示选项选择弹窗，支持单选/多选。

| 参数           | 类型          | 必需 | 描述                                                                              |
| -------------- | ------------- | ---- | --------------------------------------------------------------------------------- |
| `title`        | string        | ❌   | 弹窗标题                                                                          |
| `message`      | string        | ❌   | 提示信息                                                                          |
| `options`      | array[object] | ✅   | 选项列表（2-20 项），每项含 `label`(string)、`value`(string)、`description`(string, 可选) |
| `multi_select` | boolean       | ❌   | 是否允许多选，默认 `false`                                                        |
| `max_select`   | integer       | ❌   | 多选时最大选择数量                                                                |

**返回值**: `{cancelled: boolean, selected: string | string[] | null}`（多选时 `selected` 为数组）

---

##### `dialog_form`

向用户展示多字段表单弹窗，一次性收集多个输入。避免连续弹多个 `dialog_input`。

| 参数           | 类型          | 必需 | 描述                                                                                                                         |
| -------------- | ------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| `title`        | string        | ❌   | 弹窗标题                                                                                                                     |
| `message`      | string        | ❌   | 表单顶部说明文字                                                                                                             |
| `fields`       | array[object] | ✅   | 字段列表（1-15 项），每项含 `name`(必需)、`label`(必需)、`type`(text/number/password/textarea/select/checkbox/date/email/url)、`required`(boolean)、`default_value`、`placeholder`、`options`(select 类型用)、`validation`(正则)、`hint` |
| `submit_label` | string        | ❌   | 提交按钮文字，默认"确定"                                                                                                     |

**返回值**: `{cancelled: boolean, values: {[fieldName]: value} | null}`

---

##### `dialog_table`

向用户展示数据表格弹窗，可选择行。适用于展示抓取结果、对比数据等结构化信息。

| 参数           | 类型          | 必需 | 描述                                                                              |
| -------------- | ------------- | ---- | --------------------------------------------------------------------------------- |
| `title`        | string        | ❌   | 弹窗标题                                                                          |
| `message`      | string        | ❌   | 表格顶部说明文字                                                                  |
| `columns`      | array[object] | ✅   | 列定义，每项含 `key`(必需)、`label`(必需)、`width`(integer, px)、`align`(left/center/right) |
| `rows`         | array[object] | ✅   | 行数据，每项为以列 key 为键的对象                                                 |
| `selectable`   | boolean       | ❌   | 是否允许选行，默认 `false`                                                        |
| `multi_select` | boolean       | ❌   | 是否允许多选行，默认 `false`                                                      |
| `max_height`   | integer       | ❌   | 表格最大高度（px），默认 400                                                      |

**返回值**: `{confirmed: boolean, selected_indices: number[] | null}`（`selected_indices` 为选中行的索引数组）

---

##### `dialog_image`

向用户展示图片预览弹窗，可附带输入框（如验证码输入）和自定义操作按钮。

| 参数                | 类型          | 必需 | 描述                                         |
| ------------------- | ------------- | ---- | -------------------------------------------- |
| `title`             | string        | ❌   | 弹窗标题                                     |
| `message`           | string        | ❌   | 图片上方说明文字                             |
| `image`             | string        | ✅   | base64 编码图片数据或本地文件路径            |
| `image_format`      | string        | ❌   | 图片格式，默认 `png`。可选: `png` / `jpeg` / `webp` / `gif` |
| `input_label`       | string        | ❌   | 输入框标签（若提供则显示输入框）             |
| `input_placeholder` | string        | ❌   | 输入框占位符                                 |
| `actions`           | array[object] | ❌   | 自定义操作按钮，每项含 `label`(string)、`value`(string) |

**返回值**: `{cancelled: boolean, value: string | null, action: string | null}`

---

##### `dialog_countdown`

向用户展示倒计时确认弹窗，用于危险操作前给用户反悔时间。

| 参数           | 类型    | 必需 | 描述                                                    |
| -------------- | ------- | ---- | ------------------------------------------------------- |
| `title`        | string  | ❌   | 弹窗标题                                                |
| `message`      | string  | ✅   | 操作说明                                                |
| `seconds`      | integer | ✅   | 倒计时秒数（3-60）                                      |
| `level`        | string  | ❌   | 级别，默认 `warning`。可选: `info` / `warning` / `danger` |
| `action_label` | string  | ❌   | 倒计时结束后的操作按钮文字，默认"继续执行"              |
| `auto_proceed` | boolean | ❌   | 倒计时结束后是否自动继续，默认 `false`                  |

**返回值**: `{cancelled: boolean}`

---

##### `dialog_toast`

显示通知提示（Toast），可附带操作按钮。无按钮时不阻塞，有按钮时等待用户操作。

| 参数          | 类型          | 必需 | 描述                                                    |
| ------------- | ------------- | ---- | ------------------------------------------------------- |
| `title`       | string        | ❌   | 通知标题                                                |
| `message`     | string        | ✅   | 通知内容                                                |
| `level`       | string        | ❌   | 级别，默认 `info`。可选: `info` / `success` / `warning` / `error` |
| `duration_ms` | integer       | ❌   | 自动消失时间（ms），默认 5000，0 表示不自动消失         |
| `actions`     | array[object] | ❌   | 操作按钮（最多 2 个），每项含 `label`(string)、`value`(string) |
| `persistent`  | boolean       | ❌   | 是否持续显示直到用户操作，默认 `false`                  |

**返回值**: `{dismissed: boolean, action: string | null}`（`action` 为用户点击的按钮 value）

---

##### `dialog_markdown`

向用户展示 Markdown 格式的富文本弹窗，支持表格、代码块等。适用于展示报告、分析结果。

| 参数         | 类型          | 必需 | 描述                                                                         |
| ------------ | ------------- | ---- | ---------------------------------------------------------------------------- |
| `title`      | string        | ❌   | 弹窗标题                                                                     |
| `content`    | string        | ✅   | Markdown 格式内容                                                            |
| `max_height` | integer       | ❌   | 内容区最大高度（px），默认 500                                               |
| `width`      | string        | ❌   | 弹窗宽度，默认 `md`。可选: `sm` / `md` / `lg` / `xl`                        |
| `actions`    | array[object] | ❌   | 操作按钮，每项含 `label`(string)、`value`(string)、`variant`(default/destructive/outline) |
| `copyable`   | boolean       | ❌   | 是否显示复制按钮，默认 `false`                                               |

**返回值**: `{action: string}`（用户点击的按钮 value，默认为 `"close"`）

---

### 3.8 Captcha 工具（5 个）

#### 工具列表

| 工具名 | 必填参数 | 说明 |
|--------|----------|------|
| `captcha_detect` | — | 检测当前页面上的 CAPTCHA 类型与参数，返回 `type / sitekey / callback / pageAction / enterprisePayload / userAgent / params` 等信息 |
| `captcha_solve` | `captcha_type` | 调用求解服务获取 token；当 `captcha_type=auto` 时会先读取当前页面的检测结果并透传页面 UA、enterprise 参数等上下文 |
| `captcha_inject_token` | `type`, `token` | 将 token 注入页面，并严格校验页面是否真正脱离验证码/风控阻塞；仅写入字段成功但页面仍阻塞会返回失败 |
| `captcha_solve_and_inject` | — | 自动执行检测 → 求解 → 注入 → 页面级回验；只有页面真实通过验证才返回成功 |
| `captcha_get_balance` | — | 查询当前 CAPTCHA 求解服务余额 |

#### 严格状态语义

- `tool_status=completed` 仅表示**页面实际通过验证码/风控拦截**，不再等同于“拿到 token”或“注入字段成功”。
- `captcha_inject_token` 与 `captcha_solve_and_inject` 失败时，`tool_result` 会包含结构化诊断信息，至少覆盖：
  - 检测到的 CAPTCHA 类型
  - 是否找到并调用回调
  - 是否仅完成字段注入
  - 页面是否仍停留在 challenge 状态
  - 求解器返回 UA 与页面真实 UA 是否不一致

#### 实现备注

- 后端检测逻辑会尽量提取 `callback`、`pageAction`、`data-s / enterprisePayload`、页面真实 `userAgent` 等上下文，并在求解时按服务商支持情况透传。
- 聊天系统提示词要求：验证码未通过时必须明确说明阻塞，不能把“注入成功”表述成“验证通过”，也不能未经用户同意擅自切换到 DuckDuckGo 等替代站点。

### 3.9 Skill 工具（6 个）

Agent 可通过这些工具动态安装、管理 skill。只要 Skill 处于全局启用状态，当前 Agent 就会自动可用。写操作（`skill_create`/`skill_update`/`skill_delete`/`skill_install`）属于危险工具，需要用户确认。默认内置 skill 来自仓库 `docs/default-skills`，可读取但不可删除，且与用户目录重名时以内置版本为准。

#### `skill_list`

列出所有已安装 skill 的元数据。

**参数**：无

**返回**：`SkillMeta[]` JSON — 包含 `slug, name, description, enabled, triggers, allowedTools, model, version, builtIn, deletable`

---

#### `skill_read`

读取指定 skill 的完整内容。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | Skill 标识符 |

**返回**：`SkillFull` JSON — 包含元数据 + `body` + `attachments[]`

---

#### `skill_create`

创建新 skill，写入 `{appData/fs}/.agents/skills/<slug>/SKILL.md`。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 唯一标识符，只允许 `a-z`、`0-9`、连字符 |
| `name` | string | 是 | 显示名称 |
| `body` | string | 是 | Skill 指令正文（Markdown） |
| `description` | string | 否 | 简短描述 |
| `version` | string | 否 | 版本号 |
| `enabled` | boolean | 否 | 默认 `true` |
| `triggers` | string[] | 否 | 触发词列表 |
| `allowedTools` | string[] | 否 | 工具白名单，空表示不限制 |
| `model` | string | 否 | 覆盖 session 模型 |

**返回**：`SkillFull` JSON

**风险**：Dangerous（写磁盘）

---

#### `skill_update`

更新已有 skill，只需传入要修改的字段。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 要更新的 skill |
| 其余字段同 `skill_create` | — | 否 | 未传则保持不变 |

**返回**：`SkillFull` JSON

**风险**：Dangerous

---

#### `skill_delete`

永久删除用户 skill 目录；默认内置 skill 不允许删除。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 要删除的 skill |

**返回**：确认字符串

**风险**：Dangerous

---

#### `skill_install`

从外部来源安装 skill，统一落盘到 `{appData/fs}/.agents/skills/<slug>/`。当前支持 `skills.sh` 链接、GitHub 仓库/路径、以及直接 `SKILL.md` 链接。安装后只要该 Skill 处于启用状态，当前 Agent 就会自动可用。

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `source` | string | 是 | 安装来源 |
| `sourceType` | string | 否 | `auto` / `url` / `git`，默认 `auto` |
| `slugHint` | string | 否 | 当仓库中存在多个 skill 时辅助定位 |

**返回**：`InstallSkillResult` JSON — 包含 `slug, name, installedPath, enabledForSession, sourceType, installedFiles, warnings`。其中 `enabledForSession` 为兼容字段，当前固定为 `false`

**限制**：
- 不支持覆盖已有 slug
- 仅同步 `scripts/`、`references/`、`assets/` 三类附件目录
- 不支持 zip、多 Skill 批量安装、任意本地目录导入

**风险**：Dangerous

---

## 4. 工具权限管理（危险工具确认机制）

### 4.1 概述

为防止 AI Agent 误操作导致数据丢失，Multi-Flow 对**危险工具**实施了执行前确认机制。危险工具指可能永久删除数据或导致不可逆状态变更的操作。

### 4.2 危险工具列表

| 工具名 | 显示名称 | 描述 |
| ------ | -------- | ---- |
| `app_delete_profile` | 删除环境 | 删除已停止的浏览器环境配置 |
| `app_delete_proxy` | 删除代理 | 永久删除指定的代理配置 |
| `app_delete_group` | 删除分组 | 永久删除指定的环境分组 |
| `app_stop_profile` | 停止环境 | 强制停止正在运行的浏览器环境 |
| `app_update_device_preset` | 修改机型预设 | 修改指定的机型预设参数，并同步引用它的环境配置 |
| `app_delete_device_preset` | 删除机型预设 | 永久删除指定的机型预设，引用它的环境将失去对应机型配置 |
| `magic_set_closed` | 关闭浏览器窗口 | 关闭当前浏览器窗口 |
| `magic_safe_quit` | 安全退出浏览器 | 安全退出整个浏览器应用（关闭所有窗口和标签页） |
| `file_write` | 写入文件 | 创建或覆盖文件内容 |
| `file_append` | 追加文件内容 | 向文件末尾追加内容 |
| `cdp_delete_cookies` | 删除 Cookie | 删除匹配的浏览器 Cookie |
| `cdp_clear_storage` | 清除存储 | 清除 Cookie/localStorage/sessionStorage/cache 等存储数据 |
| `auto_delete_script` | 删除脚本 | 永久删除指定的自动化脚本 |

### 4.3 确认机制实现

```rust
// src-tauri/src/services/ai_tools/mod.rs
pub fn tool_risk_level(tool_name: &str) -> ToolRiskLevel {
    match tool_name {
        // 危险工具 —— 破坏性操作
        "app_delete_profile" | "app_delete_proxy" | ... => ToolRiskLevel::Dangerous,
        // 安全工具 —— 只读操作
        name if name.starts_with("app_list_") || ... => ToolRiskLevel::Safe,
        // 其余为中等风险
        _ => ToolRiskLevel::Moderate,
    }
}
```

执行流程：
1. `ToolRegistry::execute()` 检测到危险工具
2. 查询用户偏好设置是否需要确认（默认需要）
3. 通过 Tauri 事件发送确认请求到前端
4. 前端显示确认弹窗等待用户响应（60 秒超时）
5. 用户确认后继续执行，否则返回取消消息

### 4.4 权限管理 UI

用户可在**设置 → AI 配置 → 工具权限**页面管理危险工具的确认要求：

- 单独开关每个工具的确认要求
- 批量设置为全部需要确认或全部免确认
- 显示功能名称、工具标识和描述便于识别

相关文件：
- 后端：`src-tauri/src/commands/chat_commands.rs` (`get_tool_permissions`, `set_tool_permission`, `set_all_tool_permissions`)
- 前端：`src/features/settings/ui/tool-permissions-card.tsx`
- 工具元数据：`src-tauri/src/commands/chat_commands.rs` (`get_tool_metadata`)

### 4.5 新增危险工具流程

如需新增危险工具，请同步更新：

1. `src-tauri/src/services/ai_tools/mod.rs`:
   - 在 `tool_risk_level()` 中添加工具到 Dangerous 分支
   - 在 `all_dangerous_tool_names()` 中添加工具名

2. `src-tauri/src/commands/chat_commands.rs`:
   - 在 `get_tool_metadata()` 中添加显示名称和描述

3. 确认设置页 UI 会自动展示新工具

## 5. 新增工具流程

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

## 6. 维护指引

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
| CDP              | 56      | `cdp_tools()`                  |
| Magic Controller | 53      | `magic_tools()`                |
| App Data         | 21      | `app_tools()`                  |
| Auto             | 19      | `auto_tools()`                 |
| File I/O         | 6       | `file_tools()`                 |
| Dialog           | 13      | `dialog_tools()`               |
| Captcha          | 5       | `captcha_tools()`              |
| Skill            | 6       | `skill_tools()`                |
| **总计**         | **182** | `all_tool_definitions().len()` |
