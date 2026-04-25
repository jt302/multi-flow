export type ChatSession = {
	id: string;
	title: string | null;
	profileId: string | null;
	aiConfigId: string | null;
	systemPrompt: string | null;
	toolCategories: string[] | null;
	profileIds: string[] | null;
	activeProfileId: string | null;
	enabledSkillSlugs: string[] | null;
	disabledMcpServerIds: string[];
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
	// 本地前端字段，不从后端序列化
	status?: 'streaming' | 'complete';
	streamingToolNames?: string[];
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
	enabledSkillSlugs?: string[] | null;
	disabledMcpServerIds?: string[] | null;
};

export type ChatMessageEvent = {
	sessionId: string;
	message: ChatMessageRecord;
};

export type ChatMessageDeltaEvent = {
	sessionId: string;
	messageId: string;
	kind: 'text' | 'tool_start';
	delta: string | null;
	toolCallIndex: number | null;
	toolName: string | null;
};

export type ChatPhaseEvent = {
	sessionId: string;
	phase: 'thinking' | 'tool_calling' | 'done' | 'error' | 'max_rounds_reached';
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
