# Chromium 控制接口文档

这份文档面向“指纹浏览器批量管理软件 app”中的 agent，目标是让 agent 能直接阅读、调用并编排这个编译后的 Chromium 程序。

本文档基于当前源码、旧版接入文档 [`chromium-old.md`](/Users/tt/Developer/Personal/chromium/chromium-old.md) 和当前项目接入约定整理而成。

本文档只描述当前代码中已经存在的实际接口和行为，不描述未实现的理想能力。

## 1. 总览

这个定制版 Chromium 内置了一套 `Magic Controller` 控制面，提供两类接口：

- 同一端口上的 HTTP 控制接口
- 同一端口上的 WebSocket 控制与事件接口

主要用途：

- 查询浏览器窗口和标签页信息
- 控制窗口状态和标签页操作
- 获取启动参数
- 进入同步模式
- 订阅主控事件流
- 向从控实例注入同步事件

核心实现位于：

- [chrome_browser_main.cc](/Users/tt/Developer/Personal/chromium/src/chrome/browser/chrome_browser_main.cc)
- [magic_socket_server.cc](/Users/tt/Developer/Personal/chromium/src/chrome/browser/magic_controller/magic_socket_server.cc)
- [magic_http_handler.cc](/Users/tt/Developer/Personal/chromium/src/chrome/browser/magic_controller/magic_http_handler.cc)
- [magic_ws_handler.cc](/Users/tt/Developer/Personal/chromium/src/chrome/browser/magic_controller/magic_ws_handler.cc)
- [magic_server_helper.cc](/Users/tt/Developer/Personal/chromium/src/chrome/browser/magic_controller/magic_server_helper.cc)
- [magic_sync_manager.h](/Users/tt/Developer/Personal/chromium/src/components/magic_sync_manager/magic_sync_manager.h)

## 2. 启动与监听

### 2.1 启动条件

内置控制服务只有在 Chromium 启动时传入下面这个参数才会启动：

```bash
--magic-socket-server-port=<port>
```

代码依据：

- [chrome_browser_main.cc:1407](/Users/tt/Developer/Personal/chromium/src/chrome/browser/chrome_browser_main.cc:1407)
- [base_switches.cc:237](/Users/tt/Developer/Personal/chromium/src/base/base_switches.cc:237)

如果没有这个参数，HTTP/WS 控制服务都不会启动。

### 2.2 默认启动示例

当前仓库里的启动脚本示例使用：

```bash
--magic-socket-server-port=9999
```

代码依据：

- [start.py:865](/Users/tt/Developer/Personal/chromium/start.py:865)

### 2.3 监听地址

当前代码实际监听：

```text
0.0.0.0:<port>
```

代码依据：

- [magic_socket_server.cc:68](/Users/tt/Developer/Personal/chromium/src/chrome/browser/magic_controller/magic_socket_server.cc:68)

这意味着它不是只监听 `127.0.0.1`。如果你只希望本机访问，需要在启动环境或防火墙层面额外限制。

### 2.4 同一端口承载 HTTP 与 WebSocket

同一个 `magic-socket-server-port` 同时承载：

- HTTP 请求
- WebSocket Upgrade

不需要分两个端口。

## 3. 基础调用约定

### 3.1 HTTP 约定

- 方法：只支持 `POST`
- 路径：当前代码不校验路径，理论上任意路径都能进入命令处理；建议统一使用 `/`
- Body：JSON，对象里必须包含 `cmd`
- Content-Type：建议 `application/json`

示例：

```bash
curl -X POST http://127.0.0.1:9999/ \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"get_active_browser"}'
```

### 3.2 HTTP 通用返回格式

大多数接口返回：

```json
{
	"status": "ok",
	"data": {}
}
```

错误通常返回：

```json
{
	"status": "error",
	"error": "..."
}
```

但是要注意，当前实现并不完全一致：

- `set_bg_color` 返回的是 `{ "status": "success" }`
- `get_bounds` 的 `data` 里又嵌了一个内部 `status: "ok"`
- 某些找不到对象的接口可能返回 `{ "status":"ok", "data": {} }`，而不是错误

agent 不要假设所有接口都严格遵守同一个返回模板。

### 3.3 WebSocket 约定

- 地址：`ws://127.0.0.1:<port>`
- 每条消息都是 JSON
- 客户端请求格式：

```json
{
	"type": "sync.get_status",
	"payload": {}
}
```

- 服务器响应格式：

```json
{
	"status": "ok",
	"data": {}
}
```

- 服务端主动事件：

```json
{
	"type": "sync.event",
	"payload": {}
}
```

## 4. 数据模型

### 4.1 Browser 对象

`get_browsers`、`get_browser`、`get_active_browser`、`get_sync_status.data.active_browser` 返回的浏览器对象主要字段如下：

```json
{
	"isActive": true,
	"id": 123,
	"tab_count": 3,
	"type": 1,
	"bounds": {
		"x": 0,
		"y": 25,
		"width": 1440,
		"height": 900
	},
	"maximized": false,
	"minimized": false,
	"fullscreen": false,
	"browser_info": {
		"user_title": "",
		"app_name": "",
		"profile_name": "...",
		"profile_path": "..."
	},
	"tabs": []
}
```

关键字段：

- `id`：浏览器窗口 ID，后文简称 `browser_id`
- `tab_count`：标签页数量
- `bounds`：窗口矩形
- `tabs`：该窗口下的标签页列表

### 4.2 Tab 对象

标签页对象主要字段如下：

```json
{
	"id": 456,
	"is_active": true,
	"url": "https://example.com/",
	"title": "Example",
	"loading": false
}
```

关键字段：

- `id`：标签页 ID，后文简称 `tab_id`
- `is_active`：是否活动标签页
- `loading`：是否还在加载

