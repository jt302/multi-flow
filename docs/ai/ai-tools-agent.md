# Multi-Flow AI Agent 工具参考

> 最后更新日期: 2026-04-17
>
> 本文档面向 AI Agent（LLM）在执行自动化任务时参考，包含全部 195 个工具的使用指南。

---

## 1. 使用须知

你可以调用以下工具来完成浏览器自动化任务。请遵循以下基本规则：

1. **先观察再行动**：第一步通常调用 `cdp_screenshot` 截取当前页面，了解页面状态后再执行操作。
2. **必须提交结果**：任务完成后必须调用 `submit_result` 提交最终结果。result 参数只包含纯净的结果数据，不要包含多余说明。
3. **分步执行**：复杂操作分步进行，每步后用截图或 `cdp_get_text` 验证状态。
4. **使用变量传递数据**：通过 `output_key` 参数将中间结果存入变量，后续步骤通过 `{{变量名}}` 引用。
5. **选择器类型**：支持 `css`（默认）、`xpath`、`text`（按可见文本匹配）三种选择器。
6. **验证码处理流程**：遇到验证码时，先调用 `auto_list_captcha_configs` 检查是否已配置求解服务。已配置则按 `captcha_detect` → `captcha_solve_and_inject` 流程自动求解；未配置或求解失败则通过 `dialog_message` 通知用户申请人工介入。`captcha_inject_token` / `captcha_solve_and_inject` 只有在页面真实离开验证码或风控阻塞状态时才算成功；拿到 token、写入隐藏字段或触发回调都不等于”验证通过”。
7. **无法解决时申请人工介入**：当遇到无法自动解决的问题（权限不足、登录过期、网络异常、页面异常、验证码求解失败等），立即通过 `dialog_message` 通知用户并申请人工介入，暂停操作等待用户指示，不要继续猜测。
8. **命令执行要走 `exec_command`**：只传 `command + args`，不要拼整段 shell。命令缺失时不要反复重试，优先给替代方案或安装建议。

工具分为 8 大类：

| 前缀       | 类别    | 用途                                                        | 数量 |
| ---------- | ------- | ----------------------------------------------------------- | ---- |
| `cdp_`     | CDP     | 通过 Chrome DevTools Protocol 操作页面内容                  | 56   |
| `magic_`   | Magic   | 通过 Magic Controller 控制浏览器窗口和原生功能              | 66   |
| `app_`     | App     | 读写 Multi-Flow 应用数据（Profile、机型预设、分组、代理、聊天会话等） | 26   |
| `auto_`    | Auto    | 自动化管理（脚本/运行/AI配置/CAPTCHA配置 CRUD）             | 19   |
| `file_`    | File    | 文件系统读写                                                | 6    |
| `dialog_`  | Dialog  | 向用户展示 UI 弹窗获取反馈                                  | 13   |
| `captcha_` | Captcha | CAPTCHA 检测与自动求解                                      | 5    |
| 无前缀     | Utility | 基础工具（等待、日志、提交结果、受控命令执行）             | 4    |

### CAPTCHA 处理流程与严格语义

**处理流程**：

1. 遇到验证码 → 调用 `auto_list_captcha_configs` 检查是否已配置求解服务
2. 已配置 → `captcha_detect` → `captcha_solve_and_inject`（或 `captcha_solve` → `captcha_inject_token`）
3. 未配置或求解失败 → 通过 `dialog_message` 通知用户申请人工介入，暂停等待

**严格语义**：

- `captcha_detect` 会尽量返回 `type / sitekey / callback / pageAction / enterprisePayload / userAgent / params` 等上下文，便于后续求解与注入。
- `captcha_solve` 只表示求解服务拿到了 token；它**不代表页面已经通过验证**。
- `captcha_inject_token` 与 `captcha_solve_and_inject` 会执行页面级回验：
  - 页面真实通过验证 → 成功
  - 仅注入成功但页面仍被 challenge/风控拦截 → 失败
  - 失败结果会包含可读诊断信息，帮助判断是回调缺失、仅注入未提交，还是页面仍停留在 challenge

---

## 2. 工具选择决策树

根据任务需求，按以下路径选择工具：

```
需要了解页面状态？
├─ 需要视觉判断 → cdp_screenshot
├─ 需要精确文本 → cdp_get_text / cdp_execute_js
├─ 需要 DOM 结构 → cdp_get_document
├─ 需要语义结构 → cdp_get_full_ax_tree / magic_get_page_content（mode=a11y）
├─ 需要元素属性 → cdp_get_attribute
├─ 需要页面尺寸 → cdp_get_layout_metrics
├─ 需要页面语义快照（可交互元素/文本内容） → magic_get_page_content
└─ 需要页面综合状态（URL/标题/加载） → magic_get_page_info

需要与页面交互？
├─ 点击元素
│  ├─ CDP 方式（通过 CSS/XPath） → cdp_click
│  └─ Magic 方式（多种选择器，更稳定） → magic_click_dom
├─ 输入文本
│  ├─ 模拟键盘（触发事件） → cdp_type
│  ├─ 直接设值（React等框架） → cdp_set_input_value
│  ├─ 多来源输入（文件/变量） → cdp_input_text
│  └─ Magic 填写表单（更稳定） → magic_fill_dom
├─ 按键操作 → cdp_press_key / cdp_shortcut / magic_send_keys
├─ 剪贴板 → cdp_clipboard
├─ 滚动 → cdp_scroll_to / magic_scroll
├─ 等待元素 → cdp_wait_for_selector
├─ 等待加载 → cdp_wait_for_page_load
├─ 上传文件 → cdp_upload_file
└─ 设置下载目录 → cdp_download_file

需要操作浏览器 Chrome UI（工具栏/标签栏/菜单）？
├─ 查询 UI 状态 → magic_get_ui_elements
└─ 点击 UI 元素（后退/前进/刷新/书签/扩展等） → magic_click_element

需要 DOM 元素语义化操作？
├─ 查询元素（返回候选列表） → magic_query_dom
├─ 点击元素 → magic_click_dom
├─ 填写表单 → magic_fill_dom
└─ 滚动到元素 → magic_scroll（配合 by/selector）

需要坐标系点击？（截图后映射坐标）
└─ 虚拟坐标 → 窗口像素 → magic_click_at

需要页面导航？
├─ 跳转 URL → cdp_navigate
├─ 刷新 → cdp_reload
├─ 后退 → cdp_go_back
└─ 前进 → cdp_go_forward

需要管理标签页？（两套API可选）
├─ CDP 标签页（通过 DevTools Protocol）
│  ├─ 打开 → cdp_open_new_tab
│  ├─ 列表 → cdp_get_all_tabs
│  ├─ 切换 → cdp_switch_tab
│  └─ 关闭 → cdp_close_tab_by_target
└─ Magic 标签页（通过浏览器原生控制）
   ├─ 打开 → magic_open_new_tab
   ├─ 关闭 → magic_close_tab
   ├─ 激活 → magic_activate_tab / magic_activate_tab_by_index
   └─ 关闭非活跃 → magic_close_inactive_tabs

需要管理浏览器窗口？
├─ 位置/大小 → magic_set_bounds / magic_get_bounds
├─ 最大化 → magic_set_maximized
├─ 最小化 → magic_set_minimized
├─ 全屏 → magic_set_fullscreen
├─ 恢复 → magic_set_restored
├─ 置顶 → magic_set_app_top_most
├─ 关闭窗口 → magic_set_closed
├─ 退出浏览器 → magic_safe_quit
└─ 新窗口 → magic_open_new_window

需要读写应用数据？
├─ Profile → app_list_profiles / app_get_profile / app_create_profile / app_update_profile / app_delete_profile
├─ Profile 生命周期 → app_start_profile / app_stop_profile / app_get_running_profiles / app_get_current_profile
├─ 聊天目标环境 → app_set_chat_active_profile
├─ 机型预设 → app_list_device_presets / app_get_device_preset / app_create_device_preset / app_update_device_preset / app_delete_device_preset
├─ 分组 → app_list_groups / app_get_group / app_create_group / app_update_group / app_delete_group / app_get_profiles_in_group
├─ 代理 → app_list_proxies / app_get_proxy
├─ 插件 → app_list_plugins / app_get_plugin
└─ 会话 → app_get_engine_sessions

需要文件操作？
├─ 读取 → file_read
├─ 写入（覆盖） → file_write
├─ 追加 → file_append
├─ 列目录 → file_list_dir
├─ 检查存在 → file_exists
└─ 创建目录 → file_mkdir

需要与用户交互？
├─ 显示消息 → dialog_message
├─ 是/否确认 → dialog_confirm
├─ 文本输入 → dialog_input
├─ 单/多选选项 → dialog_select
├─ 多字段表单 → dialog_form
├─ 展示表格数据 → dialog_table
├─ 展示图片/验证码 → dialog_image
├─ 危险操作倒计时 → dialog_countdown
├─ 轻量通知（Toast）→ dialog_toast
├─ 富文本展示 → dialog_markdown
├─ 选择文件 → dialog_open_file
├─ 保存文件 → dialog_save_file
└─ 选择文件夹 → dialog_select_folder

需要管理书签？
├─ 获取 → magic_get_bookmarks
├─ 创建 → magic_create_bookmark / magic_create_bookmark_folder
├─ 更新 → magic_update_bookmark / magic_move_bookmark
├─ 删除 → magic_remove_bookmark
├─ 当前页操作 → magic_bookmark_current_tab / magic_unbookmark_current_tab / magic_is_current_tab_bookmarked
└─ 导出 → magic_export_bookmark_state

需要管理 Cookie？
├─ 获取 → magic_get_managed_cookies
└─ 导出 → magic_export_cookie_state

需要控制扩展？
├─ 列表 → magic_get_managed_extensions
├─ 触发操作 → magic_trigger_extension_action
├─ 关闭弹窗 → magic_close_extension_popup
├─ 启用/禁用 → magic_enable_extension / magic_disable_extension

需要窗口同步？
├─ 切换模式 → magic_toggle_sync_mode
├─ 查询模式 → magic_get_sync_mode
├─ 是否主控 → magic_get_is_master
└─ 同步状态 → magic_get_sync_status
```

