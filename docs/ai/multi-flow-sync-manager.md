# multi-flow-sync-manager

`multi-flow-sync-manager` 是给 Tauri 主程序接入多实例 Chromium 同步能力用的 Rust sidecar。

这份文档面向“项目接入”，回答的是：

- Tauri 怎么拉起 sidecar
- 前端怎么和 sidecar 建立唯一连接
- 该发哪些请求、会收到哪些事件
- 什么时候允许用户点“开始同步”
- 异常和自动停会话时 UI 应该怎么处理

协议基线以 [AGENTS.md](/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager/AGENTS.md) 为准；这里聚焦 Tauri 项目怎么用当前这版 sidecar。

## 接入前提

每个 Chromium 实例都必须：

- 带 `--magic-socket-server-port=<port>` 启动
- `host/port` 能被 sidecar 通过 HTTP 和 WebSocket 访问
- 属于同一平台同步会话，不做跨平台广播

当前 sidecar 的硬约束：

- 只接受一个 Tauri WebSocket 客户端连接
- `sync.start` 前会重新做完整 probe
- probe 要求 HTTP `get_switches`、HTTP `get_sync_status`、WS `sync.get_status` 都成功
- 会话前置校验要求 `active_browser.bounds / maximized / minimized / fullscreen / tab_count` 全部存在且主从一致
- 事件转发只校验并读取核心字段；转发到每个从控前，必须按事件来源窗口处理 `browser_id / window_token`
  - 普通浏览器窗口事件：改写成该从控自己的绑定窗口
  - 关联弹窗/子窗口事件：清空 `window_token`，让从控 Chromium 回退到当前活动窗口

## 整体架构

```text
Tauri UI / store
    |
    | 单条 WebSocket
    v
multi-flow-sync-manager
    |
    | HTTP: get_switches / get_sync_status / toggle_sync_mode
    | WS:   sync.get_status / subscribe / unsubscribe / inject_event
    v
Chromium instances
```

推荐分层：

- UI 层：只负责列表展示、按钮状态、错误提示
- Store 层：维护 sidecar 连接、实例状态、当前 session
- Client 层：封装 request/response、事件订阅、Promise 映射

## 1. 拉起 sidecar

sidecar 启动命令只有一个必填参数：

```bash
multi-flow-sync-manager --port <port>
```

启动成功后会向 stdout 输出一行 JSON：

```json
{ "type": "sidecar.ready", "port": 9800 }
```

Tauri 侧可以这样拉起：

```ts
import { Command } from '@tauri-apps/plugin-shell';

export async function startMultiFlowSyncManager(port: number) {
	const command = Command.sidecar('multi-flow-sync-manager', [
		'--port',
		String(port),
	]);

	return await new Promise<{
		child: Awaited<ReturnType<typeof command.spawn>>;
		port: number;
	}>(async (resolve, reject) => {
		let child: Awaited<ReturnType<typeof command.spawn>>;

		command.stdout.on('data', (line: string) => {
			try {
				const msg = JSON.parse(line);
				if (msg.type === 'sidecar.ready') {
					resolve({ child, port: msg.port });
				}
			} catch {
				// 忽略非 JSON 日志
			}
		});

		command.stderr.on('data', (line: string) => {
			console.debug('[multi-flow-sync-manager]', line);
		});

		child = await command.spawn();
		child.on('close', (event) => {
			reject(new Error(`sidecar exited: ${JSON.stringify(event)}`));
		});
	});
}
```

## 2. 建立唯一 WebSocket 连接

sidecar 只接受一个客户端连接：

```ts
const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
```

不要让多个页面、多个 store 或多个 hook 各自直连 sidecar。推荐做一个全局单例 client。

请求格式：

```json
{
	"id": "req-1",
	"type": "sync.get_session",
	"payload": {}
}
```

响应格式：

```json
{
	"id": "req-1",
	"status": "ok",
	"payload": {}
}
```

主动事件格式：

```json
{
	"type": "instances.updated",
	"payload": {}
}
```

## 3. Sidecar 请求协议

当前支持的请求只有这些：

