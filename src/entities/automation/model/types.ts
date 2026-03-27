export type WaitForUserTimeout = 'continue' | 'fail';
export type LoopMode = 'count' | 'while';

export type ScriptStep =
	| { kind: 'navigate'; url: string; output_key?: string }
	| { kind: 'wait'; ms: number }
	| { kind: 'evaluate'; expression: string; result_key?: string }
	| { kind: 'click'; selector: string }
	| { kind: 'type'; selector: string; text: string }
	| { kind: 'screenshot'; output_key?: string }
	| { kind: 'magic'; command: string; params: Record<string, unknown>; output_key?: string }
	| { kind: 'cdp'; method: string; params?: Record<string, unknown>; output_key?: string }
	| {
			kind: 'wait_for_user';
			message: string;
			input_label?: string;
			output_key?: string;
			timeout_ms?: number;
			on_timeout?: WaitForUserTimeout;
	  }
	| {
			kind: 'condition';
			condition_expr: string;
			then_steps: ScriptStep[];
			else_steps?: ScriptStep[];
	  }
	| {
			kind: 'loop';
			mode?: LoopMode;
			count?: number;
			condition_expr?: string;
			max_iterations?: number;
			iter_var?: string;
			body_steps: ScriptStep[];
	  }
	| { kind: 'break' }
	| { kind: 'continue' };

export type AutomationScript = {
	id: string;
	name: string;
	description: string | null;
	steps: ScriptStep[];
	createdAt: number;
	updatedAt: number;
};

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting_human';

export type StepResult = {
	index: number;
	status: StepStatus;
	output: string | null;
	durationMs: number;
	varsSet?: Record<string, string>;
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
	varsSet?: Record<string, string>;
	stepPath?: number[];
};

export type AutomationVariablesUpdatedEvent = {
	runId: string;
	vars: Record<string, string>;
};

export type AutomationHumanRequiredEvent = {
	runId: string;
	message: string;
	inputLabel: string | null;
	timeoutMs: number | null;
	stepPath: number[];
};

export type AutomationHumanDismissedEvent = {
	runId: string;
};

export type AutomationRunCancelledEvent = {
	runId: string;
};

export type CreateAutomationScriptPayload = {
	name: string;
	description?: string;
	steps: ScriptStep[];
};