---

## 3. 按任务场景组织的工具参考

### 场景 A: 页面导航与加载

**场景描述**：需要跳转到新页面、刷新、前进后退，或等待页面/元素加载完成。

**常用工具**（按使用频率）：

| 工具                     | 用途             | 必需参数                            |
| ------------------------ | ---------------- | ----------------------------------- |
| `cdp_navigate`           | 跳转到指定 URL   | `url`                               |
| `cdp_wait_for_page_load` | 等待页面完全加载 | 无（可选 `timeout_ms`，默认 30000） |
| `cdp_wait_for_selector`  | 等待特定元素出现 | `selector`                          |
| `cdp_reload`             | 刷新页面         | 无（可选 `ignore_cache`）           |
| `cdp_go_back`            | 后退             | 无（可选 `steps`）                  |
| `cdp_go_forward`         | 前进             | 无（可选 `steps`）                  |

**典型组合**：

```
cdp_navigate(url="https://example.com")
  → cdp_wait_for_page_load()
  → cdp_screenshot()
```

```
cdp_navigate(url="https://example.com")
  → cdp_wait_for_selector(selector="#main-content", timeout_ms=15000)
  → cdp_get_text(selector="#main-content")
```

**注意事项**：

- `cdp_navigate` 不会等待页面加载完成，需要配合 `cdp_wait_for_page_load` 或 `cdp_wait_for_selector`。
- SPA 应用页面切换后可能不触发 page load 事件，用 `cdp_wait_for_selector` 等待目标元素更可靠。
- `cdp_wait_for_selector` 默认超时 10 秒，如果页面加载较慢可调大 `timeout_ms`。

---

### 场景 B: 页面交互（点击、输入、滚动）

**场景描述**：需要模拟用户操作——点击按钮、填写表单、滚动页面、按键等。

**常用工具**（按使用频率）：

| 工具                  | 用途                         | 必需参数                                      |
| --------------------- | ---------------------------- | --------------------------------------------- |
| `cdp_click`           | 点击元素                     | `selector`                                    |
| `cdp_type`            | 聚焦元素并模拟键盘输入       | `selector`, `text`                            |
| `cdp_set_input_value` | 直接设置 input 的 value      | `selector`, `value`                           |
| `cdp_input_text`      | 多来源输入（内联/文件/变量） | `selector`（+ `text`/`file_path`/`var_name`） |
| `cdp_scroll_to`       | 滚动到元素或坐标             | `selector` 或 `x`/`y`                         |
| `cdp_press_key`       | 模拟单个按键                 | `key`（如 `Enter`, `Tab`, `Escape`）          |
| `cdp_shortcut`        | 模拟快捷键组合               | `modifiers` + `key`                           |
| `cdp_clipboard`       | 剪贴板操作                   | `action`（`copy`/`paste`/`select_all`）       |
| `cdp_upload_file`     | 上传文件到 file input        | `selector`, `files`（路径数组）               |

**典型组合**：

填写表单并提交：

```
cdp_click(selector="#username")
  → cdp_type(selector="#username", text="user@example.com")
  → cdp_type(selector="#password", text="secret123")
  → cdp_click(selector="button[type=submit]")
  → cdp_wait_for_selector(selector=".dashboard")
  → cdp_screenshot()
```

搜索操作：

```
cdp_set_input_value(selector="input[name=q]", value="搜索词")
  → cdp_press_key(key="Enter")
  → cdp_wait_for_selector(selector=".search-results")
```

**文本输入工具选择指南**：

| 场景                     | 推荐工具              | 原因                                                                      |
| ------------------------ | --------------------- | ------------------------------------------------------------------------- |
| **通用文本输入（首选）** | `magic_type_string`   | 模拟真实键盘输入，兼容性最好。**前置条件：先用 cdp_click 聚焦目标输入框** |
| 普通 HTML input          | `cdp_type`            | 通过 CDP insertText 输入，速度快但不触发 keydown/keyup                    |
| React/Vue 受控组件       | `cdp_set_input_value` | 直接设值并触发 input/change 事件，兼容性更好                              |
| 需要触发自动补全         | `cdp_type`            | 逐字符输入触发 keydown/keyup                                              |
| 大段文本粘贴             | `cdp_input_text`      | 支持从文件/变量读取文本                                                   |

**注意事项**：

- `magic_type_string` 是文本输入的**首选工具**，通过 Magic Controller 模拟键盘输入。**前置条件：目标输入区域必须已处于焦点状态，使用前先调用 `cdp_click` 点击输入框聚焦**。适用于页面内容区域和浏览器 UI 区域（如地址栏）。
- `cdp_click` 会先滚动到元素使其可见再点击。如果元素被遮挡可能点击失败，先用 `cdp_scroll_to` 确保可见。
- `cdp_type` 通过 CDP `Input.insertText` 实现，不是逐键模拟，输入速度快但不触发 keydown/keyup 事件。
- `cdp_press_key` 的 key 值遵循 [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values) 标准，如 `Enter`、`Tab`、`Escape`、`ArrowDown`、`Backspace` 等。
- `cdp_shortcut` 的 modifiers 可选值：`alt`、`ctrl`、`meta`（Mac Command）、`shift`。
- `cdp_upload_file` 的 `files` 参数是绝对路径数组，仅支持 CSS 选择器。