- `instances.upsert`
- `instances.remove`
- `instances.probe`
- `sync.start`
- `sync.stop`
- `sync.get_session`
- `sync.shutdown`

### `instances.upsert`

用途：注册或覆盖一个 Chromium 实例。

```json
{
	"id": "req-1",
	"type": "instances.upsert",
	"payload": {
		"id": "browser-1",
		"host": "127.0.0.1",
		"port": 9999,
		"status": "unknown",
		"label": "主窗口"
	}
}
```

说明：

- `id` 由业务层生成并稳定维护
- 重复 `id` 会直接覆盖旧实例
- 当前可以预先传入的字段以 `id/host/port/status/label` 为主；诊断字段会在 probe 后由 sidecar 回填

### `instances.remove`

用途：移除一个实例。

```json
{
	"id": "req-2",
	"type": "instances.remove",
	"payload": {
		"id": "browser-1"
	}
}
```

### `instances.probe`

用途：对指定实例执行完整探测。

```json
{
	"id": "req-3",
	"type": "instances.probe",
	"payload": {
		"id": "browser-1"
	}
}
```

成功响应：

```json
{
	"id": "req-3",
	"status": "ok",
	"payload": {
		"instance": {},
		"probe": {
			"switch_port": 9999,
			"http_sync_status": {},
			"ws_sync_status": {},
			"warnings": []
		}
	}
}
```

失败响应仍然是 `status: "ok"`，但 `payload.error` 会有错误文本，`payload.probe` 为 `null`：

```json
{
	"id": "req-3",
	"status": "ok",
	"payload": {
		"instance": {},
		"probe": null,
		"error": "get_sync_status failed: ..."
	}
}
```

这点很重要：`instances.probe` 的业务成功/失败要看 `payload.error`，不能只看 response 的 `status`。

### `sync.start`

用途：启动一个主从同步会话。

```json
{
	"id": "req-4",
	"type": "sync.start",
	"payload": {
		"master_id": "browser-master",
		"slave_ids": ["browser-slave-1", "browser-slave-2"],
		"master_browser_id": 123,
		"slave_browser_ids": {
			"browser-slave-1": 456,
			"browser-slave-2": 789
		}
	}
}
```

当前实现说明：

- sidecar 会自己生成 `session_id`
- `sync.start` 已支持 `master_browser_id / slave_browser_ids`
- sidecar 会在 `toggle_sync_mode` 时把这些窗口 ID 传给 Chromium 做绑定
- `master_browser_id` 不传时，master 绑定当前活动窗口
- `slave_browser_ids` 没写到的 slave，会绑定各自当前活动窗口
- `slave_browser_ids` 里如果出现不在 `slave_ids` 中的实例 ID，sidecar 会直接返回错误
- `master_browser_id / slave_browser_ids.*` 必须是整数，否则 sidecar 会直接返回错误

### `sync.stop`

用途：停止当前会话。

```json
{
	"id": "req-5",
	"type": "sync.stop",
	"payload": {}
}
```

### `sync.get_session`

用途：读取当前会话和实例视图。

```json
{
	"id": "req-6",
	"type": "sync.get_session",
	"payload": {}
}
```

### `sync.shutdown`

用途：让 sidecar 自己退出。

```json
{
	"id": "req-7",
	"type": "sync.shutdown",
	"payload": {}
}
```

## 4. 主动事件

项目里至少要消费这三类事件：

- `instances.updated`
- `sync.session_updated`
- `sync.warning`

### `instances.updated`

每次实例注册、删除、probe 结果回写、会话确认刷新后都会推送。

```json
{
	"type": "instances.updated",
	"payload": {
		"instances": [
			{
				"id": "browser-1",
				"host": "127.0.0.1",
				"port": 9999,
				"status": "online",
				"platform": "macos",
				"last_drop_reason": "",
				"magic_socket_server_port": 9999,
				"bound_browser_id": 123,
				"bound_window_token": "0x12345678",
				"coordinate_mode": "window_relative",
				"ws_status_verified": true,
				"last_probe_error": null,
				"active_browser": {
					"bounds": {
						"left": 0,
						"top": 293,
						"width": 1200,
						"height": 800
					},
					"maximized": false,
					"minimized": false,
					"fullscreen": false,
					"tab_count": 1
				}
			}
		]
	}
}
```

