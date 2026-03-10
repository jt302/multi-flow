import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	BatchProxyActionResponse,
	CreateProxyPayload,
	ImportProxiesPayload,
	ProxyItem,
	ProxyLifecycle,
	ProxyProtocol,
	ProxyTargetSiteCheck,
	ProxyValueSource,
	UpdateProxyPayload,
} from '@/entities/proxy/model/types';
import type { ProfileProxyBindingMap } from '@/entities/profile/model/types';

type BackendProxy = {
	id: string;
	name: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	username: string | null;
	password: string | null;
	country: string | null;
	region: string | null;
	city: string | null;
	provider: string | null;
	note: string | null;
	checkStatus: string | null;
	checkMessage: string | null;
	lastCheckedAt: number | null;
	exitIp: string | null;
	latitude: number | null;
	longitude: number | null;
	geoAccuracyMeters: number | null;
	suggestedLanguage: string | null;
	suggestedTimezone: string | null;
	languageSource: ProxyValueSource | null;
	customLanguage: string | null;
	effectiveLanguage: string | null;
	timezoneSource: ProxyValueSource | null;
	customTimezone: string | null;
	effectiveTimezone: string | null;
	targetSiteChecks: ProxyTargetSiteCheck[] | null;
	expiresAt: number | null;
	lifecycle: ProxyLifecycle;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
};