### 4.3 Sync 状态对象

`get_sync_status` 和 `sync.get_status` 的 `data` 部分主要字段如下：

```json
{
	"sync_mode": true,
	"is_master": true,
	"role": "master",
	"session_id": "sync-session-001",
	"next_seq": 12,
	"platform": "macos",
	"capture_backend": "mac_native_event_processor",
	"inject_backend": "mac_native_window",
	"supports_native_replay": true,
	"bound_browser_id": 123,
	"bound_window_token": "0x12345678",
	"coordinate_mode": "window_relative",
	"last_drop_reason": "",
	"active_browser": {}
}
```

字段含义：

- `sync_mode`：是否开启同步
- `is_master`：是否主控
- `role`：`disabled | master | slave`
- `session_id`：当前同步会话 ID
- `next_seq`：下一条本地出站事件序号
- `platform`：当前实例平台，当前实现为 `macos | windows | linux | unknown`
- `capture_backend`：当前启用的采集后端，例如 `mac_native_event_processor`、`aura_window_tree_host`、`fallback`
- `inject_backend`：当前启用的注入后端，例如 `mac_native_window`、`aura_event_injector`、`views_widget`
- `supports_native_replay`：当前平台是否支持底层原生重放
- `bound_browser_id`：当前同步绑定到的浏览器窗口 ID
- `bound_window_token`：当前绑定窗口 token
- `coordinate_mode`：当前坐标模型，现阶段固定为 `window_relative`
- `last_drop_reason`：最近一次事件被丢弃或拒绝注入的原因；空字符串表示当前没有最近错误
- `active_browser`：当前活动浏览器快照

## 5. HTTP 接口清单

以下命令全部通过 HTTP `POST` 调用，请求体都必须包含 `cmd`。

### 5.1 UI 与窗口外观

#### `set_bg_color`

设置当前活动浏览器窗口背景色。

请求：

```json
{
	"cmd": "set_bg_color",
	"r": 255,
	"g": 255,
	"b": 255
}
```

参数：

- `r`：可选，默认 `255`
- `g`：可选，默认 `255`
- `b`：可选，默认 `255`

返回：

```json
{
	"status": "success"
}
```

说明：

- 作用目标固定为当前活动窗口
- 返回格式和其他接口不一致

#### `set_toolbar_text`

设置当前活动窗口工具栏中的自定义文本。

请求：

```json
{
	"cmd": "set_toolbar_text",
	"text": "实例 01"
}
```

返回：

```json
{
	"status": "ok"
}
```

#### `set_master_indicator_visible`

控制主控标记是否显示。

请求：

```json
{
	"cmd": "set_master_indicator_visible",
	"visible": true,
	"label": "主控窗口"
}
```

参数：

- `visible`：可选，默认 `false`
- `label`：可选，不传时默认 `"主控窗口"`

### 5.2 窗口激活与状态

#### `set_app_top_most`

名字看起来像“置顶”，但实际行为只是激活当前活动窗口：

- 内部调用的是 `browser->window()->Activate()`
- 不是系统意义上的 always-on-top

请求：

```json
{
	"cmd": "set_app_top_most"
}
```

#### `set_bounds`

设置当前活动窗口位置和大小。

请求：

```json
{
	"cmd": "set_bounds",
	"x": 100,
	"y": 100,
	"width": 1280,
	"height": 900
}
```

说明：

- 只对当前活动窗口生效
- 只有 `width > 0 && height > 0` 才会真正设置

#### `get_bounds`

获取当前活动窗口位置和大小。

请求：

```json
{
	"cmd": "get_bounds"
}
```

返回示例：

```json
{
	"status": "ok",
	"data": {
		"status": "ok",
		"x": 100,
		"y": 100,
		"width": 1280,
		"height": 900
	}
}
```

注意：

- `data` 内部还有一个重复的 `status`

#### `set_maximized`

最大化当前活动窗口。

```json
{
	"cmd": "set_maximized"
}
```

#### `get_maximized`

获取当前活动窗口是否最大化。

```json
{
	"cmd": "get_maximized"
}
```

#### `set_minimized`

最小化当前活动窗口。

```json
{
	"cmd": "set_minimized"
}
```

#### `get_minimized`

获取当前活动窗口是否最小化。

```json
{
	"cmd": "get_minimized"
}
```

#### `set_closed`

关闭当前活动窗口。

```json
{
	"cmd": "set_closed"
}
```

#### `set_restored`

恢复当前活动窗口。

```json
{
	"cmd": "set_restored"
}
```

说明：

- 这是退出最小化/最大化/某些全屏状态时最值得优先尝试的接口

#### `set_fullscreen`

让当前活动窗口进入全屏。

```json
{
	"cmd": "set_fullscreen"
}
```

说明：

- 当前实现没有 `false` 参数
- 它只负责“开启全屏”
- 如果要退出，优先尝试 `set_restored`

#### `get_fullscreen`

获取当前活动窗口是否全屏。

```json
{
	"cmd": "get_fullscreen"
}
```

### 5.3 启动参数

#### `get_switches`

读取 Chromium 当前进程的某个命令行开关值。

请求：

```json
{
	"cmd": "get_switches",
	"key": "magic-socket-server-port"
}
```

返回示例：

```json
{
	"status": "ok",
	"data": {
		"key": "magic-socket-server-port",
		"value": "9999"
	}
}
```

常见可读 key：

- `magic-socket-server-port`
- `custom-bg-color`
- `toolbar-text`
- `fingerprint-seed`
- 其他 Chromium 启动参数

### 5.4 浏览器窗口查询

#### `get_browsers`

获取当前所有浏览器窗口信息。

```json
{
	"cmd": "get_browsers"
}
```

返回：

- `data` 是 `Browser[]`

#### `get_browser`

