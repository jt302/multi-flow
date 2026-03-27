export type ScriptStep =
	| { kind: 'navigate'; url: string }
	| { kind: 'wait'; ms: number }
	| { kind: 'evaluate'; expression: string; result_key?: string }
	| { kind: 'click'; selector: string }
	| { kind: 'type'; selector: string; text: string }
	| { kind: 'screenshot' }
	| { kind: 'magic'; command: string; params: Record<string, unknown> }
	| { kind: 'cdp'; method: string; params?: Record<string, unknown> };

export type AutomationScript = {
	id: string;
	name: string;
	description: string | null;
	steps: ScriptStep[];
	createdAt: number;
	updatedAt: number;
};

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type StepResult = {
	index: number;
	status: StepStatus;
	output: string | null;
	durationMs: number;
};

export type AutomationRun = {
	id: string;
	scriptId: string;
	profileId: string;
	status: RunStatus;
	steps: ScriptStep[];
	results: StepResult[] | null;
	startedAt: number;
	finishedAt: number | null;
	error: string | null;
};

export type AutomationProgressEvent = {
	runId: string;
	stepIndex: number;
	stepTotal: number;
	stepStatus: StepStatus;
	output: string | null;
	durationMs: number;
	runStatus: RunStatus;
};

export type CreateAutomationScriptPayload = {
	name: string;
	description?: string;
	steps: ScriptStep[];
};
