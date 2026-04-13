# AI Tools 扩展路线图

## 任务

1. 完整实现以下所有功能 全部实现后接入前端自动化中 完成后看看步骤列表是否需要进行UI布局重构 因为工具太多了 看看是否有好的方案 进行实现
2. 多语言支持 中文和英文 Agent prompt需根据语言切换
3. 关于AI模型的配置 请查询主流国内外提供商文档按照规范进行重构 目前我看所有的提供商都需要填入base URL 请按照规范设计并实现 最后添加一个自定义选项作为通用方案
4. 实现 [captcha-anti-bot-integration.md](docs/ai/captcha-anti-bot-integration.md)
5. 编写计划和划分任务并结合所需上下文一起写入实现文档然后开始执行实现过程中随进度更新 防止任务过长和压缩导致上下文丢失

> 基于 2026-04-03 审计结果，当前 121 个工具全部已实现。以下为待新增工具清单。

### 1. `cdp_get_cookies`

- **说明**：获取当前页面或指定域名的 cookies
- **实现方式**：CDP `Network.getCookies`
- **参数**：`urls?: string[]`（可选，不传则返回当前页面 cookies）
- **返回**：JSON 数组，每项包含 name/value/domain/path/expires 等
- **实现路径**：
  - `tool_defs.rs`：添加工具定义
  - `mod.rs`：在 CDP 执行分支中添加 `cdp_get_cookies` → `cdp.call("Network.getCookies", ...)`
  - 结果 JSON 字符串作为 tool result 返回

### 2. `cdp_set_cookie`

- **说明**：设置单个 cookie
- **实现方式**：CDP `Network.setCookie`
- **参数**：`name: string, value: string, domain?: string, path?: string, expires?: number, httpOnly?: bool, secure?: bool`
- **返回**：`{ success: true }`
- **实现路径**：
  - `tool_defs.rs`：添加工具定义
  - `mod.rs`：构建 `Network.setCookie` 参数对象，调用 CDP

### 3. `cdp_delete_cookies`

- **说明**：删除匹配的 cookies
- **实现方式**：CDP `Network.deleteCookies`
- **参数**：`name: string, domain?: string, path?: string`
- **返回**：`ok`
- **实现路径**：同上模式

### 4. `cdp_get_local_storage`

- **说明**：读取当前页面 localStorage 的指定 key 或全部
- **实现方式**：CDP `Runtime.evaluate` 执行 `JSON.stringify(localStorage)` 或 `localStorage.getItem(key)`
- **参数**：`key?: string`（不传返回全部）
- **返回**：key 指定时返回值字符串，否则返回 JSON 对象
- **实现路径**：
  - `mod.rs`：构建 JS 表达式，通过 `cdp.call("Runtime.evaluate", ...)` 执行

### 5. `cdp_set_local_storage`

- **说明**：写入当前页面 localStorage
- **实现方式**：CDP `Runtime.evaluate` 执行 `localStorage.setItem(key, value)`
- **参数**：`key: string, value: string`
- **返回**：`ok`
- **实现路径**：同上

### 6. `cdp_wait_for_navigation`

- **说明**：等待页面导航完成（适用于点击后的 SPA 跳转或表单提交）
- **实现方式**：CDP `Page.frameNavigated` 事件 + `Page.loadEventFired` 事件监听，配合超时
- **参数**：`timeout_ms?: number`（默认 30000）
- **返回**：导航后的新 URL
- **实现路径**：
  - `mod.rs`：注册 `Page.frameNavigated` 监听，等待事件或超时
  - 需要 CDP session 的事件订阅能力（检查 CdpClient 是否支持事件监听）
  - **备选方案**：轮询 `Runtime.evaluate("document.readyState")` 直到 `complete`

### 7. `cdp_get_current_url`

- **说明**：获取当前页面 URL（比截图轻量，AI 高频使用）
- **实现方式**：CDP `Runtime.evaluate` 执行 `location.href`
- **参数**：无
- **返回**：当前 URL 字符串
- **实现路径**：
  - `tool_defs.rs`：定义无参数工具
  - `mod.rs`：`cdp.call("Runtime.evaluate", json!({"expression": "location.href"}))` → 提取 result.value

### 8. `cdp_get_console_logs`

- **说明**：获取浏览器控制台日志（最近 N 条）
- **实现方式**：CDP `Runtime.enable` + `Runtime.consoleAPICalled` 事件缓存
- **参数**：`limit?: number`（默认 50）, `level?: string`（log/warn/error/info）
- **返回**：JSON 数组 `[{ level, text, timestamp }]`
- **实现路径**：
  - 需要在 AI 步骤开始时启用 `Runtime.enable`，收集事件到缓冲区
  - 工具调用时返回缓冲区内容
  - **备选方案**：单次调用 `Runtime.evaluate("console 重写 + 历史记录")` 注入收集脚本