根据 `browser_id` 获取某个窗口信息。

请求：

```json
{
	"cmd": "get_browser",
	"browser_id": 123
}
```

注意：

- 如果 `browser_id` 缺失会报错
- 如果窗口不存在，当前实现可能返回 `ok + 空对象`，agent 要自己校验 `data.id`

#### `get_active_browser`

获取当前活动窗口信息。

```json
{
	"cmd": "get_active_browser"
}
```

### 5.5 标签页查询

#### `get_tabs`

获取某个窗口下的所有标签页。

请求：

```json
{
	"cmd": "get_tabs",
	"browser_id": 123
}
```

返回：

- `data` 是 `Tab[]`

#### `get_active_tabs`

获取当前活动窗口下的所有标签页。

```json
{
	"cmd": "get_active_tabs"
}
```

### 5.6 标签页与窗口操作

#### `close_inactive_tabs`

关闭当前活动窗口中所有非活动标签页。

```json
{
	"cmd": "close_inactive_tabs"
}
```

#### `close_tab`

关闭指定标签页。

请求：

```json
{
	"cmd": "close_tab",
	"tab_id": 456
}
```

重要限制：

- 当前实现只会在“当前活动窗口”的标签页中查找 `tab_id`
- 如果目标标签页在其他窗口里，即使 `tab_id` 存在，也会返回 `Tab not found`

#### `open_new_window`

用当前活动 profile 打开一个新窗口。

```json
{
	"cmd": "open_new_window"
}
```

返回示例：

```json
{
	"status": "ok",
	"data": {
		"browser_id": 789
	}
}
```

#### `open_new_tab`

在指定窗口或当前活动窗口打开新标签页。

请求：

```json
{
	"cmd": "open_new_tab",
	"browser_id": 123,
	"url": "https://example.com"
}
```

参数：

- `browser_id`：可选，不传则使用当前活动窗口
- `url`：必填

返回：

- `data` 是新标签页的基础信息

重要说明：

- 虽然代码没有显式判空 `url`，但实际调用时必须传 `url`
- agent 不要尝试省略 `url`

#### `activate_tab`

根据 `tab_id` 激活某个标签页，并可选激活其所属窗口。

请求：

```json
{
	"cmd": "activate_tab",
	"tab_id": 456,
	"focus_window": true
}
```

参数：

- `tab_id`：必填
- `focus_window`：可选，默认 `true`

行为：

- 会先全局查找 `tab_id`
- 再找到所属浏览器窗口
- 激活 tab
- 如 `focus_window` 为真，同时激活窗口

#### `activate_tab_by_index`

按索引激活某个窗口中的标签页。

请求：

```json
{
	"cmd": "activate_tab_by_index",
	"browser_id": 123,
	"index": 0
}
```

参数：

- `index`：必填
- `browser_id`：可选，不传则使用当前活动窗口

### 5.7 输入

#### `type_string`

向指定标签页或当前活动标签页发送文本输入。

请求：

```json
{
	"cmd": "type_string",
	"tab_id": 456,
	"text": "hello world"
}
```

参数：

- `tab_id`：可选，不传则使用当前活动窗口的活动标签页
- `text`：必填

重要说明：

- 当前实现逐字符发送 `kChar` 键盘事件
- 更接近“输入文本”而不是“模拟完整键盘按下/抬起”
- 适合表单输入，不适合复杂快捷键

### 5.8 同步模式

#### `toggle_sync_mode`

切换同步角色。

推荐新写法：

```json
{
	"cmd": "toggle_sync_mode",
	"role": "master",
	"browser_id": 123,
	"session_id": "sync-session-001"
}
```

或：

```json
{
	"cmd": "toggle_sync_mode",
	"role": "slave",
	"browser_id": 456,
	"session_id": "sync-session-001"
}
```

关闭同步：

```json
{
	"cmd": "toggle_sync_mode",
	"role": "disabled"
}
```

规则：

- `role` 支持：`disabled | master | slave`
- `browser_id` 可选；若传入则把当前同步角色绑定到指定浏览器窗口，否则绑定当前活动窗口

兼容旧写法：

```json
{
	"cmd": "toggle_sync_mode",
	"sync_mode": true,
	"is_master": false
}
```

规则：

- `role` 支持：`disabled | master | slave`
- 如果使用旧写法：
  - `sync_mode=false` => `disabled`
  - `sync_mode=true && is_master=true` => `master`
  - `sync_mode=true && is_master=false` => `slave`
- `role=disabled` 且未传 `session_id` 时，会清空当前 `session_id`
- `role=master` 时会自动显示主控标记
- 其他角色会自动隐藏主控标记

返回：

- `data` 是 Sync 状态对象

#### `get_sync_mode`

获取是否处于同步模式。

```json
{
	"cmd": "get_sync_mode"
}
```

返回：

- `data` 是 `true/false`

#### `get_is_master`

获取当前实例是否为主控。

```json
{
	"cmd": "get_is_master"
}
```

返回：

- `data` 是 `true/false`

#### `get_sync_status`

获取完整同步状态快照。

```json
{
	"cmd": "get_sync_status"
}
```

返回：

- `data` 是 Sync 状态对象

## 6. WebSocket 接口清单

WebSocket 主要用于同步功能。

如果你正在实现 Rust sidecar，建议优先阅读独立整理的同步接入文档：

- [sidecar-integration.md](/Users/tt/Developer/Personal/chromium/sidecar-integration.md)

### 6.1 客户端请求

#### `sync.subscribe_events`

订阅当前实例的主控事件流。

请求：

```json
{
	"type": "sync.subscribe_events"
}
```

返回：

- `status: "ok"`
- `data`: 当前 Sync 状态对象

说明：

- 只有在浏览器实例被设为 `master` 后，这个订阅才有实际意义

#### `sync.unsubscribe_events`

