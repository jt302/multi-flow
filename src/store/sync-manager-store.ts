import i18next from 'i18next';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { tauriInvoke } from '../shared/api/tauri-invoke.ts';
import type {
	EnsureSyncSidecarStartedResponse,
	LocalSyncTargetItem,
	SyncManagerConnectionStatus,
	SyncManagerInstanceInfo,
	SyncSessionPayload,
	SyncWarningItem,
} from '../entities/window-session/model/types.ts';
import {
	MultiFlowSyncManagerClient,
	type SyncManagerClient,
} from './sync-manager-client.ts';
import {
	EMPTY_SYNC_METRICS,
	normalizeInstance,
	normalizeInstancesPayload,
	normalizeSessionPayload,
	normalizeWarning,
	stageError,
	validateSyncTargetsForStart,
} from './sync-manager-normalizers.ts';

type SyncManagerStoreState = {
	connectionStatus: SyncManagerConnectionStatus;
	sidecarPort: number | null;
	instances: Record<string, SyncManagerInstanceInfo>;
	sessionPayload: SyncSessionPayload | null;
	recentWarnings: SyncWarningItem[];
	lastError: string | null;
	ensureConnected: () => Promise<void>;
	syncLocalTargets: (targets: LocalSyncTargetItem[]) => Promise<void>;
	probeInstances: (instanceIds: string[]) => Promise<void>;
	startSync: (masterId: string, slaveIds: string[]) => Promise<SyncSessionPayload>;
	stopSync: () => Promise<void>;
	restartSync: () => Promise<SyncSessionPayload | null>;
	shutdown: () => Promise<void>;
};

type SyncManagerStoreDeps = {
	ensureSidecarStarted?: () => Promise<EnsureSyncSidecarStartedResponse>;
	createClient?: (url: string) => SyncManagerClient;
	setTimeoutFn?: typeof setTimeout;
	clearTimeoutFn?: typeof clearTimeout;
	reconnectDelayMs?: number;
};


async function defaultEnsureSidecarStarted() {
	return tauriInvoke<EnsureSyncSidecarStartedResponse>('ensure_sync_sidecar_started');
}

type CreateStoreOptions = SyncManagerStoreDeps;