type ListProxiesResponse = {
	items: BackendProxy[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

function mapBackendProxy(item: BackendProxy): ProxyItem {
	return {
		id: item.id,
		name: item.name,
		protocol: item.protocol,
		host: item.host,
		port: item.port,
		username: item.username ?? '',
		password: item.password ?? '',
		country: item.country ?? '',
		region: item.region ?? '',
		city: item.city ?? '',
		provider: item.provider ?? '',
		note: item.note ?? '',
		checkStatus: item.checkStatus ?? 'unknown',
		checkMessage: item.checkMessage ?? '',
		lastCheckedAt: item.lastCheckedAt,
		exitIp: item.exitIp ?? '',
		latitude: item.latitude,
		longitude: item.longitude,
		geoAccuracyMeters: item.geoAccuracyMeters,
		suggestedLanguage: item.suggestedLanguage ?? '',
		suggestedTimezone: item.suggestedTimezone ?? '',
		languageSource: item.languageSource ?? 'ip',
		customLanguage: item.customLanguage ?? '',
		effectiveLanguage: item.effectiveLanguage ?? '',
		timezoneSource: item.timezoneSource ?? 'ip',
		customTimezone: item.customTimezone ?? '',
		effectiveTimezone: item.effectiveTimezone ?? '',
		targetSiteChecks: item.targetSiteChecks ?? [],
		expiresAt: item.expiresAt,
		lifecycle: item.lifecycle,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
		deletedAt: item.deletedAt,
	};
}

export async function listProxies(): Promise<ProxyItem[]> {
	const result = await tauriInvoke<ListProxiesResponse>('list_proxies', {
		includeDeleted: true,
		page: 1,
		pageSize: 200,
	});
	return result.items.map(mapBackendProxy);
}

export async function createProxy(payload: CreateProxyPayload): Promise<void> {
	await tauriInvoke('create_proxy', {
		payload: {
			name: payload.name,
			protocol: payload.protocol,
			host: payload.host,
			port: payload.port,
			username: payload.username?.trim() ? payload.username : null,
			password: payload.password?.trim() ? payload.password : null,
			provider: payload.provider?.trim() ? payload.provider : null,
			note: payload.note?.trim() ? payload.note : null,
			expiresAt: payload.expiresAt ?? null,
			languageSource: payload.languageSource ?? 'ip',
			customLanguage: payload.customLanguage?.trim() ? payload.customLanguage : null,
			timezoneSource: payload.timezoneSource ?? 'ip',
			customTimezone: payload.customTimezone?.trim() ? payload.customTimezone : null,
		},
	});
}

export async function updateProxy(proxyId: string, payload: UpdateProxyPayload): Promise<void> {
	await tauriInvoke('update_proxy', {
		proxyId,
		payload: {
			name: payload.name,
			protocol: payload.protocol,
			username: payload.username,
			password: payload.password,
			provider: payload.provider,
			note: payload.note,
			expiresAt: payload.expiresAt ?? null,
			languageSource: payload.languageSource,
			customLanguage: payload.customLanguage?.trim() ? payload.customLanguage : null,
			timezoneSource: payload.timezoneSource,
			customTimezone: payload.customTimezone?.trim() ? payload.customTimezone : null,
		},
	});
}

export async function deleteProxy(proxyId: string): Promise<void> {
	await tauriInvoke('delete_proxy', { proxyId });
}

type BackendBatchProxyActionResponse = {
	total: number;
	successCount: number;
	failedCount: number;
	items: Array<{
		proxyId: string;
		ok: boolean;
		message: string;
	}>;
};

function mapBatchProxyActionResponse(
	response: BackendBatchProxyActionResponse,
): BatchProxyActionResponse {
	return {
		total: response.total,
		successCount: response.successCount,
		failedCount: response.failedCount,
		items: response.items,
	};
}

export async function batchUpdateProxies(
	proxyIds: string[],
	payload: UpdateProxyPayload,
): Promise<BatchProxyActionResponse> {
	const response = await tauriInvoke<BackendBatchProxyActionResponse>(
		'batch_update_proxies',
		{
			payload: {
				proxyIds,
				payload,
			},
		},
	);
	return mapBatchProxyActionResponse(response);
}

export async function batchDeleteProxies(
	proxyIds: string[],
): Promise<BatchProxyActionResponse> {
	const response = await tauriInvoke<BackendBatchProxyActionResponse>(
		'batch_delete_proxies',
		{
			payload: { proxyIds },
		},
	);
	return mapBatchProxyActionResponse(response);
}


export async function importProxies(payload: ImportProxiesPayload): Promise<BatchProxyActionResponse> {
	const response = await tauriInvoke<BackendBatchProxyActionResponse>('import_proxies', {
		payload: {
			protocol: payload.protocol,
			lines: payload.lines,
		},
	});
	return mapBatchProxyActionResponse(response);
}

export async function checkProxy(proxyId: string): Promise<void> {
	await tauriInvoke('check_proxy', { proxyId });
}

export async function batchCheckProxies(proxyIds: string[]): Promise<BatchProxyActionResponse> {
	const response = await tauriInvoke<BackendBatchProxyActionResponse>('batch_check_proxies', {
		payload: { proxyIds },
	});
	return mapBatchProxyActionResponse(response);
}

export async function restoreProxy(proxyId: string): Promise<void> {
	await tauriInvoke('restore_proxy', { proxyId });
}

export async function purgeProxy(proxyId: string): Promise<void> {
	await tauriInvoke('purge_proxy', { proxyId });
}

export async function bindProfileProxy(profileId: string, proxyId: string): Promise<void> {
	await tauriInvoke('bind_profile_proxy', { profileId, proxyId });
}

export async function unbindProfileProxy(profileId: string): Promise<void> {
	await tauriInvoke('unbind_profile_proxy', { profileId });
}

export async function listProfileProxyBindings(profileIds: string[]): Promise<ProfileProxyBindingMap> {
	const entries = await Promise.all(
		profileIds.map(async (profileId) => {
			try {
				const proxy = await tauriInvoke<BackendProxy | null>('get_profile_proxy', { profileId });
				return [profileId, proxy?.id ?? ''] as const;
			} catch {
				return [profileId, ''] as const;
			}
		}),
	);

	const mapping: ProfileProxyBindingMap = {};
	for (const [profileId, proxyId] of entries) {
		if (proxyId) {
			mapping[profileId] = proxyId;
		}
	}
	return mapping;
}