---

### 场景 C: 数据提取与页面分析

**场景描述**：需要从页面获取数据，包括文本内容、元素属性、DOM 结构，或通过截图进行视觉分析。

**常用工具**（按使用频率）：

| 工具                           | 用途                 | 必需参数                     | 返回类型                           |
| ------------------------------ | -------------------- | ---------------------------- | ---------------------------------- |
| `cdp_screenshot`               | 截取页面截图         | 无                           | 图片（自动注入对话历史供视觉分析） |
| `cdp_get_text`                 | 获取元素文本         | `selector`                   | 文本字符串                         |
| `cdp_get_attribute`            | 获取元素 HTML 属性   | `selector`, `attribute`      | 属性值字符串                       |
| `cdp_execute_js`               | 执行 JS 并返回结果   | `expression` 或 `file_path`  | JS 返回值                          |
| `cdp_get_document`             | 获取 DOM 树          | 无（可选 `depth`, `pierce`） | DOM 节点 JSON                      |
| `cdp_get_full_ax_tree`         | 获取无障碍树         | 无（可选 `depth`）           | 无障碍树 JSON                      |
| `cdp_get_layout_metrics`       | 获取页面布局指标     | 无                           | viewport/contentSize JSON          |
| `cdp_get_browser_version`      | 浏览器版本信息       | 无                           | 版本 JSON                          |
| `cdp_get_browser_command_line` | 启动参数             | 无                           | 命令行 JSON                        |
| `cdp_get_window_for_target`    | 窗口信息             | 无（可选 `target_id`）       | windowId/bounds JSON               |
| `magic_capture_app_shell`      | 带壳截图（含工具栏） | 无                           | 图片                               |

**典型组合**：

提取页面数据：

```
cdp_screenshot()                          ← 先看页面长什么样
  → cdp_get_text(selector=".price", output_key="price")
  → cdp_get_attribute(selector="a.link", attribute="href", output_key="link")
  → submit_result(result="价格: {{price}}, 链接: {{link}}")
```

分析页面结构：

```
cdp_get_document(depth=3)                 ← 先看 DOM 概览
  → cdp_get_full_ax_tree()               ← 再看语义结构
  → cdp_execute_js(expression="document.querySelectorAll('.item').length")
```

**数据获取方式选择指南（从高效到低效）**：

> **优先使用结构化文本提取（`cdp_get_text`、`cdp_get_full_ax_tree`、`cdp_execute_js`），避免依赖截图进行数据提取 — 截图应仅用于视觉状态判断，不适合提取结构化数据。**

| 场景           | 推荐工具                                    | 说明                                                  |
| -------------- | ------------------------------------------- | ----------------------------------------------------- |
| 语义化结构提取 | `cdp_get_full_ax_tree`                      | 获取页面语义树，含角色/名称/值，适合复杂页面结构分析  |
| 精确文本提取   | `cdp_get_text`                              | 获取单个元素 innerText                                |
| 批量文本/属性  | `cdp_execute_js`                            | 用 `document.querySelectorAll` + map 一次提取多个元素 |
| 完整 HTML 源码 | `cdp_get_page_source`                       | 获取整页或指定元素的 outerHTML                        |
| DOM 节点结构   | `cdp_get_document`                          | 获取 DOM 树，`depth: -1` 可获取完整树                 |
| 属性值         | `cdp_get_attribute`                         | 获取 href/src/data-\* 等属性                          |
| Cookie/存储    | `cdp_get_cookies` / `cdp_get_local_storage` | 读取认证信息、用户偏好等                              |
| 网络请求监控   | `cdp_get_network_requests`                  | 查看 API 调用（仅元数据，不含响应体）                 |
| 控制台调试信息 | `cdp_get_console_logs`                      | 查看 JS 错误、调试输出                                |
| 当前页面 URL   | `cdp_get_current_url`                       | 快速获取 URL                                          |
| 视觉判断       | `cdp_screenshot`                            | 页面视觉状态（文字提取请用以上工具代替）              |
| 任意 CDP 方法  | `cdp`（逃生舱）                             | 调用未封装的原始 CDP 方法                             |

**注意事项**：

- `cdp_screenshot` 返回的图片会自动注入到对话历史，你可以直接"看到"截图内容。
- `cdp_get_document` 的 `depth` 参数控制遍历深度，`-1` 返回完整 DOM（数据量可能很大）。默认 `1` 只返回根节点的直接子元素。
- `cdp_execute_js` 的 `expression` 中最后一个表达式的值会作为返回值。复杂逻辑建议写到文件后通过 `file_path` 参数加载。
- `cdp` 工具可以调用任意 CDP 方法（如 `Network.enable`、`Runtime.evaluate`），是最灵活的低级工具，但需要了解 CDP 协议。
- `magic_capture_app_shell` 截取的是完整浏览器窗口（含标签栏、工具栏），而 `cdp_screenshot` 只截取页面内容区域。

---

### 场景 D: 标签页与窗口管理

**场景描述**：需要在多个标签页或窗口之间操作，包括打开/关闭/切换标签页，调整窗口位置和大小。

**CDP 标签页工具**（通过 DevTools Protocol）：

| 工具                      | 用途               | 必需参数    |
| ------------------------- | ------------------ | ----------- |
| `cdp_open_new_tab`        | 打开新标签页       | `url`       |
| `cdp_get_all_tabs`        | 获取所有标签页列表 | 无          |
| `cdp_switch_tab`          | 切换到指定标签页   | `target_id` |
| `cdp_close_tab_by_target` | 关闭指定标签页     | `target_id` |

**Magic 标签页工具**（通过浏览器原生控制）：

| 工具                          | 用途                 | 必需参数             |
| ----------------------------- | -------------------- | -------------------- |
| `magic_open_new_tab`          | 打开新标签页         | `url`                |
| `magic_close_tab`             | 关闭标签页           | `tab_id`             |
| `magic_activate_tab`          | 激活标签页           | `tab_id`             |
| `magic_activate_tab_by_index` | 按索引激活标签页     | `index`（从 0 开始） |
| `magic_close_inactive_tabs`   | 关闭所有非活跃标签页 | 无                   |
| `magic_open_new_window`       | 打开新浏览器窗口     | 无                   |

**Magic 窗口控制工具**：

| 工具                                 | 用途                | 必需参数                               |
| ------------------------------------ | ------------------- | -------------------------------------- |
| `magic_set_bounds`                   | 设置窗口位置和大小  | 无（可选 `x`, `y`, `width`, `height`） |
| `magic_get_bounds`                   | 获取窗口位置和大小  | 无                                     |
| `magic_set_maximized`                | 最大化窗口          | 无                                     |
| `magic_set_minimized`                | 最小化窗口          | 无                                     |
| `magic_set_fullscreen`               | 全屏窗口            | 无                                     |
| `magic_set_restored`                 | 恢复窗口            | 无                                     |
| `magic_set_app_top_most`             | 窗口置顶            | 无                                     |
| `magic_set_closed`                   | 关闭窗口            | 无                                     |
| `magic_safe_quit`                    | 安全退出浏览器      | 无                                     |
| `magic_set_bg_color`                 | 设置浏览器背景色    | 无（可选 `r`, `g`, `b`）               |
| `magic_set_toolbar_text`             | 设置工具栏文本      | `text`                                 |
| `magic_set_master_indicator_visible` | 显示/隐藏主控指示器 | 无（可选 `visible`, `label`）          |

**Magic 浏览器查询工具**：

