import i18next from 'i18next';

import type {
	LocalSyncTargetItem,
	SyncManagerInstanceInfo,
	SyncSessionPayload,
	SyncWarningItem,
} from '../entities/window-session/model/types.ts';

export const EMPTY_SYNC_METRICS = {
	eventsReceived: 0,
	eventsForwarded: 0,
	eventsFailed: 0,
	eventsDroppedInvalid: 0,
	eventsDroppedSessionMismatch: 0,
	eventsDroppedNonReplayable: 0,
	eventsDroppedPlatformMismatch: 0,
} as const;

export function normalizeNullableString(value: unknown) {
	return typeof value === 'string' ? value : null;
}

export function normalizeBoolean(value: unknown) {
	return value === true;
}

export function normalizeNumber(value: unknown) {
	return typeof value === 'number' ? value : null;
}

export function normalizeActiveBrowser(value: unknown) {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const record = value as Record<string, unknown>;
	const bounds = record.bounds as Record<string, unknown> | undefined;
	return {
		bounds:
			bounds &&
			typeof bounds.left === 'number' &&
			typeof bounds.top === 'number' &&
			typeof bounds.width === 'number' &&
			typeof bounds.height === 'number'
				? {
						left: bounds.left,
						top: bounds.top,
						width: bounds.width,
						height: bounds.height,
					}
				: null,
		maximized: typeof record.maximized === 'boolean' ? record.maximized : null,
		minimized: typeof record.minimized === 'boolean' ? record.minimized : null,
		fullscreen: typeof record.fullscreen === 'boolean' ? record.fullscreen : null,
		tabCount: typeof record.tab_count === 'number' ? record.tab_count : null,
	};
}

export function normalizeInstance(value: unknown): SyncManagerInstanceInfo | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.id !== 'string' || typeof record.host !== 'string' || typeof record.port !== 'number') {
		return null;
	}
	return {
		id: record.id,
		host: record.host,
		port: record.port,
		status:
			record.status === 'online' ||
			record.status === 'offline' ||
			record.status === 'unhealthy'
				? record.status
				: 'unknown',
		label: normalizeNullableString(record.label),
		platform: normalizeNullableString(record.platform),
		lastDropReason: normalizeNullableString(record.last_drop_reason),
		activeBrowser: normalizeActiveBrowser(record.active_browser),
		supportsNativeReplay:
			typeof record.supports_native_replay === 'boolean'
				? record.supports_native_replay
				: null,
		captureBackend: normalizeNullableString(record.capture_backend),
		injectBackend: normalizeNullableString(record.inject_backend),
		magicSocketServerPort:
			normalizeNumber(record.magic_socket_server_port) ?? normalizeNumber(record.port),
		boundBrowserId: normalizeNumber(record.bound_browser_id),
		boundWindowToken: normalizeNullableString(record.bound_window_token),
		coordinateMode: normalizeNullableString(record.coordinate_mode),
		wsStatusVerified: normalizeBoolean(record.ws_status_verified),
		lastProbeError: normalizeNullableString(record.last_probe_error),
	};
}

export function normalizeInstancesPayload(payload: unknown) {
	const record = payload as { instances?: unknown[] } | null;
	const next: Record<string, SyncManagerInstanceInfo> = {};
	for (const item of record?.instances ?? []) {
		const normalized = normalizeInstance(item);
		if (normalized) {
			next[normalized.id] = normalized;
		}
	}
	return next;
}

export function normalizeMetrics(value: unknown) {
	const record = (value as Record<string, unknown> | null) ?? {};
	return {
		eventsReceived: normalizeNumber(record.events_received) ?? 0,
		eventsForwarded: normalizeNumber(record.events_forwarded) ?? 0,
		eventsFailed: normalizeNumber(record.events_failed) ?? 0,
		eventsDroppedInvalid: normalizeNumber(record.events_dropped_invalid) ?? 0,
		eventsDroppedSessionMismatch:
			normalizeNumber(record.events_dropped_session_mismatch) ?? 0,
		eventsDroppedNonReplayable:
			normalizeNumber(record.events_dropped_non_replayable) ?? 0,
		eventsDroppedPlatformMismatch:
			normalizeNumber(record.events_dropped_platform_mismatch) ?? 0,
	};
}

export function normalizeSessionPayload(value: unknown): SyncSessionPayload {
	const record = (value as Record<string, unknown> | null) ?? {};
	const session = record.session as Record<string, unknown> | null | undefined;
	return {
		session:
			session &&
			typeof session.session_id === 'string' &&
			typeof session.master_id === 'string' &&
			Array.isArray(session.slave_ids) &&
			typeof session.status === 'string'
				? {
						sessionId: session.session_id,
						masterId: session.master_id,
						slaveIds: session.slave_ids.filter((item): item is string => typeof item === 'string'),
						status:
							session.status === 'starting' ||
							session.status === 'running' ||
							session.status === 'stopping' ||
							session.status === 'stopped'
								? session.status
								: 'stopped',
					}
				: null,
		metrics: normalizeMetrics(record.metrics),
		master: normalizeInstance(record.master),
		slaves: Array.isArray(record.slaves)
			? record.slaves
					.map((item) => normalizeInstance(item))
					.filter((item): item is SyncManagerInstanceInfo => Boolean(item))
			: [],
		reason: normalizeNullableString(record.reason),
	};
}

export function normalizeWarning(value: unknown): SyncWarningItem | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.code !== 'string' || typeof record.scope !== 'string' || typeof record.message !== 'string') {
		return null;
	}
	return {
		code: record.code,
		scope: record.scope,
		message: record.message,
		instanceId: normalizeNullableString(record.instance_id),
		eventFamily: normalizeNullableString(record.event_family),
		eventType: normalizeNullableString(record.event_type),
	};
}

export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function stageError(stage: string, error: unknown) {
	const message = `${stage}：${errorMessage(error)}`;
	console.error('[sync-manager]', message, error);
	return new Error(message);
}

function pickBoundWindowId(target: LocalSyncTargetItem | undefined) {
	const focusedWindow = target?.windows.find((item) => item.focused);
	return focusedWindow?.windowId ?? target?.windows[0]?.windowId ?? null;
}

export function validateSyncTargetsForStart(
	localTargets: Map<string, LocalSyncTargetItem>,
	masterId: string,
	slaveIds: string[],
) {
	const masterTarget = localTargets.get(masterId);
	if (!masterTarget) {
		throw new Error(i18next.t('window:sync.masterNotExist', { id: masterId }));
	}
	if (masterTarget.magicSocketServerPort === null) {
		throw new Error(i18next.t('window:sync.masterNotConnected', { id: masterId }));
	}
	const masterBrowserId = pickBoundWindowId(masterTarget);
	if (typeof masterBrowserId !== 'number') {
		throw new Error(i18next.t('window:sync.masterNoWindows', { id: masterId }));
	}

	const slaveBrowserIds = Object.fromEntries(
		slaveIds.map((slaveId) => {
			const slaveTarget = localTargets.get(slaveId);
			if (!slaveTarget) {
				throw new Error(i18next.t('window:sync.slaveNotExist', { id: slaveId }));
			}
			if (slaveTarget.magicSocketServerPort === null) {
				throw new Error(i18next.t('window:sync.slaveNotConnected', { id: slaveId }));
			}
			const browserId = pickBoundWindowId(slaveTarget);
			if (typeof browserId !== 'number') {
				throw new Error(i18next.t('window:sync.slaveNoWindows', { id: slaveId }));
			}
			return [slaveId, browserId] as const;
		}),
	);

	return {
		masterBrowserId,
		slaveBrowserIds,
	};
}
