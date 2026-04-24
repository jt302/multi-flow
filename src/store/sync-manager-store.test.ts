import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

import zhWindow from '@/shared/i18n/locales/zh-CN/window.json';

import { createSyncManagerStore } from './sync-manager-store.ts';

await i18next.init({
	lng: 'zh-CN',
	fallbackLng: 'zh-CN',
	defaultNS: 'window',
	resources: {
		'zh-CN': {
			window: zhWindow,
		},
	},
});

class FakeSyncManagerClient {
	requests: Array<{ type: string; payload: unknown }> = [];
	listeners = new Map<string, Set<(payload: unknown) => void>>();
	connectCalls = 0;

	async connect() {
		this.connectCalls += 1;
	}

	on(type: string, handler: (payload: unknown) => void) {
		const handlers = this.listeners.get(type) ?? new Set();
		handlers.add(handler);
		this.listeners.set(type, handlers);
		return () => handlers.delete(handler);
	}

	async request<T>(type: string, payload: unknown) {
		this.requests.push({ type, payload });
		if (type === 'sync.get_session') {
			return {
				session: null,
				metrics: {
					events_received: 0,
					events_forwarded: 0,
					events_failed: 0,
					events_dropped_invalid: 0,
					events_dropped_session_mismatch: 0,
					events_dropped_non_replayable: 0,
					events_dropped_platform_mismatch: 0,
				},
				master: null,
				slaves: [],
				reason: null,
			} as T;
		}
		return {} as T;
	}

	emit(type: string, payload: unknown) {
		for (const handler of this.listeners.get(type) ?? []) {
			handler(payload);
		}
	}

	disconnect() {}
}

test('sync manager store only creates one client for concurrent initialization', async () => {
	let ensureCalls = 0;
	const clients: FakeSyncManagerClient[] = [];
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => {
			ensureCalls += 1;
			return { port: 18181, alreadyRunning: ensureCalls > 1 };
		},
		createClient: () => {
			const client = new FakeSyncManagerClient();
			clients.push(client);
			return client;
		},
	});

	await Promise.all([store.getState().ensureConnected(), store.getState().ensureConnected()]);

	assert.equal(ensureCalls, 1);
	assert.equal(clients.length, 1);
	assert.equal(clients[0]?.connectCalls, 1);
	assert.equal(store.getState().connectionStatus, 'connected');
});

test('sync manager store applies sidecar events into diagnostics state', async () => {
	let clientRef: FakeSyncManagerClient | null = null;
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => ({ port: 18181, alreadyRunning: false }),
		createClient: () => {
			clientRef = new FakeSyncManagerClient();
			return clientRef;
		},
	});

	await store.getState().ensureConnected();
	await store.getState().syncLocalTargets([
		{
			profileId: 'pf_1',
			label: 'Mac 1',
			host: '127.0.0.1',
			magicSocketServerPort: 19322,
			sessionId: 1,
			pid: 101,
			totalWindows: 1,
			totalTabs: 2,
			windows: [],
		},
	]);

	const client = clientRef as unknown as FakeSyncManagerClient;
	client.emit('instances.updated', {
		instances: [
			{
				id: 'pf_1',
				host: '127.0.0.1',
				port: 19322,
				status: 'online',
				label: 'Mac 1',
				platform: 'macos',
				bound_browser_id: 123,
				bound_window_token: '93217',
				coordinate_mode: 'window_relative',
				ws_status_verified: true,
				last_probe_error: null,
				last_drop_reason: '',
				active_browser: {
					bounds: { left: 0, top: 0, width: 1280, height: 720 },
					maximized: false,
					minimized: false,
					fullscreen: false,
					tab_count: 2,
				},
			},
		],
	});
	client.emit('sync.session_updated', {
		session: {
			session_id: 'sync-1',
			master_id: 'pf_1',
			slave_ids: ['pf_2'],
			status: 'running',
		},
		metrics: {
			events_received: 3,
			events_forwarded: 2,
			events_failed: 1,
			events_dropped_invalid: 0,
			events_dropped_session_mismatch: 0,
			events_dropped_non_replayable: 0,
			events_dropped_platform_mismatch: 0,
		},
		master: null,
		slaves: [],
		reason: null,
	});
	client.emit('sync.warning', {
		code: 'probe_warning',
		scope: 'instance',
		message: 'need reprobe',
		instance_id: 'pf_1',
	});

	assert.equal(store.getState().instances['pf_1']?.status, 'online');
	assert.equal(store.getState().instances['pf_1']?.boundBrowserId, 123);
	assert.equal(store.getState().instances['pf_1']?.boundWindowToken, '93217');
	assert.equal(store.getState().instances['pf_1']?.coordinateMode, 'window_relative');
	assert.equal(store.getState().sessionPayload?.session?.sessionId, 'sync-1');
	assert.equal(store.getState().recentWarnings[0]?.message, 'need reprobe');
	assert.equal(
		client.requests.some(
			(item: { type: string; payload: unknown }) =>
				item.type === 'instances.probe' && (item.payload as { id: string }).id === 'pf_1',
		),
		true,
	);
});