export function createSyncManagerStore(options: CreateStoreOptions = {}) {
	const ensureSidecarStarted = options.ensureSidecarStarted ?? defaultEnsureSidecarStarted;
	const createClient =
		options.createClient ?? ((url: string) => new MultiFlowSyncManagerClient(url));
	const reconnectDelayMs = options.reconnectDelayMs ?? 1200;
	const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
	const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
	let client: SyncManagerClient | null = null;
	let initPromise: Promise<void> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let localTargets = new Map<string, LocalSyncTargetItem>();
	let listenersCleanup: Array<() => void> = [];

	const cleanupClient = () => {
		for (const dispose of listenersCleanup) {
			dispose();
		}
		listenersCleanup = [];
		client?.disconnect();
		client = null;
	};

	return createStore<SyncManagerStoreState>()((set, get) => {
		const scheduleReconnect = () => {
			if (reconnectTimer) {
				return;
			}
			reconnectTimer = setTimeoutFn(() => {
				reconnectTimer = null;
				void get().ensureConnected();
			}, reconnectDelayMs);
		};

		const connect = async () => {
			if (get().connectionStatus === 'connected') {
				return;
			}
			if (initPromise) {
				return initPromise;
			}

			set({ connectionStatus: 'starting', lastError: null });
			initPromise = (async () => {
				try {
					const ready = await ensureSidecarStarted().catch((error) => {
						throw stageError(i18next.t('window:sync.sidecarStartFailed'), error);
					});
					set({ sidecarPort: ready.port });
					client = createClient(`ws://127.0.0.1:${ready.port}/`);
					listenersCleanup = [
						client.on('instances.updated', (payload) => {
							set({ instances: normalizeInstancesPayload(payload) });
						}),
						client.on('sync.session_updated', (payload) => {
							set({ sessionPayload: normalizeSessionPayload(payload) });
						}),
						client.on('sync.warning', (payload) => {
							const warning = normalizeWarning(payload);
							if (!warning) {
								return;
							}
							set((state) => ({
								recentWarnings: [warning, ...state.recentWarnings].slice(0, 12),
							}));
							if (warning.instanceId) {
								void get().probeInstances([warning.instanceId]);
							}
						}),
						client.on('client.close', (payload) => {
							const closedByClient =
								typeof payload === 'object' &&
								payload !== null &&
								'closedByClient' in payload &&
								(payload as { closedByClient?: boolean }).closedByClient === true;
							set({
								connectionStatus: 'disconnected',
							});
							cleanupClient();
							initPromise = null;
							if (!closedByClient) {
								scheduleReconnect();
							}
						}),
					];
					await client.connect().catch((error) => {
						throw stageError(
							i18next.t('window:sync.sidecarConnectFailed', { port: ready.port }),
							error,
						);
					});
					const sessionPayload = normalizeSessionPayload(
						await client.request('sync.get_session', {}).catch((error) => {
							throw stageError(i18next.t('window:sync.sidecarQueryFailed'), error);
						}),
					);
					const registeredTargets = [...localTargets.values()].filter(
						(item) => item.magicSocketServerPort !== null,
					);
					if (registeredTargets.length > 0) {
						await Promise.all(
							registeredTargets.map((item) =>
								client!.request('instances.upsert', {
									id: item.profileId,
									host: item.host,
									port: item.magicSocketServerPort,
									status: 'unknown',
									label: item.label,
								}),
							),
						).catch((error) => {
							throw stageError(i18next.t('window:sync.sidecarRegisterFailed'), error);
						});
					}
					set({
						connectionStatus: 'connected',
						sessionPayload,
						lastError: null,
					});
				} catch (error) {
					cleanupClient();
					set({
						connectionStatus: 'error',
						lastError: error instanceof Error ? error.message : String(error),
					});
					throw error;
				} finally {
					initPromise = null;
				}
			})();

			return initPromise;
		};

		return {
			connectionStatus: 'idle',
			sidecarPort: null,
			instances: {},
			sessionPayload: null,
			recentWarnings: [],
			lastError: null,
			ensureConnected: connect,
			syncLocalTargets: async (targets) => {
				await get().ensureConnected();
				if (!client) {
					throw new Error(i18next.t('window:sync.clientUnavailable'));
				}

				const previousIds = new Set(localTargets.keys());
				const nextIds = new Set(targets.map((item) => item.profileId));
				localTargets = new Map(targets.map((item) => [item.profileId, item]));

				await Promise.all(
					targets
						.filter((item) => item.magicSocketServerPort !== null)
						.map((item) =>
						client!.request('instances.upsert', {
							id: item.profileId,
							host: item.host,
							port: item.magicSocketServerPort,
							status: 'unknown',
							label: item.label,
						}),
					),
				);
				await Promise.all(
					[...previousIds]
						.filter((id) => !nextIds.has(id))
						.map((id) => client!.request('instances.remove', { id })),
				);

				const probeIds = targets
					.map((item) => item.profileId)
					.filter((profileId) => {
						if (!previousIds.has(profileId)) {
							return true;
						}
						const instance = get().instances[profileId];
						return !instance || instance.status === 'unknown';
					});
				if (probeIds.length > 0) {
					await get().probeInstances(probeIds);
				}
			},
			probeInstances: async (instanceIds) => {
				await get().ensureConnected();
				if (!client) {
					throw new Error(i18next.t('window:sync.clientUnavailable'));
				}
				const ids = [...new Set(instanceIds.filter(Boolean))];
				await Promise.all(
					ids.map(async (id) => {
						const payload = (await client!.request('instances.probe', { id })) as {
							instance?: unknown;
							error?: string | null;
						};
						const normalized = normalizeInstance(payload.instance);
						if (normalized) {
							set((state) => ({
								instances: {
									...state.instances,
									[id]: normalized,
								},
							}));
						}
						if (typeof payload.error === 'string' && payload.error.trim()) {
							set((state) => ({
								instances: {
									...state.instances,
									[id]: {
										...(state.instances[id] ?? {
											id,
											host: localTargets.get(id)?.host ?? '127.0.0.1',
											port: localTargets.get(id)?.magicSocketServerPort ?? 0,
											status: 'unknown',
											wsStatusVerified: false,
										}),
										lastProbeError: payload.error,
									},
								},
							}));
						}
					}),
				);
			},
			startSync: async (masterId, slaveIds) => {
				await get().ensureConnected();
				if (!client) {
					throw new Error(i18next.t('window:sync.clientUnavailable'));
				}
				const { masterBrowserId, slaveBrowserIds } = validateSyncTargetsForStart(
					localTargets,
					masterId,
					slaveIds,
				);
				const sessionPayload = normalizeSessionPayload(
					await client
						.request('sync.start', {
							master_id: masterId,
							slave_ids: slaveIds,
							master_browser_id: masterBrowserId,
							slave_browser_ids: slaveBrowserIds,
						})
						.catch((error) => {
							throw stageError(i18next.t('window:sync.syncStartFailed'), error);
						}),
				);
				set({ sessionPayload });
				return sessionPayload;
			},
			stopSync: async () => {
				await get().ensureConnected();
				if (!client) {
					throw new Error(i18next.t('window:sync.clientUnavailable'));
				}
				await client.request('sync.stop', {}).catch((error) => {
					throw stageError(i18next.t('window:sync.syncStopFailed'), error);
				});
				set({
					sessionPayload: {
						session: null,
						metrics: { ...EMPTY_SYNC_METRICS },
						master: null,
						slaves: [],
						reason: null,
					},
				});
			},
			restartSync: async () => {
				const currentSession = get().sessionPayload?.session;
				if (!currentSession) {
					return null;
				}
				await get().stopSync();
				return get().startSync(currentSession.masterId, currentSession.slaveIds);
			},
			shutdown: async () => {
				if (!client) {
					return;
				}
				await client.request('sync.shutdown', {});
				if (reconnectTimer) {
					clearTimeoutFn(reconnectTimer);
					reconnectTimer = null;
				}
				cleanupClient();
				set({
					connectionStatus: 'idle',
					sidecarPort: null,
					instances: {},
					sessionPayload: null,
					recentWarnings: [],
					lastError: null,
				});
			},
		};
	});
}

const GLOBAL_SYNC_MANAGER_STORE_KEY = '__multiFlowSyncManagerStore__';

type SyncManagerGlobalRegistry = typeof globalThis & {
	[GLOBAL_SYNC_MANAGER_STORE_KEY]?: ReturnType<typeof createSyncManagerStore>;
};

function getOrCreateSyncManagerStore() {
	const registry = globalThis as SyncManagerGlobalRegistry;
	if (!registry[GLOBAL_SYNC_MANAGER_STORE_KEY]) {
		registry[GLOBAL_SYNC_MANAGER_STORE_KEY] = createSyncManagerStore();
	}
	return registry[GLOBAL_SYNC_MANAGER_STORE_KEY];
}

export const syncManagerStore = getOrCreateSyncManagerStore();

export function useSyncManagerStore<T>(selector: (state: SyncManagerStoreState) => T) {
	return useStore(syncManagerStore, selector);
}
