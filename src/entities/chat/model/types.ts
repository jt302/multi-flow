export type ChatSession = {
	id: string;
	title: string | null;
	profileId: string | null;
	aiConfigId: string | null;
	systemPrompt: string | null;
	toolCategories: string[] | null;
	profileIds: string[] | null;
	activeProfileId: string | null;
	createdAt: number;
	updatedAt: number;
};

export type ChatMessageRecord = {
	id: string;
	sessionId: string;
	role: 'user' | 'assistant' | 'tool' | 'system';
	contentText: string | null;
	toolCallsJson: string | null;
	toolCallId: string | null;
	toolName: string | null;
	toolArgsJson: string | null;
	toolResult: string | null;
	toolStatus: 'completed' | 'failed' | null;
	toolDurationMs: number | null;
	imageBase64: string | null;
	isActive: boolean;
	createdAt: number;
	sortOrder: number;
	thinkingText: string | null;
	thinkingTokens: number | null;
	imageRef: string | null;
	promptTokens: number | null;
	completionTokens: number | null;
};

export type CreateChatSessionRequest = {
	title?: string;
	profileId?: string;
	aiConfigId?: string;
	systemPrompt?: string;
	toolCategories?: string[];
	profileIds?: string[];
};

export type UpdateChatSessionRequest = {
	title?: string;
	profileId?: string | null;
	aiConfigId?: string | null;
	systemPrompt?: string | null;
	toolCategories?: string[] | null;
	profileIds?: string[] | null;
	activeProfileId?: string | null;
};

export type ChatMessageEvent = {
	sessionId: string;
	message: ChatMessageRecord;
};

export type ChatPhaseEvent = {
	sessionId: string;
	phase: 'thinking' | 'tool_calling' | 'done' | 'error';
	round: number;
	maxRounds: number;
	toolName?: string;
	error?: string;
	elapsedMs: number;
	promptTokens?: number;
	completionTokens?: number;
	contextUsed?: number;
	contextLimit?: number;
};

export type ChatSessionEvent = {
	sessionId: string;
	session: ChatSession;
};

export type ProfileEnvironmentContext = {
	profileId: string;
	profileName: string;
	isActive: boolean;
	running: boolean;
	platform: string | null;
	browserVersion: string | null;
	userAgent: string | null;
	language: string | null;
	timezone: string | null;
	viewport: string | null;
	deviceScaleFactor: number | null;
	cpuCores: number | null;
	ramGb: number | null;
	geolocation: string | null;
	proxyProtocol: string | null;
	proxyLocation: string | null;
	proxyExitIp: string | null;
};
