export type ProxyLifecycle = 'active' | 'deleted';
export type ProxyProtocol = 'http' | 'https' | 'socks5' | 'ssh';

export type ProxyItem = {
	id: string;
	name: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	username: string;
	password: string;
	country: string;
	region: string;
	city: string;
	provider: string;
	note: string;
	lastStatus: string;
	lastCheckedAt: number | null;
	lifecycle: ProxyLifecycle;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
};

export type CreateProxyPayload = {
	name: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	username?: string;
	password?: string;
	country?: string;
	region?: string;
	city?: string;
	provider?: string;
	note?: string;
};

export type UpdateProxyPayload = {
	name?: string;
	protocol?: ProxyProtocol;
	username?: string;
	password?: string;
	country?: string;
	region?: string;
	city?: string;
	provider?: string;
	note?: string;
};

export type BatchProxyActionItem = {
	proxyId: string;
	ok: boolean;
	message: string;
};

export type BatchProxyActionResponse = {
	total: number;
	successCount: number;
	failedCount: number;
	items: BatchProxyActionItem[];
};

export type ImportProxiesPayload = {
	protocol: ProxyProtocol;
	lines: string[];
};