test('sync manager store persists probe payload error onto instance state', async () => {
	let clientRef: FakeSyncManagerClient | null = null;
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => ({ port: 18181, alreadyRunning: false }),
		createClient: () => {
			clientRef = new FakeSyncManagerClient();
			return clientRef;
		},
	});

	await store.getState().ensureConnected();
	await store.getState().syncLocalTargets([
		{
			profileId: 'pf_1',
			label: 'Mac 1',
			host: '127.0.0.1',
			magicSocketServerPort: 19322,
			sessionId: 1,
			pid: 101,
			totalWindows: 1,
			totalTabs: 1,
			windows: [],
		},
	]);

	const client = clientRef as unknown as FakeSyncManagerClient;
	client.request = async <T>(type: string, payload: unknown) => {
		client.requests.push({ type, payload });
		if (type === 'sync.get_session') {
			return {
				session: null,
				metrics: {
					events_received: 0,
					events_forwarded: 0,
					events_failed: 0,
					events_dropped_invalid: 0,
					events_dropped_session_mismatch: 0,
					events_dropped_non_replayable: 0,
					events_dropped_platform_mismatch: 0,
				},
				master: null,
				slaves: [],
				reason: null,
			} as T;
		}
		if (type === 'instances.probe') {
			return {
				instance: {
					id: 'pf_1',
					host: '127.0.0.1',
					port: 19322,
					status: 'offline',
					ws_status_verified: false,
					last_probe_error: 'sync.get_status failed',
				},
				probe: null,
				error: 'sync.get_status failed',
			} as T;
		}
		return {} as T;
	};

	await store.getState().probeInstances(['pf_1']);

	assert.equal(store.getState().instances['pf_1']?.status, 'offline');
	assert.equal(store.getState().instances['pf_1']?.lastProbeError, 'sync.get_status failed');
});

test('sync manager store starts sync directly without forcing probe', async () => {
	let clientRef: FakeSyncManagerClient | null = null;
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => ({ port: 18181, alreadyRunning: false }),
		createClient: () => {
			clientRef = new FakeSyncManagerClient();
			return clientRef;
		},
	});

	await store.getState().ensureConnected();
	await store.getState().syncLocalTargets([
		{
			profileId: 'pf_1',
			label: 'Mac 1',
			host: '127.0.0.1',
			magicSocketServerPort: 19322,
			sessionId: 1,
			pid: 101,
			totalWindows: 1,
			totalTabs: 2,
			windows: [
				{
					windowId: 201,
					focused: true,
					tabCount: 2,
					activeTabId: 1,
					activeTabUrl: 'https://example.com',
					bounds: null,
					tabs: [],
				},
			],
		},
		{
			profileId: 'pf_2',
			label: 'Mac 2',
			host: '127.0.0.1',
			magicSocketServerPort: 19323,
			sessionId: 2,
			pid: 102,
			totalWindows: 1,
			totalTabs: 1,
			windows: [
				{
					windowId: 301,
					focused: false,
					tabCount: 1,
					activeTabId: 2,
					activeTabUrl: 'https://example.org',
					bounds: null,
					tabs: [],
				},
			],
		},
	]);
	await store.getState().startSync('pf_1', ['pf_2']);

	const client = clientRef as unknown as FakeSyncManagerClient;
	assert.equal(
		client.requests.some(
			(item) =>
				item.type === 'sync.start' &&
				(
					item.payload as {
						master_id: string;
						slave_ids: string[];
						master_browser_id?: number;
						slave_browser_ids?: Record<string, number>;
					}
				).master_id === 'pf_1' &&
				(item.payload as { master_browser_id?: number }).master_browser_id === 201 &&
				(item.payload as { slave_browser_ids?: Record<string, number> }).slave_browser_ids?.pf_2 ===
					301,
		),
		true,
	);
});

test('sync manager store surfaces stage-specific sidecar startup errors', async () => {
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => {
			throw new Error('resolve sync manager sidecar failed: binary missing');
		},
		createClient: () => new FakeSyncManagerClient(),
	});

	await assert.rejects(() => store.getState().ensureConnected(), /error/i);
	assert.equal(store.getState().connectionStatus, 'error');
	assert.equal(store.getState().lastError?.includes('sync sidecar 启动失败'), true);
	assert.equal(store.getState().lastError?.includes('binary missing'), true);
});

test('sync manager store rejects startSync when target window binding is unavailable', async () => {
	let clientRef: FakeSyncManagerClient | null = null;
	const store = createSyncManagerStore({
		ensureSidecarStarted: async () => ({ port: 18181, alreadyRunning: false }),
		createClient: () => {
			clientRef = new FakeSyncManagerClient();
			return clientRef;
		},
	});

	await store.getState().ensureConnected();
	await store.getState().syncLocalTargets([
		{
			profileId: 'pf_1',
			label: 'Mac 1',
			host: '127.0.0.1',
			magicSocketServerPort: 19322,
			sessionId: 1,
			pid: 101,
			totalWindows: 0,
			totalTabs: 0,
			windows: [],
		},
		{
			profileId: 'pf_2',
			label: 'Mac 2',
			host: '127.0.0.1',
			magicSocketServerPort: 19323,
			sessionId: 2,
			pid: 102,
			totalWindows: 1,
			totalTabs: 1,
			windows: [
				{
					windowId: 301,
					focused: false,
					tabCount: 1,
					activeTabId: 2,
					activeTabUrl: 'https://example.org',
					bounds: null,
					tabs: [],
				},
			],
		},
	]);

	await assert.rejects(
		() => store.getState().startSync('pf_1', ['pf_2']),
		/主控环境没有可绑定的浏览器窗口/,
	);

	const client = clientRef as unknown as FakeSyncManagerClient;
	assert.equal(
		client.requests.some((item) => item.type === 'sync.start'),
		false,
	);
});
