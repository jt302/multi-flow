export type ModelCapability = {
	name: string;
	contextWindow: number;
	vision: boolean;
	tools: boolean;
	thinking: boolean;
};

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
	'gpt-4o': { name: 'GPT-4o', contextWindow: 128000, vision: true, tools: true, thinking: false },
	'gpt-4o-mini': {
		name: 'GPT-4o Mini',
		contextWindow: 128000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'gpt-4.1': {
		name: 'GPT-4.1',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'gpt-4.1-mini': {
		name: 'GPT-4.1 Mini',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'gpt-4.1-nano': {
		name: 'GPT-4.1 Nano',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: false,
	},
	o3: { name: 'o3', contextWindow: 200000, vision: true, tools: true, thinking: true },
	'o3-mini': { name: 'o3 Mini', contextWindow: 200000, vision: false, tools: true, thinking: true },
	'o4-mini': { name: 'o4 Mini', contextWindow: 200000, vision: true, tools: true, thinking: true },
	'claude-opus-4': {
		name: 'Claude Opus 4',
		contextWindow: 200000,
		vision: true,
		tools: true,
		thinking: true,
	},
	'claude-sonnet-4': {
		name: 'Claude Sonnet 4',
		contextWindow: 200000,
		vision: true,
		tools: true,
		thinking: true,
	},
	'claude-3-5-sonnet': {
		name: 'Claude 3.5 Sonnet',
		contextWindow: 200000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'claude-3-5-haiku': {
		name: 'Claude 3.5 Haiku',
		contextWindow: 200000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'gemini-2.5-pro': {
		name: 'Gemini 2.5 Pro',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: true,
	},
	'gemini-2.5-flash': {
		name: 'Gemini 2.5 Flash',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: true,
	},
	'gemini-2.0-flash': {
		name: 'Gemini 2.0 Flash',
		contextWindow: 1000000,
		vision: true,
		tools: true,
		thinking: false,
	},
	'deepseek-chat': {
		name: 'DeepSeek V3',
		contextWindow: 64000,
		vision: false,
		tools: true,
		thinking: false,
	},
	'deepseek-reasoner': {
		name: 'DeepSeek R1',
		contextWindow: 128000,
		vision: false,
		tools: false,
		thinking: true,
	},
};

export function getModelCapability(model: string): ModelCapability | null {
	const lower = model.toLowerCase();
	for (const [key, cap] of Object.entries(MODEL_CAPABILITIES)) {
		if (lower.includes(key)) return cap;
	}
	return null;
}

export function formatContextWindow(tokens: number): string {
	if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
	return `${(tokens / 1000).toFixed(0)}k`;
}