| 工具                       | 用途                   | 必需参数                |
| -------------------------- | ---------------------- | ----------------------- |
| `magic_get_browsers`       | 获取所有浏览器实例     | 无                      |
| `magic_get_active_browser` | 获取当前活跃浏览器     | 无                      |
| `magic_get_tabs`           | 获取浏览器的标签页列表 | 无（可选 `browser_id`） |
| `magic_get_active_tabs`    | 获取所有活跃标签页     | 无                      |
| `magic_get_switches`       | 获取浏览器启动参数     | 无（可选 `key`）        |
| `magic_get_host_name`      | 获取环境主机名         | 无                      |
| `magic_get_mac_address`    | 获取环境 MAC 地址      | 无                      |

**CDP vs Magic 标签页选择指南**：

| 场景                             | 推荐  | 原因                                         |
| -------------------------------- | ----- | -------------------------------------------- |
| 切换标签页后需要立即操作页面 DOM | CDP   | CDP 切换后自动绑定新 target                  |
| 批量管理标签页                   | Magic | `magic_close_inactive_tabs` 等批量操作更方便 |
| 按索引切换                       | Magic | `magic_activate_tab_by_index` 更直观         |
| 获取标签页的 DevTools target ID  | CDP   | `cdp_get_all_tabs` 返回 target 信息          |

**典型组合**：

多标签页操作：

```
cdp_open_new_tab(url="https://page2.com", output_key="tab2_id")
  → cdp_wait_for_page_load()
  → cdp_screenshot()                    ← 新标签页的截图
  → cdp_switch_tab(target_id="原始tab的target_id")
```

窗口布局：

```
magic_set_bounds(x=0, y=0, width=1200, height=800)
  → magic_set_app_top_most()
```

**注意事项**：

- ⚠️ `magic_set_closed` 会关闭浏览器窗口，`magic_safe_quit` 会退出整个浏览器。慎用。
- CDP 标签页的标识是 `target_id`（字符串），Magic 标签页的标识是 `tab_id`（整数），两者不同。
- 切换标签页后 CDP 方法会作用在新标签页上，之前标签页的 DOM 操作不再有效。

---

### 场景 E: 应用数据管理

**场景描述**：需要查询或修改 Multi-Flow 的核心业务数据——Profile（浏览器配置文件）、分组、代理、插件等。

**Profile 操作**：

| 工具                          | 用途                           | 必需参数                                            |
| ----------------------------- | ------------------------------ | --------------------------------------------------- |
| `app_list_profiles`           | 列出所有 profile               | 无（可选 `group_id`=分组名称, `keyword`, `include_deleted`） |
| `app_get_profile`             | 获取单个 profile 详情          | `profile_id`                                        |
| `app_create_profile`          | 创建新 profile                 | `name`（可选 `group_id`, `note`）                   |
| `app_update_profile`          | 更新 profile 信息              | `profile_id`（可选 `name`, `group_id`, `note`）     |
| `app_delete_profile`          | ⚠️ 删除 profile                | `profile_id`                                        |
| `app_start_profile`           | 启动 profile 的浏览器          | `profile_id`                                        |
| `app_stop_profile`            | 停止 profile 的浏览器          | `profile_id`                                        |
| `app_get_running_profiles`    | 获取所有运行中的 profile       | 无                                                  |
| `app_set_chat_active_profile` | 切换当前聊天会话的工具目标环境 | `profile_id`                                        |
| `app_get_current_profile`     | 获取当前工具目标环境的 profile | 无                                                  |

**机型预设操作**：

| 工具                       | 用途                    | 必需参数                              |
| -------------------------- | ----------------------- | ------------------------------------- |
| `app_list_device_presets`  | 列出机型预设            | 无（可选 `platform`）                 |
| `app_get_device_preset`    | 获取机型预设详情        | `preset_id`                           |
| `app_create_device_preset` | 创建机型预设            | 见下方完整字段说明                    |
| `app_update_device_preset` | ⚠️ 更新机型预设         | `preset_id` + 完整机型字段            |
| `app_delete_device_preset` | ⚠️ 删除机型预设         | `preset_id`                           |

**分组操作**：

| 工具                        | 用途                 | 必需参数                           |
| --------------------------- | -------------------- | ---------------------------------- |
| `app_list_groups`           | 列出所有分组         | 无（可选 `include_deleted`）       |
| `app_get_group`             | 获取单个分组         | `group_id`                         |
| `app_create_group`          | 创建分组             | `name`（可选 `browser_bg_color`, `toolbar_label_mode`）             |
| `app_update_group`          | 更新分组             | `group_id`（可选 `name`, `browser_bg_color`, `toolbar_label_mode`） |
| `app_delete_group`          | ⚠️ 删除分组          | `group_id`                         |
| `app_get_profiles_in_group` | 获取分组内的 profile | `group_id`                         |

**代理与插件查询**：

| 工具               | 用途         | 必需参数                         |
| ------------------ | ------------ | -------------------------------- |
| `app_list_proxies` | 列出代理     | 无（可选 `keyword`, `protocol`） |
| `app_get_proxy`    | 获取代理详情 | `proxy_id`                       |
| `app_list_plugins` | 列出插件包   | 无                               |
| `app_get_plugin`   | 获取插件详情 | `plugin_id`                      |

**会话查询**：

| 工具                      | 用途                       | 必需参数 |
| ------------------------- | -------------------------- | -------- |
| `app_get_engine_sessions` | 获取所有运行中的浏览器会话 | 无       |

**典型组合**：

查询并启动 profile：

```
app_list_profiles(keyword="测试")
  → app_start_profile(profile_id="找到的ID")
  → wait(ms=3000)
  → cdp_screenshot()
```

按分组管理：

```
app_list_groups()
  → app_get_profiles_in_group(group_id="目标分组ID")
  → app_start_profile(profile_id="第一个profile的ID")
```

查询并修改机型预设：

```
app_list_device_presets(platform="android")
  → app_get_device_preset(preset_id="目标预设ID")
  → app_update_device_preset(preset_id="目标预设ID", ...)
```

**注意事项**：

- ⚠️ `app_update_device_preset`、`app_delete_device_preset`、`app_delete_profile` 和 `app_delete_group` 是高风险操作，通常会触发 Multi-Flow 的工具确认弹窗。
- `app_create_device_preset` / `app_update_device_preset` 需要传完整字段，字段语义与设置页“机型映射”表单一致。
- `app_start_profile` 启动浏览器需要几秒钟，建议配合 `wait` 或 `cdp_wait_for_page_load` 使用。
- 在多环境聊天会话中，先调用 `app_set_chat_active_profile(profile_id)`，再执行 `cdp_*` / `magic_*`。
- `app_get_current_profile` 返回当前工具目标环境，适合在脚本或聊天中确认当前上下文。
- `app_list_proxies` 的 `protocol` 可选值：`http`、`https`、`socks5`。
- `app_create_group` / `app_update_group` 的 `browser_bg_color` 参数为十六进制颜色值，如 `#FF5733`。
- `toolbar_label_mode` 可选值：`id_only`、`group_name_and_id`。

---

### 场景 F: 文件系统操作

**场景描述**：需要在应用内 `appData/fs` 文件系统中读写文件、检查目录结构。

**常用工具**：

| 工具            | 用途                  | 必需参数           |
| --------------- | --------------------- | ------------------ |
| `file_read`     | 读取文件内容          | `path`（`fs` 内相对路径） |
| `file_write`    | 覆盖写入文件          | `path`（`fs` 内相对路径）, `content` |
| `file_append`   | 追加内容到文件        | `path`（`fs` 内相对路径）, `content` |
| `file_list_dir` | 列出目录内容          | `path`（`fs` 内相对路径） |
| `file_exists`   | 检查文件/目录是否存在 | `path`（`fs` 内相对路径） |
| `file_mkdir`    | 递归创建目录          | `path`（`fs` 内相对路径） |

