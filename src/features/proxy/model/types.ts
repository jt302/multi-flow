import type { ProfileProxyBindingMap, ProfileItem } from '@/entities/profile/model/types';
import type { CreateProxyPayload, ProxyItem, ProxyProtocol } from '@/entities/proxy/model/types';

export type ProxyPageProps = {
	proxies: ProxyItem[];
	profiles: ProfileItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	onCreateProxy: (payload: CreateProxyPayload) => Promise<void>;
	onDeleteProxy: (proxyId: string) => Promise<void>;
	onRestoreProxy: (proxyId: string) => Promise<void>;
	onBindProfileProxy: (profileId: string, proxyId: string) => Promise<void>;
	onUnbindProfileProxy: (profileId: string) => Promise<void>;
	onRefreshProxies: () => Promise<void>;
};

export type { CreateProxyPayload, ProxyProtocol };
