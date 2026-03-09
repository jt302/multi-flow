import type { ProfileProxyBindingMap, ProfileItem } from '@/entities/profile/model/types';
import type {
	BatchProxyActionResponse,
	CreateProxyPayload,
	ImportProxiesPayload,
	ProxyItem,
	ProxyProtocol,
	UpdateProxyPayload,
} from '@/entities/proxy/model/types';

export type ProxyPageProps = {
	proxies: ProxyItem[];
	profiles: ProfileItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	onCreateProxy: (payload: CreateProxyPayload) => Promise<void>;
	onUpdateProxy: (proxyId: string, payload: UpdateProxyPayload) => Promise<void>;
	onDeleteProxy: (proxyId: string) => Promise<void>;
	onBatchDeleteProxies: (proxyIds: string[]) => Promise<BatchProxyActionResponse>;
	onBatchUpdateProxies: (
		proxyIds: string[],
		payload: UpdateProxyPayload,
	) => Promise<BatchProxyActionResponse>;
	onRestoreProxy: (proxyId: string) => Promise<void>;
	onImportProxies: (payload: ImportProxiesPayload) => Promise<BatchProxyActionResponse>;
	onCheckProxy: (
		proxyId: string,
		options?: { silent?: boolean },
	) => Promise<void>;
	onBatchCheckProxies: (proxyIds: string[]) => Promise<BatchProxyActionResponse>;
	onBindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	onUnbindProfileProxy: (profileId: string) => Promise<void>;
	onRefreshProxies: () => Promise<void>;
};

export type {
	BatchProxyActionResponse,
	CreateProxyPayload,
	ImportProxiesPayload,
	ProxyProtocol,
	UpdateProxyPayload,
};