**典型组合**：

保存页面数据到文件：

```
cdp_get_text(selector=".content", output_key="content")
  → file_write(path="exports/output.txt", content="{{content}}")
```

读取 `fs` 根目录中的文本文件：

```
file_read(path="notes/data.txt")
```

**注意事项**：

- ⚠️ `file_write` 是**覆盖写入**，现有内容会丢失。追加请用 `file_append`。
- ⚠️ 文件大小限制 **10MB**。
- ⚠️ `path` 必须是 `appData/fs` 内的**相对路径**，不能传系统绝对路径；`.` 表示 `fs` 根目录。
- `file_mkdir` 支持递归创建：`a/b/c` 如果 `a/b` 不存在也会一并创建。

---

### 场景 G: 用户交互弹窗

**场景描述**：需要向用户展示信息、请求确认、获取用户输入，或让用户选择文件/目录。

**常用工具**：

| 工具                   | 用途                 | 必需参数             | 行为                                                 |
| ---------------------- | -------------------- | -------------------- | ---------------------------------------------------- |
| `dialog_message`       | 显示消息             | `message`            | 非阻塞，显示后继续执行                               |
| `dialog_confirm`       | 让用户确认           | `message`            | 阻塞，返回 `true`/`false`                            |
| `dialog_input`         | 让用户输入文本       | `message`            | 阻塞，返回用户输入的字符串                           |
| `dialog_select`        | 让用户选择选项       | `options`            | 阻塞，返回 `{cancelled, selected}`                   |
| `dialog_form`          | 让用户填写多字段表单 | `fields`             | 阻塞，返回 `{cancelled, values}`                     |
| `dialog_table`         | 展示表格（可选行）   | `columns`, `rows`    | 阻塞，返回 `{confirmed, selected_indices}`           |
| `dialog_image`         | 展示图片（可附输入） | `image`              | 阻塞，返回 `{cancelled, value, action}`              |
| `dialog_countdown`     | 危险操作倒计时确认   | `message`, `seconds` | 阻塞，返回 `{cancelled}`                             |
| `dialog_toast`         | 轻量通知（Toast）    | `message`            | 无按钮不阻塞；有按钮阻塞，返回 `{dismissed, action}` |
| `dialog_markdown`      | 展示 Markdown 富文本 | `content`            | 阻塞，返回 `{action}`                                |
| `dialog_open_file`     | 选择文件             | 无                   | 阻塞，返回文件路径                                   |
| `dialog_save_file`     | 选择保存位置         | 无                   | 阻塞，返回保存路径                                   |
| `dialog_select_folder` | 选择文件夹           | 无                   | 阻塞，返回目录路径                                   |

**典型组合**：

确认后执行危险操作：

```
dialog_confirm(message="确定要删除这个 Profile 吗？")
  → (如果返回 true) app_delete_profile(profile_id="xxx")
```

让用户选择文件并上传：

```
dialog_open_file(title="选择要上传的图片", filters=[{name:"图片", extensions:["png","jpg"]}])
  → cdp_upload_file(selector="#file-input", files=["用户选择的路径"])
```

导出数据到用户选择的位置：

```
cdp_get_text(selector="#data", output_key="data")
  → dialog_save_file(title="保存数据", default_name="export.txt", content="{{data}}")
```

**注意事项**：

- Dialog 工具会显示**真实的 UI 弹窗**给用户。阻塞类弹窗在用户响应前会暂停脚本执行。
- `dialog_message` 的 `level` 影响弹窗样式：`info`（蓝色）、`warning`（黄色）、`error`（红色）、`success`（绿色）。
- `dialog_save_file` 的 `content` 参数若提供，会在用户选择路径后自动写入文件。
- `dialog_open_file` 的 `multiple=true` 允许多选，返回路径数组。
- `filters` 格式：`[{"name": "Text Files", "extensions": ["txt", "md"]}]`。

---

### 场景 H: 书签与 Cookie 管理

**场景描述**：需要管理浏览器的书签收藏或 Cookie 数据。

**书签工具**：

| 工具                              | 用途                   | 必需参数                             |
| --------------------------------- | ---------------------- | ------------------------------------ |
| `magic_get_bookmarks`             | 获取全部书签树         | 无                                   |
| `magic_create_bookmark`           | 创建书签               | `title`, `url`（可选 `parent_id`）   |
| `magic_create_bookmark_folder`    | 创建书签文件夹         | `title`（可选 `parent_id`）          |
| `magic_update_bookmark`           | 更新书签标题/URL       | `node_id`（可选 `title`, `url`）     |
| `magic_move_bookmark`             | 移动书签到其他文件夹   | `node_id`, `new_parent_id`           |
| `magic_remove_bookmark`           | 删除书签               | `node_id`                            |
| `magic_bookmark_current_tab`      | 收藏当前页面           | 无（可选 `browser_id`, `parent_id`） |
| `magic_unbookmark_current_tab`    | 取消收藏当前页面       | 无（可选 `browser_id`）              |
| `magic_is_current_tab_bookmarked` | 检查当前页面是否已收藏 | 无（可选 `browser_id`）              |
| `magic_export_bookmark_state`     | 导出书签状态           | 无（可选 `environment_id`）          |

**Cookie 工具**：

| 工具                        | 用途                   | 必需参数                               |
| --------------------------- | ---------------------- | -------------------------------------- |
| `magic_get_managed_cookies` | 获取管理的 Cookie 列表 | 无                                     |
| `magic_export_cookie_state` | 导出 Cookie 状态       | `mode`（可选 `url`, `environment_id`） |

**典型组合**：

组织书签：

```
magic_create_bookmark_folder(title="工作")
  → magic_create_bookmark(title="邮箱", url="https://mail.example.com", parent_id="新文件夹ID")
  → magic_bookmark_current_tab(parent_id="新文件夹ID")
```

**注意事项**：

- 书签操作使用 `node_id` 标识节点，先调用 `magic_get_bookmarks` 获取书签树后提取 ID。
- `magic_export_cookie_state` 和 `magic_export_bookmark_state` 用于跨环境数据迁移场景。

---

### 场景 I: 扩展管理

**场景描述**：需要查看、启用、禁用浏览器扩展，或触发扩展的功能。

**常用工具**：

| 工具                             | 用途                 | 必需参数                |
| -------------------------------- | -------------------- | ----------------------- |
| `magic_get_managed_extensions`   | 获取已安装的扩展列表 | 无                      |
| `magic_trigger_extension_action` | 触发扩展图标动作     | `extension_id`          |
| `magic_close_extension_popup`    | 关闭扩展弹窗         | 无（可选 `browser_id`） |
| `magic_enable_extension`         | 启用扩展             | `extension_id`          |
| `magic_disable_extension`        | 禁用扩展             | `extension_id`          |

**典型组合**：

使用广告拦截扩展：

```
magic_get_managed_extensions()             ← 获取扩展列表找到 extension_id
  → magic_enable_extension(extension_id="xxx")
  → magic_trigger_extension_action(extension_id="xxx")
  → cdp_screenshot()                       ← 查看扩展弹窗
```

**注意事项**：

- `extension_id` 是 32 位的扩展唯一标识符（如 `nkbihfbeogaeaoehlefnkodbefgpgknn`），先通过 `magic_get_managed_extensions` 获取。
- `magic_enable_extension` 和 `magic_disable_extension` 是运行时生效，不持久化到浏览器配置。
- `magic_trigger_extension_action` 模拟点击浏览器工具栏上的扩展图标。

---