### 9. `cdp_get_network_requests`

- **说明**：获取最近 N 条网络请求记录
- **实现方式**：CDP `Network.enable` + `Network.requestWillBeSent` / `Network.responseReceived` 事件缓存
- **参数**：`limit?: number`（默认 20）, `url_pattern?: string`（过滤）
- **返回**：JSON 数组 `[{ url, method, status, mimeType, timing }]`
- **实现路径**：
  - 同 console logs 模式：步骤开始时 enable，缓存事件，工具调用时返回
  - **注意**：网络请求可能很多，需限制缓冲区大小

### 10. `cdp_emulate_device`

- **说明**：模拟移动设备视口和 UA
- **实现方式**：CDP `Emulation.setDeviceMetricsOverride` + `Emulation.setUserAgentOverride`
- **参数**：`width: number, height: number, device_scale_factor?: number, mobile?: bool, user_agent?: string`
- **返回**：`ok`
- **实现路径**：
  - `mod.rs`：两次 CDP 调用组合

### 11. `cdp_set_geolocation`

- **说明**：模拟地理位置
- **实现方式**：CDP `Emulation.setGeolocationOverride`
- **参数**：`latitude: number, longitude: number, accuracy?: number`
- **返回**：`ok`
- **实现路径**：直接映射到 CDP 方法

### 12. `cdp_get_element_box`

- **说明**：获取元素的包围盒坐标（用于精确定位和截图裁剪）
- **实现方式**：CDP `DOM.getBoxModel` 或 `Runtime.evaluate` + `getBoundingClientRect()`
- **参数**：`selector: string, selector_type?: string`
- **返回**：`{ x, y, width, height }` 或完整 box model
- **实现路径**：
  - 使用现有的 `js_find_element_expr` 构建选择器表达式
  - `Runtime.evaluate` 执行 `el.getBoundingClientRect()` 并返回 JSON

### 13. `cdp_highlight_element`

- **说明**：高亮显示页面元素（调试辅助，截图时标记目标）
- **实现方式**：CDP `DOM.highlightNode` 或注入 CSS overlay
- **参数**：`selector: string, selector_type?: string, color?: string, duration_ms?: number`
- **返回**：`ok`
- **实现路径**：
  - **简单方案**：`Runtime.evaluate` 注入临时 outline CSS
  - **CDP 方案**：`Overlay.enable` + `Overlay.highlightNode`

### 14. `magic_get_window_state`

- **说明**：一次性获取窗口完整状态（bounds + maximized + minimized + fullscreen）
- **实现方式**：并行调用 `get_bounds` + `get_maximized` + `get_minimized` + `get_fullscreen`
- **参数**：无
- **返回**：`{ bounds: {x,y,w,h}, maximized: bool, minimized: bool, fullscreen: bool }`
- **实现路径**：
  - `mod.rs`：4 次 magic_post 调用，合并结果为单个 JSON

### 15. `magic_get_maximized`

- **说明**：查询窗口是否最大化
- **实现方式**：Magic Controller HTTP `get_maximized`
- **参数**：无
- **返回**：`true/false`
- **实现路径**：标准 magic_post 模式

### 16. `magic_get_minimized`

- **说明**：查询窗口是否最小化
- **实现方式**：Magic Controller HTTP `get_minimized`
- **参数**：无
- **返回**：`true/false`
- **实现路径**：同上

### 17. `magic_get_fullscreen`

- **说明**：查询窗口是否全屏
- **实现方式**：Magic Controller HTTP `get_fullscreen`
- **参数**：无
- **返回**：`true/false`
- **实现路径**：同上

### 18. `cdp_pdf`

- **说明**：将当前页面导出为 PDF
- **实现方式**：CDP `Page.printToPDF`
- **参数**：`path?: string`（保存路径，不传则返回 base64）, `landscape?: bool, scale?: number, paper_width?: number, paper_height?: number`
- **返回**：文件路径或 base64 数据
- **实现路径**：
  - `mod.rs`：调用 `Page.printToPDF`，根据 path 参数决定写文件或返回 base64

### 19. `cdp_set_user_agent`

- **说明**：运行时修改 User-Agent
- **实现方式**：CDP `Emulation.setUserAgentOverride`
- **参数**：`user_agent: string, platform?: string`
- **返回**：`ok`
- **实现路径**：直接映射