取消订阅事件流。

```json
{
	"type": "sync.unsubscribe_events"
}
```

#### `sync.get_status`

通过 WebSocket 获取当前同步状态。

```json
{
	"type": "sync.get_status"
}
```

#### `sync.inject_event`

向当前实例注入一条同步事件。

请求：

```json
{
	"type": "sync.inject_event",
	"payload": {
		"session_id": "sync-session-001",
		"seq": 25,
		"source_role": "master",
		"platform": "macos",
		"dispatch_stage": "mac_native_send_event",
		"event_family": "mouse",
		"event_type": "left_mouse_down",
		"replayable": true,
		"timestamp_ms": 123456789,
		"browser_id": -1,
		"window_token": "93217",
		"display_id": "69733248",
		"flags": 16,
		"root_x": 840.0,
		"root_y": 92.0,
		"window_x": 120.0,
		"window_y": 48.0,
		"common_payload": {
			"button": 0,
			"click_count": 1,
			"wheel_x": 0,
			"wheel_y": 0,
			"key_code": 0,
			"dom_code": 0,
			"scan_code": 0.0,
			"text": "",
			"unmodified_text": "",
			"repeat": false
		},
		"native_payload": {
			"ns_event_type": 1,
			"modifier_flags": 0,
			"button_number": 0,
			"pressure": 1.0,
			"phase": 0,
			"momentum_phase": 0,
			"precise_scrolling_deltas": false,
			"event_data_base64": "<opaque>"
		}
	}
}
```

注意：

- 浏览器当前必须已被切到 `slave`
- `session_id` 不匹配时会被忽略
- `platform` 与当前实例平台不匹配时会被拒绝，`last_drop_reason` 会变成 `platform_mismatch`
- `replayable: false` 的事件会被明确丢弃，`last_drop_reason` 会变成 `event_marked_non_replayable`
- 当前实现仍兼容旧版扁平 payload；但新的 sidecar / agent 应始终发送 `common_payload + native_payload` 结构

### 6.2 服务端主动推送

#### `sync.event`

当实例处于 `master` 且本地采集到事件时，会主动推送：

```json
{
	"type": "sync.event",
	"payload": {
		"session_id": "sync-session-001",
		"seq": 25,
		"source_role": "master",
		"platform": "macos",
		"dispatch_stage": "mac_native_send_event",
		"event_family": "mouse",
		"event_type": "left_mouse_down",
		"replayable": true,
		"timestamp_ms": 123456789,
		"browser_id": -1,
		"window_token": "93217",
		"display_id": "69733248",
		"flags": 16,
		"root_x": 840.0,
		"root_y": 92.0,
		"window_x": 120.0,
		"window_y": 48.0,
		"common_payload": {
			"button": 0,
			"click_count": 1,
			"wheel_x": 0,
			"wheel_y": 0,
			"key_code": 0,
			"dom_code": 0,
			"scan_code": 0.0,
			"text": "",
			"unmodified_text": "",
			"repeat": false
		},
		"native_payload": {
			"ns_event_type": 1,
			"modifier_flags": 0,
			"button_number": 0,
			"pressure": 1.0,
			"phase": 0,
			"momentum_phase": 0,
			"precise_scrolling_deltas": false,
			"event_data_base64": "<opaque>"
		}
	}
}
```

## 7. 同步事件字段定义

同步事件的 `payload` 字段如下：

- `session_id`：会话 ID
- `seq`：事件序号
- `source_role`：来源角色，当前通常是 `master`
- `platform`：事件来源平台；当前主控和被控必须同平台
- `dispatch_stage`：事件是在什么采集阶段被发出的，例如 `mac_native_send_event`、`aura_dispatch_event`、`aura_post_ime`、`views_widget_fallback`
- `event_family`：大类，当前主要为 `mouse | wheel | keyboard | scroll | other`
- `event_type`：具体事件类型。注意它现在是“后端相关”的：
  - mac 原生采集常见值：`left_mouse_down`、`left_mouse_up`、`scroll_wheel`、`key_down`、`key_up`、`flags_changed`
  - Aura / fallback 常见值：`mouse_pressed`、`mouse_dragged`、`mouse_released`、`mouse_moved`、`mouse_wheel`、`key_pressed`、`key_released`
- `replayable`：当前事件是否可稳定重放
- `timestamp_ms`：毫秒时间戳
- `browser_id`：浏览器窗口 ID；当前很多路径下仍可能为 `-1`
- `window_token`：底层窗口标识。macOS 使用 `windowNumber` 字符串；Aura 使用 `WindowTreeHost` 地址字符串
- `display_id`：显示器标识；取值因平台而异
- `flags`：Chromium/UI 事件 flags
- `root_x` / `root_y`：屏幕绝对坐标，仅用于诊断和回退
- `window_x` / `window_y`：相对绑定窗口左上角的局部坐标；当前鼠标/滚轮同步以这组坐标为主
- `common_payload`：平台无关的通用字段
- `native_payload`：平台相关的原生字段

### 7.1 `common_payload`

当前统一字段：

- `button`：按键编号或变化中的按钮值
- `click_count`：点击次数
- `wheel_x` / `wheel_y`：滚轮偏移
- `key_code`：键盘码
- `dom_code`：DOM code；Aura 键盘路径会填值，mac 当前为 `0`
- `scan_code`：扫描码；Aura Ozone 路径可用，其他路径可能为 `0`
- `text`：当前文本
- `unmodified_text`：未应用修饰键前的文本
- `repeat`：是否重复按键

### 7.2 `native_payload`

当前按平台分层：

- macOS 常见字段：
  - `ns_event_type`
  - `modifier_flags`
  - `button_number`
  - `pressure`
  - `phase`
  - `momentum_phase`
  - `precise_scrolling_deltas`
  - `event_data_base64`
