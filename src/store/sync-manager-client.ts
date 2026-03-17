export type SyncManagerClientEventHandler = (payload: unknown) => void;

export interface SyncManagerClient {
	connect: () => Promise<void>;
	request: <T>(type: string, payload?: unknown) => Promise<T>;
	on: (type: string, handler: SyncManagerClientEventHandler) => () => void;
	disconnect: () => void;
}

function nextRequestId() {
	return globalThis.crypto?.randomUUID?.() ?? `sync-${Date.now()}-${Math.random()}`;
}

export class MultiFlowSyncManagerClient implements SyncManagerClient {
	private websocket: WebSocket | null = null;
	private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
	private listeners = new Map<string, Set<SyncManagerClientEventHandler>>();
	private closedByClient = false;
	private readonly url: string;
	private readonly createWebSocket: (url: string) => WebSocket;

	constructor(url: string, createWebSocket: (url: string) => WebSocket = (value) => new WebSocket(value)) {
		this.url = url;
		this.createWebSocket = createWebSocket;
	}

	connect() {
		if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
			return Promise.resolve();
		}

		this.closedByClient = false;
		this.websocket = this.createWebSocket(this.url);

		return new Promise<void>((resolve, reject) => {
			let settled = false;
			const handleOpen = () => {
				if (settled) {
					return;
				}
				settled = true;
				resolve();
			};
			const handleError = () => {
				if (settled) {
					return;
				}
				settled = true;
				reject(new Error('sync manager websocket connect failed'));
			};
			this.websocket?.addEventListener('open', handleOpen, { once: true });
			this.websocket?.addEventListener('error', handleError, { once: true });
			this.websocket?.addEventListener('message', (event) => this.handleMessage(event.data));
			this.websocket?.addEventListener('close', (event) => {
				for (const pending of this.pending.values()) {
					pending.reject(new Error('sync manager websocket closed'));
				}
				this.pending.clear();
				this.emit('client.close', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean,
					closedByClient: this.closedByClient,
				});
				this.websocket = null;
			});
		});
	}

	request<T>(type: string, payload: unknown = {}) {
		if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('sync manager websocket is not connected'));
		}

		const id = nextRequestId();
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, {
				resolve: (value) => resolve(value as T),
				reject,
			});
			this.websocket?.send(JSON.stringify({ id, type, payload }));
		});
	}

	on(type: string, handler: SyncManagerClientEventHandler) {
		const handlers = this.listeners.get(type) ?? new Set();
		handlers.add(handler);
		this.listeners.set(type, handlers);
		return () => {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this.listeners.delete(type);
			}
		};
	}

	disconnect() {
		this.closedByClient = true;
		this.websocket?.close();
		this.websocket = null;
	}

	private handleMessage(raw: unknown) {
		const text = typeof raw === 'string' ? raw : String(raw);
		const message = JSON.parse(text) as
			| { id: string; status: 'ok' | 'error'; payload?: unknown }
			| { type: string; payload?: unknown };
		if ('id' in message) {
			const pending = this.pending.get(message.id);
			if (!pending) {
				return;
			}
			this.pending.delete(message.id);
			if (message.status === 'ok') {
				pending.resolve(message.payload as unknown);
			} else {
				const payload = message.payload as { message?: string } | undefined;
				pending.reject(new Error(payload?.message ?? 'unknown sync manager error'));
			}
			return;
		}
		this.emit(message.type, message.payload);
	}

	private emit(type: string, payload: unknown) {
		for (const handler of this.listeners.get(type) ?? []) {
			handler(payload);
		}
	}
}
