import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	CreateProxyPayload,
	ProxyItem,
	ProxyLifecycle,
	ProxyProtocol,
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
	lastStatus: string | null;
	lastCheckedAt: number | null;
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
		lastStatus: item.lastStatus ?? '',
		lastCheckedAt: item.lastCheckedAt,
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
			country: payload.country?.trim() ? payload.country : null,
			region: payload.region?.trim() ? payload.region : null,
			city: payload.city?.trim() ? payload.city : null,
			provider: payload.provider?.trim() ? payload.provider : null,
			note: payload.note?.trim() ? payload.note : null,
		},
	});
}

export async function deleteProxy(proxyId: string): Promise<void> {
	await tauriInvoke('delete_proxy', { proxyId });
}

export async function restoreProxy(proxyId: string): Promise<void> {
	await tauriInvoke('restore_proxy', { proxyId });
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
