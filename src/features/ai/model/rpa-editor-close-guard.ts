import type { Edge, Node } from '@xyflow/react';

import type { RpaFlowDefinitionItem } from '@/entities/rpa/model/types';

export type RpaFlowDraftMeta = {
	name: string;
	note: string;
	concurrencyLimit: number;
	variablesText: string;
	defaultTargetProfileIds: string[];
};

type ComparableFlowDraft = {
	name: string;
	note: string;
	concurrencyLimit: number;
	variablesText: string;
	defaultTargetProfileIds: string[];
	nodes: unknown;
	edges: unknown;
};

export function buildComparableFlowDraft(
	meta: RpaFlowDraftMeta,
	nodes: Node[],
	edges: Edge[],
): ComparableFlowDraft {
	return {
		name: meta.name.trim(),
		note: meta.note.trim(),
		concurrencyLimit: meta.concurrencyLimit,
		variablesText: meta.variablesText.trim(),
		defaultTargetProfileIds: [...meta.defaultTargetProfileIds].sort(),
		nodes: nodes.map((node) => ({
			id: node.id,
			position: node.position,
			data: node.data,
		})),
		edges: edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandle ?? null,
			targetHandle: edge.targetHandle ?? null,
		})),
	};
}

export function buildBaselineMeta(
	flow:
		| {
				name: string;
				note?: string | null;
				definition: RpaFlowDefinitionItem;
				defaultTargetProfileIds: string[];
		  }
		| null
		| undefined,
): RpaFlowDraftMeta {
	if (!flow) {
		return {
			name: '',
			note: '',
			concurrencyLimit: 3,
			variablesText: '',
			defaultTargetProfileIds: [],
		};
	}
	return {
		name: flow.name,
		note: flow.note ?? '',
		concurrencyLimit: flow.definition.defaults.concurrencyLimit,
		variablesText: flow.definition.variables
			.map((item) => `${item.key}|${item.label}|${item.required ? 'true' : 'false'}|${item.defaultValue ?? ''}`)
			.join('\n'),
		defaultTargetProfileIds: flow.defaultTargetProfileIds,
	};
}

export function hasPendingFlowChanges(
	current: ComparableFlowDraft,
	baseline: ComparableFlowDraft,
) {
	return JSON.stringify(current) !== JSON.stringify(baseline);
}

export function resolveRpaEditorLeaveMode(windowLabel: string) {
	return windowLabel === 'rpa-flow-editor' ? 'close-window' : 'navigate-main';
}