### 场景 J: 窗口同步控制

**场景描述**：Multi-Flow 支持多窗口同步操作。一个主控窗口（master）的操作会同步到多个从属窗口（slave）。

**常用工具**：

| 工具                     | 用途             | 必需参数                             |
| ------------------------ | ---------------- | ------------------------------------ |
| `magic_toggle_sync_mode` | 切换同步模式     | `role` (`master`/`slave`/`disabled`) |
| `magic_get_sync_mode`    | 获取当前同步模式 | 无                                   |
| `magic_get_is_master`    | 检查是否为主控   | 无                                   |
| `magic_get_sync_status`  | 获取同步状态详情 | 无                                   |

**典型组合**：

设置主控模式：

```
magic_toggle_sync_mode(role="master")
  → magic_get_sync_status()               ← 确认同步状态
```

**注意事项**：

- 同步模式三个角色：`master`（主控，操作被同步）、`slave`（从属，接收同步操作）、`disabled`（关闭同步）。
- `session_id` 用于标识同步会话，同一会话的 master 和 slave 才会同步。

---

## 4. 安全与最佳实践

### 危险操作清单

以下操作可能导致数据丢失或状态不可恢复，执行前务必确认：

| 工具                    | 风险                             | 建议                                |
| ----------------------- | -------------------------------- | ----------------------------------- |
| `app_update_device_preset` | 修改机型预设并影响后续环境创建 | 确认目标预设 ID 和完整字段后再执行   |
| `app_delete_device_preset` | 永久删除机型预设               | 先核对是否仍有环境依赖该预设         |
| `app_delete_profile`    | 永久删除 profile 数据            | 先 `dialog_confirm` 让用户确认      |
| `app_delete_group`      | 永久删除分组                     | 先 `dialog_confirm` 让用户确认      |
| `file_write`            | 覆盖文件内容                     | 确认路径正确，或先 `file_read` 备份 |
| `magic_set_closed`      | 关闭浏览器窗口                   | 确认不会丢失未保存的工作            |
| `magic_safe_quit`       | 退出整个浏览器                   | 确认所有工作已保存                  |
| `magic_remove_bookmark` | 删除书签                         | 确认书签 ID 正确                    |
| `cdp_clear_storage`     | 清除 localStorage/sessionStorage | 不可恢复，确认操作范围后再执行      |
| `cdp_delete_cookies`    | 删除 Cookie（可能导致登出）      | 确认 Cookie 名称或范围后再执行      |

### 执行流程最佳实践

1. **开始时截图**：任何任务的第一步调用 `cdp_screenshot()` 了解当前页面状态。
2. **分步验证**：每个关键操作后截图或获取文本验证结果，不要盲目执行一长串操作。
3. **使用变量**：通过 `output_key` 保存中间结果，避免重复查询。
4. **等待加载**：导航或触发异步操作后，使用 `cdp_wait_for_page_load` 或 `cdp_wait_for_selector` 等待完成。
5. **错误处理**：如果操作结果不符预期，截图分析原因后重试或调整策略。
6. **及时提交**：完成任务后立即调用 `submit_result` 提交结果，result 只包含纯净数据。

### output_key 变量系统

许多工具支持 `output_key` 参数，可以将结果保存为命名变量，后续通过 `{{变量名}}` 引用：

```
cdp_get_text(selector=".title", output_key="page_title")
  → cdp_get_text(selector=".price", output_key="price")
  → submit_result(result="标题: {{page_title}}, 价格: {{price}}")
```

支持 `output_key` 的工具：大多数返回数据的 CDP 和 Magic 查询工具，包括 `cdp_navigate`、`cdp_get_text`、`cdp_get_attribute`、`cdp_execute_js`、`cdp_get_all_tabs`、`cdp_screenshot`（通过 `output_key_file_path`）、以及大部分 `magic_get_*` 工具。

---

## 5. 完整工具速查表

### Utility（3 个）

| #   | 工具名          | 说明                                            |
| --- | --------------- | ----------------------------------------------- |
| 1   | `wait`          | 等待指定毫秒数                                  |
| 2   | `print`         | 输出日志信息（支持 info/warn/error/debug 级别） |
| 3   | `submit_result` | 提交最终结果并结束执行                          |

### CDP — 页面操作（56 个）

| #   | 工具名                         | 说明                                           |
| --- | ------------------------------ | ---------------------------------------------- |
| 1   | `cdp_navigate`                 | 导航到指定 URL                                 |
| 2   | `cdp_reload`                   | 重新加载页面（可选忽略缓存）                   |
| 3   | `cdp_go_back`                  | 浏览器后退（可指定步数）                       |
| 4   | `cdp_go_forward`               | 浏览器前进（可指定步数）                       |
| 5   | `cdp_click`                    | 点击页面元素                                   |
| 6   | `cdp_type`                     | 聚焦元素并通过 CDP Input.insertText 输入文本   |
| 7   | `cdp_set_input_value`          | 直接设置 input value 并触发 input/change 事件  |
| 8   | `cdp_input_text`               | 多来源文本输入（内联/文件/变量）               |
| 9   | `cdp_get_text`                 | 获取元素文本内容                               |
| 10  | `cdp_get_attribute`            | 获取元素 HTML 属性值                           |
| 11  | `cdp_wait_for_selector`        | 等待元素出现在 DOM 中                          |
| 12  | `cdp_wait_for_page_load`       | 等待页面完全加载                               |
| 13  | `cdp_scroll_to`                | 滚动到元素或坐标位置                           |
| 14  | `cdp_screenshot`               | 截取页面截图（支持视觉分析）                   |
| 15  | `cdp_execute_js`               | 执行 JavaScript 并返回结果                     |
| 16  | `cdp_open_new_tab`             | 打开新标签页                                   |
| 17  | `cdp_get_all_tabs`             | 获取所有标签页列表                             |
| 18  | `cdp_switch_tab`               | 切换到指定标签页                               |
| 19  | `cdp_close_tab_by_target`      | 关闭指定标签页                                 |
| 20  | `cdp_upload_file`              | 为 file input 设置文件                         |
| 21  | `cdp_download_file`            | 设置浏览器下载路径                             |
| 22  | `cdp_clipboard`                | 剪贴板操作（复制/粘贴/全选）                   |
| 23  | `cdp_press_key`                | 模拟单个按键                                   |
| 24  | `cdp_shortcut`                 | 模拟键盘快捷键组合                             |
| 25  | `cdp`                          | 调用任意 CDP 方法（低级，需了解协议）          |
| 26  | `cdp_get_browser_version`      | 获取浏览器版本信息                             |
| 27  | `cdp_get_browser_command_line` | 获取浏览器启动命令行参数                       |
| 28  | `cdp_get_window_for_target`    | 获取目标所在窗口的信息                         |
| 29  | `cdp_get_layout_metrics`       | 获取页面布局指标                               |
| 30  | `cdp_get_document`             | 获取 DOM 树（可控深度和 Shadow DOM 穿透）      |
| 31  | `cdp_get_full_ax_tree`         | 获取无障碍树（页面语义结构）                   |
| 32  | `cdp_handle_dialog`            | 处理浏览器 JS 对话框（alert/confirm/prompt）   |
| 33  | `cdp_get_cookies`              | 获取 Cookie                                    |
| 34  | `cdp_set_cookie`               | 设置单个 Cookie                                |
| 35  | `cdp_delete_cookies`           | ⚠️ 删除 Cookie                                 |
| 36  | `cdp_get_local_storage`        | 读取 localStorage                              |
| 37  | `cdp_set_local_storage`        | 写入 localStorage                              |
| 38  | `cdp_get_session_storage`      | 读取 sessionStorage                            |
| 39  | `cdp_clear_storage`            | ⚠️ 清除存储数据（localStorage/sessionStorage） |
| 40  | `cdp_get_current_url`          | 获取当前 URL                                   |
| 41  | `cdp_get_page_source`          | 获取 HTML 源码                                 |
| 42  | `cdp_wait_for_navigation`      | 等待导航完成                                   |
| 43  | `cdp_emulate_device`           | 模拟移动设备（viewport/UA/touch）              |
| 44  | `cdp_set_geolocation`          | 模拟地理位置                                   |
| 45  | `cdp_set_user_agent`           | 覆盖 User-Agent                                |
| 46  | `cdp_get_element_box`          | 获取元素边界框（位置/尺寸）                    |
| 47  | `cdp_highlight_element`        | 高亮页面元素                                   |
| 48  | `cdp_mouse_move`               | 移动鼠标到坐标                                 |
| 49  | `cdp_drag_and_drop`            | 拖放元素                                       |
| 50  | `cdp_select_option`            | 选择下拉选项（select 元素）                    |
| 51  | `cdp_check_checkbox`           | 勾选/取消复选框                                |
| 52  | `cdp_block_urls`               | 阻止指定 URL 加载                              |
| 53  | `cdp_intercept_request`        | 拦截并修改网络请求                             |
| 54  | `cdp_get_console_logs`         | 获取控制台日志                                 |
| 55  | `cdp_get_network_requests`     | 获取网络请求记录（仅元数据）                   |
| 56  | `cdp_pdf`                      | 导出页面为 PDF                                 |