- Aura 常见字段：
  - `ui_event_type`
  - `source_device_id`
  - `is_synthesized`
  - `changed_button_flags`
  - `is_char`

### 7.3 兼容说明

- 当前浏览器仍兼容旧版扁平结构输入：
  - `event_class`
  - `changed_button_flags`
  - `wheel_x`
  - `wheel_y`
  - `key_code`
- 兼容逻辑只用于过渡；新的 Rust sidecar 和 agent 实现应改为发送新版 envelope

## 8. 推荐的 agent 调用流程

### 8.1 只做浏览器窗口/标签页控制

1. 确认 Chromium 启动时带了 `--magic-socket-server-port`
2. 调 `get_browsers` 建立本地窗口映射
3. 调 `get_active_browser` / `get_tabs` 获取目标对象
4. 调 `activate_tab` / `open_new_tab` / `set_bounds` 等接口

### 8.2 启动同步会话

1. 对主控实例 HTTP 调 `toggle_sync_mode(role=master, session_id=...)`
2. 对每个从控实例 HTTP 调 `toggle_sync_mode(role=slave, session_id=...)`
3. 连接主控实例 WS，发送 `sync.subscribe_events`
4. 收到主控 `sync.event` 后，优先复用完整新版 `payload`
5. 转发到每个从控前，必须按事件来源窗口处理 `browser_id / window_token`
   - 普通浏览器窗口事件：改写成该从控当前绑定窗口的值
   - 关联弹窗/子窗口事件：清空 `window_token`，让从控回退到当前活动窗口，避免菜单项点击被打回浏览器主窗口
6. 只有在兼容旧版调用方时，才由 sidecar 负责扁平结构到新版 envelope 的适配
7. 会话结束时：
   - 主控发 `sync.unsubscribe_events`
   - 所有实例 HTTP 调 `toggle_sync_mode(role=disabled)`
8. macOS 当前注入语义：
   - 键盘优先走 `performKeyEquivalent:` / `firstResponder keyDown:` / `keyUp:` / `flagsChanged:`
   - 鼠标优先走 `contentView mouseDown:` / `mouseUp:` / `mouseDragged:` / `mouseMoved:` / `scrollWheel:`
   - 不再把 `Widget::OnKeyEvent(...)` / `Widget::OnMouseEvent(...)` 作为最终原生注入入口

### 8.3 启动前健康检查

建议 agent 在开同步前至少做这几步：

1. `get_sync_status`
2. `get_active_browser`
3. `get_tabs` 或 `get_active_tabs`
4. 比较：
   - 窗口大小
   - 最大化/最小化/全屏状态
   - tab 数量
   - 当前活动 tab

## 9. 已知限制与坑

这些都是基于当前代码的真实行为。

### 9.1 接口路径未校验

HTTP `path` 当前不参与路由，路由只看 JSON 里的 `cmd`。

建议：

- agent 固定用 `/`
- 不要依赖不同 URL path 表示不同业务

### 9.2 返回结构不完全统一

尤其注意：

- `set_bg_color` 返回 `success`
- 大多数其他命令返回 `ok`
- `get_bounds` 有双层 `status`

建议 agent：

- 先判断顶层 `status`
- 再按命令自己的结构解析 `data`

### 9.3 某些命令只针对活动窗口

以下命令不接受 `browser_id`，固定作用于当前活动窗口：

- `set_bg_color`
- `set_toolbar_text`
- `set_master_indicator_visible`
- `set_app_top_most`
- `set_bounds`
- `get_bounds`
- `set_maximized`
- `get_maximized`
- `set_minimized`
- `get_minimized`
- `set_closed`
- `set_restored`
- `set_fullscreen`
- `get_fullscreen`
- `close_inactive_tabs`

如果 agent 需要控制某个指定窗口，先用 `activate_tab` 或其他方式把它变成活动窗口。

### 9.4 `close_tab` 只能关活动窗口里的标签页

虽然参数是 `tab_id`，但内部查找逻辑只查当前活动窗口。

建议：

1. 先让目标标签页所属窗口变成活动窗口
2. 再调用 `close_tab`

### 9.5 `set_app_top_most` 名字和行为不一致

当前不是系统层面的 top-most，只是 `Activate()`。

### 9.6 `set_fullscreen` 只有开启，没有显式关闭参数

退出全屏时优先尝试 `set_restored`。

### 9.7 `open_new_tab` 的 `url` 必填

代码未做空指针保护，agent 必须始终传 `url`。

### 9.8 当前服务监听 `0.0.0.0`

如果你的批量管理 app 只希望本机访问，必须自己做网络隔离。

## 10. 最小可用示例

### 10.1 查询当前活动窗口

```bash
curl -X POST http://127.0.0.1:9999/ \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"get_active_browser"}'
```

### 10.2 打开新标签页

```bash
curl -X POST http://127.0.0.1:9999/ \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"open_new_tab","url":"https://www.example.com"}'
```

### 10.3 进入主控同步模式

```bash
curl -X POST http://127.0.0.1:9999/ \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"toggle_sync_mode","role":"master","session_id":"sync-session-001"}'
```

### 10.4 订阅主控事件

```json
{
	"type": "sync.subscribe_events"
}
```

### 10.5 向从控注入事件

