export interface AiSkillMeta {
	slug: string;
	name: string;
	description?: string;
	version?: string;
	enabled: boolean;
	triggers: string[];
	allowedTools: string[];
	model?: string;
}

export interface AiSkillFull extends AiSkillMeta {
	body: string;
}

export interface CreateSkillRequest {
	slug: string;
	name: string;
	description?: string;
	version?: string;
	enabled?: boolean;
	triggers?: string[];
	allowedTools?: string[];
	model?: string;
	body: string;
}

export interface UpdateSkillRequest {
	name?: string;
	description?: string;
	version?: string;
	enabled?: boolean;
	triggers?: string[];
	allowedTools?: string[];
	model?: string;
	body?: string;
}