重点字段：

- `status`: `unknown | online | offline | unhealthy`
- `magic_socket_server_port`: probe 后确认过的控制端口
- `ws_status_verified`: 是否已经完成过 `sync.get_status` 校验
- `bound_browser_id / bound_window_token / coordinate_mode`: Chromium 当前同步绑定状态
- slave 转发时要用自己的 `bound_browser_id / bound_window_token` 覆盖 master 事件中的同名字段
- `last_probe_error`: 最近一次 probe 失败文本

### `sync.session_updated`

在 `sync.start` 成功、`sync.stop` 成功、会话自动停止时推送。

```json
{
	"type": "sync.session_updated",
	"payload": {
		"session": {
			"session_id": "5cceb228-8e54-4c4c-ac4c-45377f5fb1a5",
			"master_id": "browser-master",
			"slave_ids": ["browser-slave-1"],
			"status": "running"
		},
		"metrics": {
			"events_received": 0,
			"events_forwarded": 0,
			"events_failed": 0,
			"events_dropped_invalid": 0,
			"events_dropped_session_mismatch": 0,
			"events_dropped_non_replayable": 0,
			"events_dropped_platform_mismatch": 0
		},
		"master": {},
		"slaves": [],
		"reason": null
	}
}
```

### `sync.warning`

用于实例探测失败、事件格式非法、自动停会话、slave 注入失败等情况。

```json
{
	"type": "sync.warning",
	"payload": {
		"scope": "probe",
		"code": "probe_failed",
		"message": "get_sync_status failed: ...",
		"instance_id": "browser-1",
		"details": null
	}
}
```

常见 `scope`：

- `probe`
- `forward`
- `instance`
- `session`

## 5. 推荐的数据模型

前端 store 建议至少维护这两个状态。

```ts
type InstanceStatus = 'unknown' | 'online' | 'offline' | 'unhealthy';

type BrowserBounds = {
	left: number;
	top: number;
	width: number;
	height: number;
};

type ActiveBrowserSnapshot = {
	bounds?: BrowserBounds;
	maximized?: boolean;
	minimized?: boolean;
	fullscreen?: boolean;
	tab_count?: number;
};

type InstanceInfo = {
	id: string;
	host: string;
	port: number;
	status: InstanceStatus;
	label?: string | null;
	platform?: string | null;
	last_drop_reason?: string | null;
	active_browser?: ActiveBrowserSnapshot | null;
	supports_native_replay?: boolean | null;
	capture_backend?: string | null;
	inject_backend?: string | null;
	magic_socket_server_port?: number | null;
	bound_browser_id?: number | null;
	bound_window_token?: string | null;
	coordinate_mode?: string | null;
	ws_status_verified: boolean;
	last_probe_error?: string | null;
};

type SyncMetrics = {
	events_received: number;
	events_forwarded: number;
	events_failed: number;
	events_dropped_invalid: number;
	events_dropped_session_mismatch: number;
	events_dropped_non_replayable: number;
	events_dropped_platform_mismatch: number;
};

type SyncSession = {
	session_id: string;
	master_id: string;
	slave_ids: string[];
	status: 'starting' | 'running' | 'stopping' | 'stopped';
};

type SessionPayload = {
	session: SyncSession | null;
	metrics: SyncMetrics;
	master: InstanceInfo | null;
	slaves: InstanceInfo[];
	reason: string | null;
};
```

## 6. 最小接入流程

### 1. 启动 sidecar

- 启动子进程
- 等 `sidecar.ready`
- 建立唯一 WebSocket

### 2. 注册实例

- 应用拿到 Chromium 列表后，对每个实例发送 `instances.upsert`
- 实例出现、端口变化、实例被移除时同步更新

### 3. 做 probe

建议这些时机主动探测：

- 实例首次出现
- 用户打开同步管理页
- 用户点击“开始同步”前
- 收到 `sync.warning` 且带 `instance_id`

### 4. 决定是否允许开始同步

只有 master 和所有 slave 都满足这些条件时，才建议放开“开始同步”按钮：