```json
{
	"type": "sync.inject_event",
	"payload": {
		"session_id": "sync-session-001",
		"seq": 1,
		"source_role": "master",
		"platform": "macos",
		"dispatch_stage": "mac_native_send_event",
		"event_family": "mouse",
		"event_type": "left_mouse_down",
		"replayable": true,
		"timestamp_ms": 123456789,
		"browser_id": -1,
		"window_token": "93217",
		"display_id": "69733248",
		"flags": 16,
		"root_x": 500.0,
		"root_y": 120.0,
		"common_payload": {
			"button": 0,
			"click_count": 1,
			"wheel_x": 0,
			"wheel_y": 0,
			"key_code": 0,
			"dom_code": 0,
			"scan_code": 0.0,
			"text": "",
			"unmodified_text": "",
			"repeat": false
		},
		"native_payload": {
			"ns_event_type": 1,
			"modifier_flags": 0,
			"button_number": 0,
			"pressure": 1.0,
			"phase": 0,
			"momentum_phase": 0,
			"precise_scrolling_deltas": false,
			"event_data_base64": "<opaque>"
		}
	}
}
```

## 11. 给 agent 的最终建议

如果你在“指纹浏览器批量管理软件 app”里写 agent，建议按下面的原则使用这份 Chromium：

- 把它看成“同端口双协议控制目标”
- HTTP 用于状态与命令
- WebSocket 用于同步状态与事件流
- 不要假设接口完全 RESTful
- 不要假设所有返回结构完全一致
- 涉及窗口级操作时，先确认当前活动窗口
- 涉及同步时，始终自己维护 `session_id`
- 对所有 `browser_id` / `tab_id` 做二次校验，不要只信命令成功

## 12. 指纹浏览器批量管理 app 当前接入约定

这一节合并自旧版文档中的项目约定，目的是让 agent 在调用 Chromium 时，同时理解上层指纹浏览器应用当前如何组织环境参数。

### 12.1 当前资源与版本约定

- 浏览器资源版本与指纹版本统一使用同一个字段：`browserVersion`
- 这个字段同时决定：
  - 运行内核版本
  - 对外暴露的浏览器版本
- 宿主资源平台和模拟平台拆开：
  - 宿主资源平台：由当前系统自动推导，只用于匹配和下载可执行文件
  - 模拟平台：由环境配置决定，可模拟 `macos/windows/linux/android/ios`
- 启动时如果当前宿主系统缺少目标 `browserVersion`：
  - 自动下载并安装该版本
  - 安装完成后继续本次启动
  - 不切换全局 active Chromium
- 如果当前宿主系统没有该版本构建，直接报错，不回退其他版本

### 12.2 环境持久化字段

环境保存时，上层 app 当前会持久化：

- `fingerprintSource`
- `fingerprintSnapshot`

### 12.3 代理与语言 / 时区联动

当前 app 的语言和时区注入优先级为：

1. Profile 显式配置
2. 代理的 `effectiveLanguage / effectiveTimezone`
3. 如果代理没有生效值，再回退旧的国家码默认映射

代理内部区分：

- `suggestedLanguage / suggestedTimezone`
- `effectiveLanguage / effectiveTimezone`

Chromium 实际接收的仍是这些注入结果：

- `--lang`
- `TZ`
- `--custom-main-language`
- `--custom-time-zone`

### 12.4 环境背景色约定

上层 app 当前约定：

- 新增启动参数：`--custom-bg-color=#RRGGBB`
- 环境配置 `basic.browserBgColor` 有值时才注入
- 运行中修改背景色时：
  - 持久化到环境设置
  - 若当前实例正在运行，则调用 magic 命令 `set_bg_color` 立即生效
- 下次启动时仍从已保存背景色读取并注入

## 13. 启动参数总表

这一节分两类：

- `base_switches.cc` 中已定义的 `kCustom*` 启动参数
- 上层接入强依赖但不是 `kCustom*` 命名的相关参数

### 13.1 `base_switches.cc` 中的 `kCustom*` 参数

以下参数直接定义在 [base_switches.cc:198](/Users/tt/Developer/Personal/chromium/src/base/base_switches.cc:198) 一带。

| 参数                        | 常量名                   | 用途                           | 示例                                                      |
| --------------------------- | ------------------------ | ------------------------------ | --------------------------------------------------------- | ----------------------- | -------- | ---------- | -------- | ------------------------------------- | --------------------- |
| `--custom-bg-color`         | `kCustomBackgroundColor` | 启动时设置窗口背景色           | `--custom-bg-color=#1E1E1E`                               |
| `--custom-ua-metadata`      | `kCustomUAMetadata`      | 自定义 `Sec-CH-UA*` 相关元数据 | `--custom-ua-metadata=platform=Windows                    | platform_version=13.0.0 | arch=x86 | bitness=64 | mobile=0 | brands=Google Chrome:144,Chromium:144 | form_factors=Desktop` |
| `--custom-cpu-cores`        | `kCustomCpuCores`        | 自定义 CPU 核心数              | `--custom-cpu-cores=8`                                    |
| `--custom-ram-gb`           | `kCustomRamGb`           | 自定义内存大小，单位 GB        | `--custom-ram-gb=16`                                      |
| `--custom-gl-vendor`        | `kCustomGlVendor`        | 自定义 GL 供应商               | `--custom-gl-vendor=NVIDIA`                               |
| `--custom-gl-renderer`      | `kCustomGlRenderer`      | 自定义 GL 渲染器               | `--custom-gl-renderer=NVIDIA GeForce RTX 4090`            |
| `--custom-touch-points`     | `kCustomTouchPoints`     | 自定义触摸点数                 | `--custom-touch-points=5`                                 |
| `--custom-main-language`    | `kCustomMainLanguage`    | 自定义主语言                   | `--custom-main-language=en-US`                            |
| `--custom-languages`        | `kCustomLanguages`       | 自定义语言列表                 | `--custom-languages=en-US,zh-CN`                          |
| `--custom-accept-languages` | `kCustomAcceptLanguages` | 自定义 Accept-Language 值      | `--custom-accept-languages=en-US,en,zh-CN`                |
| `--custom-time-zone`        | `kCustomTimeZone`        | 自定义时区                     | `--custom-time-zone=Asia/Shanghai`                        |
| `--webrtc-ip-override`      | `kWebrtcIpOverride`      | 覆盖 WebRTC 暴露 IP            | `--webrtc-ip-override=203.0.113.10`                       |
| `--custom-platform`         | `kCustomPlatform`        | 自定义平台标识                 | `--custom-platform=Win32`                                 |
| `--custom-font-list`        | `kCustomFontList`        | 自定义字体列表                 | `--custom-font-list=Arial,Verdana,Tahoma,Microsoft YaHei` |

