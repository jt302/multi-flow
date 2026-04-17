export type McpTransportType = 'stdio' | 'sse' | 'http';
export type McpAuthType = 'none' | 'bearer' | 'oauth';
export type McpServerStatus = 'idle' | 'starting' | 'running' | 'error';

export type McpServer = {
	id: string;
	name: string;
	transport: McpTransportType;
	command: string | null;
	argsJson: string;
	envJson: string;
	url: string | null;
	headersJson: string;
	authType: McpAuthType;
	bearerToken: string | null;
	oauthConfigJson: string | null;
	oauthTokensJson: string | null;
	enabled: boolean;
	lastStatus: McpServerStatus;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
};

export type McpTool = {
	serverId: string;
	serverName: string;
	name: string;
	originalName: string;
	description: string | null;
	inputSchema: unknown;
};

export type CreateMcpServerRequest = {
	name: string;
	transport: McpTransportType;
	command?: string | null;
	argsJson?: string;
	envJson?: string;
	url?: string | null;
	headersJson?: string;
	authType?: McpAuthType;
	bearerToken?: string | null;
	oauthConfigJson?: string | null;
};

export type UpdateMcpServerRequest = {
	name?: string;
	transport?: McpTransportType;
	command?: string | null;
	argsJson?: string;
	envJson?: string;
	url?: string | null;
	headersJson?: string;
	authType?: McpAuthType;
	bearerToken?: string | null;
	oauthConfigJson?: string | null;
};

export type OAuthConfig = {
	clientId: string;
	clientSecret?: string | null;
	authUrl: string;
	tokenUrl: string;
	scopes: string[];
};
