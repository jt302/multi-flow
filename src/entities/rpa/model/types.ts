export type RpaFlowLifecycle = 'active' | 'deleted';
export type RpaRunStatus =
	| 'queued'
	| 'running'
	| 'partial_success'
	| 'success'
	| 'failed'
	| 'cancelled';
export type RpaRunInstanceStatus =
	| 'queued'
	| 'running'
	| 'needs_manual'
	| 'success'
	| 'failed'
	| 'cancelled'
	| 'interrupted';
export type RpaRunStepStatus = 'running' | 'success' | 'failed' | 'skipped';

export type RpaNodeConfig = Record<string, unknown>;

export type RpaFlowNodeItem = {
	id: string;
	kind: string;
	position: {
		x: number;
		y: number;
	};
	config: RpaNodeConfig;
};

export type RpaFlowEdgeItem = {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
	targetHandle?: string | null;
};

export type RpaFlowVariableItem = {
	key: string;
	label: string;
	required: boolean;
	defaultValue?: string | null;
};

export type RpaFlowDefinitionItem = {
	nodes: RpaFlowNodeItem[];
	edges: RpaFlowEdgeItem[];
	entryNodeId: string;
	variables: RpaFlowVariableItem[];
	defaults: {
		concurrencyLimit: number;
	};
};

export type RpaFlowItem = {
	id: string;
	name: string;
	note?: string | null;
	lifecycle: RpaFlowLifecycle;
	definition: RpaFlowDefinitionItem;
	defaultTargetProfileIds: string[];
	createdAt: number;
	updatedAt: number;
	deletedAt?: number | null;
	lastRunAt?: number | null;
};

export type RpaArtifactIndexItem = {
	screenshotPath?: string | null;
	htmlPath?: string | null;
	outputPath?: string | null;
};

export type RpaRunItem = {
	id: string;
	flowId: string;
	flowName: string;
	triggerSource: string;
	status: RpaRunStatus;
	totalInstances: number;
	successCount: number;
	failedCount: number;
	cancelledCount: number;
	concurrencyLimit: number;
	definitionSnapshot: RpaFlowDefinitionItem;
	runtimeInput: Record<string, unknown>;
	startedAt?: number | null;
	finishedAt?: number | null;
	createdAt: number;
	updatedAt: number;
};

export type RpaRunInstanceItem = {
	id: string;
	runId: string;
	profileId: string;
	status: RpaRunInstanceStatus;
	currentNodeId?: string | null;
	context: Record<string, unknown>;
	artifactIndex: RpaArtifactIndexItem;
	errorMessage?: string | null;
	startedAt?: number | null;
	finishedAt?: number | null;
	createdAt: number;
	updatedAt: number;
};

export type RpaRunStepItem = {
	id: string;
	runInstanceId: string;
	nodeId: string;
	nodeKind: string;
	status: RpaRunStepStatus;
	attempt: number;
	inputSnapshot: Record<string, unknown>;
	outputSnapshot: Record<string, unknown>;
	errorMessage?: string | null;
	artifacts: RpaArtifactIndexItem;
	startedAt: number;
	finishedAt?: number | null;
};

export type RpaRunDetailsItem = {
	run: RpaRunItem;
	instances: RpaRunInstanceItem[];
};

export type SaveRpaFlowPayload = {
	name: string;
	note?: string;
	definition: RpaFlowDefinitionItem;
	defaultTargetProfileIds: string[];
};

export type RunRpaFlowPayload = {
	flowId: string;
	targetProfileIds: string[];
	concurrencyLimit?: number;
	runtimeInput?: Record<string, unknown>;
};