### Magic — 浏览器控制（66 个）

**窗口控制（12 个）**

| #   | 工具名                               | 说明                        |
| --- | ------------------------------------ | --------------------------- |
| 1   | `magic_set_bounds`                   | 设置窗口位置和大小          |
| 2   | `magic_get_bounds`                   | 获取窗口位置和大小          |
| 3   | `magic_set_maximized`                | 最大化窗口                  |
| 4   | `magic_set_minimized`                | 最小化窗口                  |
| 5   | `magic_set_closed`                   | ⚠️ 关闭浏览器窗口           |
| 6   | `magic_safe_quit`                    | ⚠️ 安全退出浏览器           |
| 7   | `magic_set_restored`                 | 恢复窗口（从最大化/最小化） |
| 8   | `magic_set_fullscreen`               | 全屏窗口                    |
| 9   | `magic_set_bg_color`                 | 设置浏览器背景色            |
| 10  | `magic_set_toolbar_text`             | 设置工具栏显示文本          |
| 11  | `magic_set_app_top_most`             | 窗口置顶                    |
| 12  | `magic_set_master_indicator_visible` | 显示/隐藏主控指示器         |

**标签页管理（7 个）**

| #   | 工具名                        | 说明                           |
| --- | ----------------------------- | ------------------------------ |
| 13  | `magic_open_new_tab`          | 打开新标签页                   |
| 14  | `magic_close_tab`             | 关闭指定标签页                 |
| 15  | `magic_activate_tab`          | 激活指定标签页                 |
| 16  | `magic_activate_tab_by_index` | 按索引激活标签页               |
| 17  | `magic_close_inactive_tabs`   | 关闭所有非活跃标签页           |
| 18  | `magic_open_new_window`       | 打开新浏览器窗口               |
| 19  | `magic_type_string`           | 通过 Magic Controller 输入文本 |

**浏览器查询（11 个）**

| #   | 工具名                     | 说明                   |
| --- | -------------------------- | ---------------------- |
| 20  | `magic_get_browsers`       | 获取所有浏览器实例列表 |
| 21  | `magic_get_active_browser` | 获取当前活跃浏览器     |
| 22  | `magic_get_tabs`           | 获取浏览器的标签页列表 |
| 23  | `magic_get_active_tabs`    | 获取所有活跃标签页     |
| 24  | `magic_get_switches`       | 获取浏览器启动参数     |
| 25  | `magic_get_host_name`      | 获取环境主机名         |
| 26  | `magic_get_mac_address`    | 获取环境 MAC 地址      |
| 27  | `magic_get_maximized`      | 查询窗口是否最大化     |
| 28  | `magic_get_minimized`      | 查询窗口是否最小化     |
| 29  | `magic_get_fullscreen`     | 查询窗口是否全屏       |
| 30  | `magic_get_window_state`   | 获取完整窗口状态       |

**书签管理（10 个）**

| #   | 工具名                            | 说明                   |
| --- | --------------------------------- | ---------------------- |
| 31  | `magic_get_bookmarks`             | 获取全部书签树         |
| 32  | `magic_create_bookmark`           | 创建书签               |
| 33  | `magic_create_bookmark_folder`    | 创建书签文件夹         |
| 34  | `magic_update_bookmark`           | 更新书签标题或 URL     |
| 35  | `magic_move_bookmark`             | 移动书签到其他文件夹   |
| 36  | `magic_remove_bookmark`           | ⚠️ 删除书签            |
| 37  | `magic_bookmark_current_tab`      | 收藏当前标签页         |
| 38  | `magic_unbookmark_current_tab`    | 取消收藏当前标签页     |
| 39  | `magic_is_current_tab_bookmarked` | 检查当前页面是否已收藏 |
| 40  | `magic_export_bookmark_state`     | 导出书签状态           |

**Cookie 管理（3 个）**

| #   | 工具名                      | 说明                   |
| --- | --------------------------- | ---------------------- |
| 41  | `magic_get_managed_cookies` | 获取管理的 Cookie 列表 |
| 42  | `magic_export_cookie_state` | 导出 Cookie 状态       |
| 43  | `magic_import_cookies`      | 批量导入 Cookie        |

**扩展管理（5 个）**

| #   | 工具名                           | 说明                         |
| --- | -------------------------------- | ---------------------------- |
| 44  | `magic_get_managed_extensions`   | 获取已安装的扩展列表         |
| 45  | `magic_trigger_extension_action` | 触发扩展图标动作             |
| 46  | `magic_close_extension_popup`    | 关闭扩展弹窗                 |
| 47  | `magic_enable_extension`         | 启用扩展（运行时，不持久化） |
| 48  | `magic_disable_extension`        | 禁用扩展（运行时，不持久化） |

**同步控制（4 个）**

| #   | 工具名                   | 说明                                  |
| --- | ------------------------ | ------------------------------------- |
| 49  | `magic_toggle_sync_mode` | 切换同步模式（master/slave/disabled） |
| 50  | `magic_get_sync_mode`    | 获取当前同步模式                      |
| 51  | `magic_get_is_master`    | 检查是否为主控                        |
| 52  | `magic_get_sync_status`  | 获取同步状态详情                      |

**截图（1 个）**

| #   | 工具名                    | 说明                         |
| --- | ------------------------- | ---------------------------- |
| 53  | `magic_capture_app_shell` | 带壳截图（含工具栏和标签页） |

**AI Agent 语义化操作（13 个）**

| #   | 工具名                      | 说明                                   |
| --- | --------------------------- | -------------------------------------- |
| 54  | `magic_get_browser`         | 根据 browser_id 获取指定浏览器信息     |
| 55  | `magic_click_at`            | 坐标系点击（虚拟坐标映射到窗口像素）   |
| 56  | `magic_click_element`       | 语义化点击浏览器 Chrome UI 元素        |
| 57  | `magic_get_ui_elements`     | 查询浏览器 UI 当前状态                 |
| 58  | `magic_navigate_to`         | 导航到 URL（Magic Controller）         |
| 59  | `magic_query_dom`           | DOM 元素查询（返回候选列表）           |
| 60  | `magic_click_dom`           | 点击 DOM 元素（多种选择器）            |
| 61  | `magic_fill_dom`            | 填写表单元素                           |
| 62  | `magic_send_keys`           | 键盘输入（支持特殊键/快捷键）          |
| 63  | `magic_get_page_info`       | 获取页面综合状态信息                   |
| 64  | `magic_scroll`              | 页面滚动（方向或元素定位）             |
| 65  | `magic_set_dock_icon_text`  | 设置 Dock 图标文字标签（macOS）        |
| 66  | `magic_get_page_content`    | 获取页面语义快照（DOM/交互元素/文本）  |

