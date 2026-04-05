import type {
	LocalSyncTargetItem,
	SyncManagerInstanceInfo,
	SyncSessionPayload,
	SyncTargetItem,
} from './types';

function isProbeReady(instance?: SyncManagerInstanceInfo | null) {
	return instance?.status === 'online';
}

export function buildSyncTargetItems(
	localTargets: LocalSyncTargetItem[],
	instances: Record<string, SyncManagerInstanceInfo>,
	sessionPayload: SyncSessionPayload | null,
): SyncTargetItem[] {
	const session = sessionPayload?.session;
	const slaveIds = new Set(session?.slaveIds ?? []);
	return localTargets.map((target) => {
		const instance = instances[target.profileId];
		return {
			...target,
			syncRole:
				session?.masterId === target.profileId
					? 'master'
					: slaveIds.has(target.profileId)
						? 'slave'
						: 'none',
			instanceStatus: instance?.status ?? 'unknown',
			platform: instance?.platform ?? null,
			wsStatusVerified: instance?.wsStatusVerified ?? false,
			lastProbeError: instance?.lastProbeError ?? null,
			lastDropReason: instance?.lastDropReason ?? null,
			boundBrowserId: instance?.boundBrowserId ?? null,
			boundWindowToken: instance?.boundWindowToken ?? null,
			coordinateMode: instance?.coordinateMode ?? null,
			activeBrowser: instance?.activeBrowser ?? null,
			isProbeReady: isProbeReady(instance),
		};
	});
}