### 13.2 其他强相关启动参数

这些参数虽然不属于 `kCustom*` 命名，但对当前 app 同样是强依赖：

| 参数                          | 用途                                   | 示例                                                                                                                           |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--user-agent`                | 自定义 UA                              | `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36` |
| `--fingerprint-seed`          | 自定义指纹种子                         | `--fingerprint-seed=178172`                                                                                                    |
| `--toolbar-text`              | 地址栏和刷新按钮之间显示自定义标识文字 | `--toolbar-text=实例-01`                                                                                                       |
| `--magic-socket-server-port`  | 启动 Chromium 内置 HTTP/WS 控制服务    | `--magic-socket-server-port=9999`                                                                                              |
| `--window-size`               | 窗口尺寸                               | `--window-size=393,852`                                                                                                        |
| `--force-device-scale-factor` | 设备缩放因子 / DPR                     | `--force-device-scale-factor=3`                                                                                                |
| `--touch-events=enabled`      | 显式开启触摸事件                       | `--touch-events=enabled`                                                                                                       |
| `--use-mobile-user-agent`     | 使用移动端 UA 行为                     | `--use-mobile-user-agent`                                                                                                      |
| `--lang`                      | 浏览器语言                             | `--lang=en-US`                                                                                                                 |
| `TZ`                          | 进程时区环境变量                       | `TZ=Asia/Shanghai`                                                                                                             |

### 13.3 参数详细说明

#### `--custom-ua-metadata`

旧文档中的格式示例：

```text
platform=Windows|platform_version=13.0.0|arch=x86|bitness=64|mobile=0|brands=Google Chrome:144,Chromium:144|form_factors=Desktop
```

它通常需要和下面这些参数保持一致：

- `--user-agent`
- `--custom-platform`
- `--custom-touch-points`
- 浏览器主版本号

#### `--custom-platform`

旧文档给出的常见值：

- `Linux armv81`
- `MacIntel`
- `Win32`
- `Linux x86_64`
- `iPhone`

说明：

- Android 风格平台通常映射到 `Linux armv81`
- iOS 风格平台通常映射到 `iPhone`
- Windows 风格平台通常映射到 `Win32`
- macOS 风格平台通常映射到 `MacIntel`

#### `--custom-gl-vendor` / `--custom-gl-renderer`

这两个值必须成对匹配，不能随便拼接。

错误示例：

- `--user-agent` 模拟 Windows，但 `gl-renderer` 暴露 Apple Metal 风格内容
- `custom-gl-vendor=NVIDIA` 但 `custom-gl-renderer` 却是 Apple GPU

#### `--custom-font-list`

格式示例：

```text
Arial,Verdana,Tahoma,Microsoft YaHei
```

建议：

- 桌面平台使用桌面字体集合
- Android 使用 Android 风格字体集合
- iOS 使用 iOS 风格字体集合

#### `--custom-touch-points`

建议根据平台决定：

- 桌面平台通常不传，或为 `0`
- 移动平台通常为 `5`

### 13.4 参数一致性规则

这些规则来自旧文档中的接入经验，agent 生成启动参数时必须同时检查：

- `user-agent` 和 `custom-ua-metadata` 主版本要一致
- `user-agent` 和 `custom-platform` 要一致
- `custom-platform` 和 `custom-touch-points` 要一致
- `custom-gl-vendor` 和 `custom-gl-renderer` 要一致
- `custom-font-list` 要和模拟平台匹配
- 移动设备预设通常需要同时注入：
  - `--window-size`
  - `--force-device-scale-factor`
  - `--touch-events=enabled`
  - `--use-mobile-user-agent`

旧文档中给出的典型错误提醒：

- Windows UA 不应搭配 `custom-platform=MacIntel`
- Windows UA 不应搭配 Apple Metal 风格 `gl-renderer`
- 桌面设备不应随意传移动端 `custom-touch-points`

## 14. 当前平台与设备预设默认映射

这一节同样来自旧文档中 app 侧当前约定。

### 14.1 平台级默认映射

#### `android`

- `--custom-platform=Linux armv81`
- `--custom-touch-points=5`
- `--custom-ua-metadata=platform=Android|platform_version=14.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:<major>,Chromium:<major>|form_factors=Mobile`
- 额外附加：`--use-mobile-user-agent`

#### `ios`

- `--custom-platform=iPhone`
- `--custom-touch-points=5`
- `--custom-ua-metadata=platform=iOS|platform_version=17.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:<major>,Chromium:<major>|form_factors=Mobile`
- 额外附加：`--use-mobile-user-agent`

### 14.2 设备预设层

当前预设目录包括：

- `macos_macbook_pro_14`
- `windows_11_desktop`
- `linux_ubuntu_desktop`
- `android_pixel_8`
- `android_s24_ultra`
- `ios_iphone_15_pro`
- `ios_iphone_15_pro_max`
- `ios_ipad_air`

如果选择设备预设，通常还会自动补充：

- `--window-size=<width>,<height>`
- `--force-device-scale-factor=<dpr>`
- `--touch-events=enabled`
- 若未自定义 UA，则使用预设 UA
- 若未自定义字体列表，则使用对应平台默认字体集

### 14.3 默认字体策略

- `android`：Android 风格字体集，如 `Roboto`、`Noto Sans`、`Noto Sans CJK`、`Noto Color Emoji`
- `ios`：iOS 风格字体集，如 `Helvetica Neue`、`PingFang`、`Hiragino Sans`、`Apple Color Emoji`

### 14.4 参数职责边界

- 平台参数负责大类行为：
  - `platform`
  - `touch points`
  - `mobile metadata`
- 设备预设负责更细粒度行为：
  - `window-size`
  - `DPR`
  - 更具体的 UA
  - 更具体的字体集合

## 15. 真实请求 / 响应样例

这一节保留旧文档中的高价值真实样例，方便 agent 对返回结构建立直觉。

### 15.1 `get_browsers` 响应示例

```json
{
	"status": "ok",
	"data": [
		{
			"bounds": {
				"height": 1201,
				"width": 1541,
				"x": -2498,
				"y": 94
			},
			"browser_info": {
				"app_name": "",
				"profile_name": "",
				"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
				"user_title": ""
			},
			"fullscreen": false,
			"id": 1476302119,
			"isActive": false,
			"maximized": false,
			"minimized": false,
			"tab_count": 6,
			"tabs": [
				{
					"id": 1476302120,
					"is_active": true,
					"loading": false,
					"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
					"url": "https://www.browserscan.net/zh#google_vignette"
				},
				{
					"id": 1476302121,
					"is_active": false,
					"loading": false,
					"title": "实用工具-IP查询,机器人检测,WebRTC泄漏测试,DNS泄漏测试,HTTP2指纹,端口扫描,Cookie转换,UserAgent解析 | BrowserScan",
					"url": "https://www.browserscan.net/zh/tools"
				}
			],
			"type": 0
		},
		{
			"bounds": {
				"height": 1201,
				"width": 1541,
				"x": -2476,
				"y": 116
			},
			"browser_info": {
				"app_name": "",
				"profile_name": "",
				"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
				"user_title": ""
			},
			"fullscreen": false,
			"id": 1476302199,
			"isActive": true,
			"maximized": false,
			"minimized": false,
			"tab_count": 1,
			"tabs": [
				{
					"id": 1476302200,
					"is_active": true,
					"loading": false,
					"title": "新标签页",
					"url": "chrome://newtab/"
				}
			],
			"type": 0
		}
	]
}
```

### 15.2 `get_browser` 响应示例

```json
{
	"status": "ok",
	"data": {
		"bounds": {
			"height": 1201,
			"width": 1541,
			"x": -2498,
			"y": 94
		},
		"browser_info": {
			"app_name": "",
			"profile_name": "",
			"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
			"user_title": ""
		},
		"fullscreen": false,
		"id": 1476302119,
		"isActive": false,
		"maximized": false,
		"minimized": false,
		"tab_count": 6,
		"tabs": [
			{
				"id": 1476302120,
				"is_active": true,
				"loading": false,
				"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
				"url": "https://www.browserscan.net/zh#google_vignette"
			}
		],
		"type": 0
	}
}
```

### 15.3 `get_tabs` 响应示例

```json
{
	"status": "ok",
	"data": [
		{
			"id": 1476302120,
			"is_active": true,
			"loading": false,
			"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
			"url": "https://www.browserscan.net/zh#google_vignette"
		},
		{
			"id": 1476302121,
			"is_active": false,
			"loading": false,
			"title": "实用工具-IP查询,机器人检测,WebRTC泄漏测试,DNS泄漏测试,HTTP2指纹,端口扫描,Cookie转换,UserAgent解析 | BrowserScan",
			"url": "https://www.browserscan.net/zh/tools"
		}
	]
}
```

### 15.4 `get_active_browser` 响应示例

```json
{
	"status": "ok",
	"data": {
		"bounds": {
			"height": 1201,
			"width": 1541,
			"x": -2560,
			"y": 166
		},
		"browser_info": {
			"app_name": "",
			"profile_name": "",
			"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
			"user_title": ""
		},
		"fullscreen": false,
		"id": 1476302199,
		"isActive": true,
		"maximized": false,
		"minimized": false,
		"tab_count": 1,
		"tabs": [
			{
				"id": 1476302200,
				"is_active": true,
				"loading": false,
				"title": "新标签页",
				"url": "chrome://newtab/"
			}
		],
		"type": 0
	}
}
```

### 15.5 `get_active_tabs` 响应示例

```json
{
	"status": "ok",
	"data": [
		{
			"id": 1476302200,
			"is_active": true,
			"loading": false,
			"title": "新标签页",
			"url": "chrome://newtab/"
		}
	]
}
```

### 15.6 `open_new_tab` 响应示例

```json
{
	"status": "ok",
	"data": {
		"loading": true,
		"tab_id": 1476302201,
		"title": "",
		"url": "https://google.com/"
	}
}
```

### 15.7 布尔型状态响应示例

`get_maximized` / `get_minimized` / `get_fullscreen` / `get_sync_mode` / `get_is_master` 常见返回：

```json
{
	"status": "ok",
	"data": false
}
```

## 16. 对 agent 的补充实施建议

如果 agent 需要为上层指纹浏览器 app 生成整套启动参数，建议把参数生成分成三层校验：

1. 平台层
   - `custom-platform`
   - `custom-touch-points`
   - `custom-ua-metadata.mobile`
2. 设备层
   - `window-size`
   - `force-device-scale-factor`
   - 字体列表
3. 指纹层
   - `user-agent`
   - `custom-ua-metadata`
   - `custom-gl-vendor`
   - `custom-gl-renderer`
   - `fingerprint-seed`

建议 agent 的执行顺序：

1. 先生成平台与设备预设
2. 再生成 UA / metadata / GL / fonts
3. 做一致性校验
4. 最后调用 `get_switches`、`get_active_browser`、`get_sync_status` 做运行期确认
