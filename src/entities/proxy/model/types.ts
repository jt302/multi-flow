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
	checkStatus: string;
	checkMessage: string;
	lastCheckedAt: number | null;
	exitIp: string;
	latitude: number | null;
	longitude: number | null;
	geoAccuracyMeters: number | null;
	suggestedLanguage: string;
	suggestedTimezone: string;
	expiresAt: number | null;
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
	provider?: string;
	note?: string;
	expiresAt?: number | null;
};

export type UpdateProxyPayload = {
	name?: string;
	protocol?: ProxyProtocol;
	username?: string;
	password?: string;
	provider?: string;
	note?: string;
	expiresAt?: number | null;
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