- `status === "online"`
- `ws_status_verified === true`
- `last_probe_error === null`
- `platform` 与 master 一致
- `active_browser.bounds` 存在
- `active_browser.maximized` 存在
- `active_browser.minimized` 存在
- `active_browser.fullscreen` 存在
- `active_browser.tab_count` 存在

如果你想和 sidecar 的严格校验保持一致，还应该要求主从这些窗口状态值完全一致，而不只是“字段存在”。

### 5. 开启同步

- 发送 `sync.start`
- 如果 UI 已经选中了具体浏览器窗口，把窗口 ID 填进 `master_browser_id / slave_browser_ids`
- 等待 response 成功
- 同时监听 `sync.session_updated`
- 若失败，直接展示 response 的错误文本

### 6. 结束同步

- 用户主动停止时发送 `sync.stop`
- 若收到 `sync.warning(scope="session", code="session_stopped")`，也要把 UI 切回“已停止”

## 7. 推荐 client 封装

推荐做一个单例 client，统一处理：

- 自增 `request id`
- `id -> Promise` 映射
- 主动事件分发
- sidecar 退出 / 断线重连

最小示例：

```ts
type SidecarResponse<T = unknown> = {
	id: string;
	status: 'ok' | 'error';
	payload?: T;
};

type SidecarEvent<T = unknown> = {
	type: string;
	payload: T;
};

export class MultiFlowSyncManagerClient {
	private ws: WebSocket;
	private requestId = 0;
	private pending = new Map<
		string,
		{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
	>();

	constructor(port: number) {
		this.ws = new WebSocket(`ws://127.0.0.1:${port}/`);
		this.ws.onmessage = (event) => {
			const msg = JSON.parse(String(event.data));
			if (msg.id && this.pending.has(msg.id)) {
				const pending = this.pending.get(msg.id)!;
				this.pending.delete(msg.id);
				if (msg.status === 'ok') {
					pending.resolve(msg.payload);
				} else {
					pending.reject(new Error(msg.payload?.message ?? 'sidecar error'));
				}
				return;
			}

			this.handleEvent(msg as SidecarEvent);
		};
	}

	request<T = unknown>(type: string, payload: unknown): Promise<T> {
		const id = `req-${++this.requestId}`;
		this.ws.send(JSON.stringify({ id, type, payload }));
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
		});
	}

	private handleEvent(event: SidecarEvent) {
		console.debug('[sidecar event]', event);
	}
}
```

## 8. 常见坑

- `instances.probe` 失败时 response 仍然是 `status: "ok"`，要检查 `payload.error`
- sidecar 只接受一个 WS 客户端，重复连接会被拒绝
- `sync.start` 会重新 probe，不是靠前端本地状态直接开始
- `sync.start` 的 `slave_browser_ids` 不能包含未出现在 `slave_ids` 里的实例 ID
- `sync.start` 的窗口绑定参数必须是整数
- `sync.stop` 在没有会话时会返回错误 `"no active session"`
- 当前事件 envelope 使用 `window_x / window_y` 表示窗口局部坐标；其语义是浏览器窗口左上角原点，不是 Cocoa 左下角原点
- sidecar 不应改写 `window_x / window_y`
- 对普通浏览器窗口事件，sidecar 必须按 slave 绑定窗口改写 `browser_id / window_token`
- 对关联弹窗/子窗口事件，sidecar 必须保留 `window_x / window_y`，并清空 `window_token` 以触发 slave 端活动窗口回退
- macOS Chromium 当前注入基线不是 `Widget::OnKeyEvent(...) / Widget::OnMouseEvent(...)`
  - 键盘优先经 `performKeyEquivalent:` 和 `firstResponder keyDown:/keyUp:/flagsChanged:`
  - 鼠标优先经 `contentView mouseDown:/mouseUp:/mouseDragged:/mouseMoved:/scrollWheel:`

## 9. 进一步阅读

- 协议基线与 Chromium 字段说明：[AGENTS.md](/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager/AGENTS.md)
- Chromium 控制接口完整参考：[chromium-control/references/chromium.md](/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager/chromium-control/references/chromium.md)