### App — 应用数据（26 个）

| #   | 工具名                        | 说明                                |
| --- | ----------------------------- | ----------------------------------- |
| 1   | `app_list_profiles`           | 列出 profile（支持分组/关键字过滤） |
| 2   | `app_get_profile`             | 获取 profile 详情                   |
| 3   | `app_create_profile`          | 创建新 profile                      |
| 4   | `app_update_profile`          | 更新 profile 信息                   |
| 5   | `app_delete_profile`          | ⚠️ 删除 profile                     |
| 6   | `app_start_profile`           | 启动 profile 的浏览器               |
| 7   | `app_stop_profile`            | 停止 profile 的浏览器               |
| 8   | `app_get_running_profiles`    | 获取运行中的 profile 列表           |
| 9   | `app_set_chat_active_profile` | 切换当前聊天会话的工具目标环境      |
| 10  | `app_get_current_profile`     | 获取当前工具目标环境的 profile      |
| 11  | `app_list_device_presets`     | 列出机型预设                        |
| 12  | `app_get_device_preset`       | 获取机型预设详情                    |
| 13  | `app_create_device_preset`    | 创建机型预设                        |
| 14  | `app_update_device_preset`    | ⚠️ 更新机型预设                     |
| 15  | `app_delete_device_preset`    | ⚠️ 删除机型预设                     |
| 16  | `app_list_groups`             | 列出所有分组                        |
| 17  | `app_get_group`               | 获取分组详情                        |
| 18  | `app_create_group`            | 创建分组                            |
| 19  | `app_update_group`            | 更新分组                            |
| 20  | `app_delete_group`            | ⚠️ 删除分组                         |
| 21  | `app_get_profiles_in_group`   | 获取分组内的 profile                |
| 22  | `app_list_proxies`            | 列出代理                            |
| 23  | `app_get_proxy`               | 获取代理详情                        |
| 24  | `app_list_plugins`            | 列出插件包                          |
| 25  | `app_get_plugin`              | 获取插件详情                        |
| 26  | `app_get_engine_sessions`     | 获取引擎会话列表                    |

### Auto — 自动化管理（19 个）

**脚本管理（6 个）**

| #   | 工具名               | 说明                                        |
| --- | -------------------- | ------------------------------------------- |
| 1   | `auto_list_scripts`  | 列出所有脚本摘要（id、name、step_count 等） |
| 2   | `auto_get_script`    | 获取脚本完整详情（含步骤、变量 schema）     |
| 3   | `auto_create_script` | 创建新脚本                                  |
| 4   | `auto_update_script` | 更新脚本（未传字段保持原值）                |
| 5   | `auto_delete_script` | ⚠️ 永久删除脚本                             |
| 6   | `auto_export_script` | 导出脚本为 JSON 字符串                      |

**运行管理（5 个）**

| #   | 工具名                  | 说明                                    |
| --- | ----------------------- | --------------------------------------- |
| 7   | `auto_run_script`       | 异步执行脚本，返回 run_id（含递归防护） |
| 8   | `auto_list_runs`        | 列出脚本运行历史                        |
| 9   | `auto_list_active_runs` | 列出当前所有活跃 run_id                 |
| 10  | `auto_get_run`          | 获取运行详情（状态、步骤结果、日志）    |
| 11  | `auto_cancel_run`       | 取消正在执行的运行                      |

**AI Provider 配置（4 个）**

| #   | 工具名                  | 说明                         |
| --- | ----------------------- | ---------------------------- |
| 12  | `auto_list_ai_configs`  | 列出 AI 配置（API Key 脱敏） |
| 13  | `auto_create_ai_config` | 创建 AI Provider 配置        |
| 14  | `auto_update_ai_config` | 更新 AI Provider 配置        |
| 15  | `auto_delete_ai_config` | ⚠️ 删除 AI Provider 配置     |

**CAPTCHA Provider 配置（4 个）**

| #   | 工具名                       | 说明                              |
| --- | ---------------------------- | --------------------------------- |
| 16  | `auto_list_captcha_configs`  | 列出 CAPTCHA 配置（API Key 脱敏） |
| 17  | `auto_create_captcha_config` | 创建 CAPTCHA 求解服务配置         |
| 18  | `auto_update_captcha_config` | 更新 CAPTCHA 求解服务配置         |
| 19  | `auto_delete_captcha_config` | ⚠️ 删除 CAPTCHA 求解服务配置      |

> **安全提示**：标 ⚠️ 的操作不可撤销；`auto_run_script` 禁止运行当前正在执行的脚本（防止死循环）。

### File — 文件操作（6 个）

| #   | 工具名          | 说明                      |
| --- | --------------- | ------------------------- |
| 1   | `file_read`     | 读取文件内容（最大 10MB） |
| 2   | `file_write`    | ⚠️ 覆盖写入文件           |
| 3   | `file_append`   | 追加内容到文件末尾        |
| 4   | `file_list_dir` | 列出目录内容              |
| 5   | `file_exists`   | 检查文件/目录是否存在     |
| 6   | `file_mkdir`    | 递归创建目录              |

### Dialog — 用户交互（13 个）

| #   | 工具名                 | 说明                                           |
| --- | ---------------------- | ---------------------------------------------- |
| 1   | `dialog_message`       | 显示消息弹窗（非阻塞）                         |
| 2   | `dialog_confirm`       | 确认弹窗（阻塞，返回 true/false）              |
| 3   | `dialog_input`         | 输入弹窗（阻塞，返回用户输入）                 |
| 4   | `dialog_select`        | 单/多选选项弹窗（阻塞，返回选中值）            |
| 5   | `dialog_form`          | 多字段表单弹窗（阻塞，返回字段值对象）         |
| 6   | `dialog_table`         | 数据表格弹窗，支持选行（阻塞，返回选中行索引） |
| 7   | `dialog_image`         | 图片预览弹窗，支持输入框和自定义按钮           |
| 8   | `dialog_countdown`     | 倒计时确认弹窗，用于危险操作前给用户反悔时间   |
| 9   | `dialog_toast`         | 轻量通知（Toast），可附带操作按钮              |
| 10  | `dialog_markdown`      | Markdown 富文本展示弹窗，支持表格、代码块等    |
| 11  | `dialog_open_file`     | 文件选择对话框                                 |
| 12  | `dialog_save_file`     | 文件保存对话框                                 |
| 13  | `dialog_select_folder` | 文件夹选择对话框                               |

### Skill — Skill 安装与管理（6 个）

| #   | 工具名                       | 说明                                          |
| --- | ---------------------------- | --------------------------------------------- |
| 1   | `skill_list`                 | 列出所有已安装的 skill（元数据）              |
| 2   | `skill_read`                 | 读取指定 skill 的完整内容（body + 附件）      |
| 3   | `skill_create`               | ⚠️ 创建新 skill（写磁盘）                     |
| 4   | `skill_update`               | ⚠️ 更新已有 skill 的元数据或 body             |
| 5   | `skill_delete`               | ⚠️ 删除 skill（不可恢复）                     |
| 6   | `skill_enable_for_session`   | 添加/移除当前 session 的启用 skill 列表       |