### 20. `cdp_block_urls`

- **说明**：屏蔽匹配模式的 URL（广告、追踪器等）
- **实现方式**：CDP `Network.setBlockedURLs`
- **参数**：`patterns: string[]`（URL 模式列表，支持 `*` 通配符）
- **返回**：`ok`
- **实现路径**：
  - 需先 `Network.enable`，再调用 `Network.setBlockedURLs`

### 21. `cdp_get_page_source`

- **说明**：获取完整 HTML 源码
- **实现方式**：CDP `DOM.getOuterHTML` 对根节点，或 `Runtime.evaluate("document.documentElement.outerHTML")`
- **参数**：`selector?: string`（可选，指定子树）
- **返回**：HTML 字符串
- **实现路径**：
  - 无 selector 时获取整个 document
  - 有 selector 时获取指定元素的 outerHTML
  - **注意**：大页面可能很大，需考虑截断

### 22. `cdp_intercept_request`

- **说明**：拦截并修改网络请求（mock API、修改 headers）
- **实现方式**：CDP `Fetch.enable` + `Fetch.requestPaused` + `Fetch.continueRequest`/`Fetch.fulfillRequest`
- **参数**：`url_pattern: string, action: "block"|"modify"|"mock", headers?: object, body?: string, status?: number`
- **返回**：拦截 ID
- **实现路径**：
  - 复杂度较高，需要持续监听和回调机制
  - 建议先实现 `block` 模式，再扩展 `modify`/`mock`

### 23. `cdp_get_session_storage`

- **说明**：读取 sessionStorage
- **实现方式**：CDP `Runtime.evaluate` 执行 `JSON.stringify(sessionStorage)` 或 `sessionStorage.getItem(key)`
- **参数**：`key?: string`
- **返回**：同 localStorage 模式
- **实现路径**：与 `cdp_get_local_storage` 完全对称

### 24. `cdp_clear_storage`

- **说明**：清除指定类型的存储数据
- **实现方式**：CDP `Storage.clearDataForOrigin`
- **参数**：`origin?: string`（默认当前页面）, `types?: string[]`（cookies/localStorage/sessionStorage/cache 等）
- **返回**：`ok`
- **实现路径**：直接映射到 CDP Storage 域

### 25. `magic_import_cookies`

- **说明**：从 JSON 数据导入 cookies 到浏览器
- **实现方式**：检查 Magic Controller 是否支持 cookie 导入命令；若不支持，使用 CDP `Network.setCookie` 批量设置
- **参数**：`cookies: array`（同 export 格式）
- **返回**：导入数量
- **实现路径**：
  - 循环调用 `Network.setCookie` 逐条设置

### 26. `app_run_script`

- **说明**：在指定环境中触发另一个自动化脚本运行
- **实现方式**：调用已有的 `run_automation_script` Tauri 命令
- **参数**：`script_id: string, profile_id?: string, initial_vars?: object`
- **返回**：运行 ID
- **实现路径**：
  - `mod.rs`：通过 `app.clone()` 调用 Tauri command handler
  - **注意**：异步执行，返回 run_id 供后续查询

### 27. `cdp_mouse_move`

- **说明**：移动鼠标到指定坐标（用于 hover 效果、拖拽前置）
- **实现方式**：CDP `Input.dispatchMouseEvent` type=mouseMoved
- **参数**：`x: number, y: number`
- **返回**：`ok`
- **实现路径**：直接映射

### 28. `cdp_drag_and_drop`

- **说明**：拖拽元素从 A 到 B
- **实现方式**：CDP `Input.dispatchMouseEvent` 序列（mousePressed → mouseMoved → mouseReleased）
- **参数**：`from_selector: string, to_selector: string` 或 `from_x/from_y/to_x/to_y`
- **返回**：`ok`
- **实现路径**：
  - 先获取源/目标元素 bounding box 中心坐标
  - 发送 mousePressed → 多次 mouseMoved → mouseReleased

### 29. `cdp_select_option`

- **说明**：选择 `<select>` 下拉框的选项
- **实现方式**：CDP `Runtime.evaluate` 设置 `select.value` 并触发 `change` 事件
- **参数**：`selector: string, value: string` 或 `index: number`
- **返回**：选中的值
- **实现路径**：构建 JS 表达式操作 select 元素

### 30. `cdp_check_checkbox`

- **说明**：勾选/取消勾选 checkbox 或 radio
- **实现方式**：CDP `Runtime.evaluate` 设置 `checked` 属性并触发 `change` 事件
- **参数**：`selector: string, checked: bool`
- **返回**：最终状态
- **实现路径**：同上模式
