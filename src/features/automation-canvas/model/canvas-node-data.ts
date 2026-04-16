import { Position, type Node } from '@xyflow/react';
import i18next from 'i18next';

import type { ScriptStep } from '@/entities/automation/model/types';
import { isTerminalStepKind } from '@/entities/automation/model/step-flow';
import {
	GROUP_ACCENT_COLORS,
	GROUP_COLORS,
	KIND_GROUPS,
	getGroupLabel,
	getKindLabel,
	getStepSummaryText,
} from '@/entities/automation/model/step-registry';

export type StepNodeSourceHandle = {
	id: string | null;
	left?: string;
	hidden?: boolean;
};

export type StepNodeData = {
	step: ScriptStep;
	index: number;
	stepStatus?: string;
	label: string;
	groupLabel: string;
	groupColorClass: string;
	accentClass: string;
	summary: string;
	isTerminal: boolean;
	sourceHandles: StepNodeSourceHandle[];
	footerLabels: string[];
};

type SourceHandlePresentation = Pick<StepNodeData, 'sourceHandles' | 'footerLabels'>;

function buildSourceHandlePresentation(step: ScriptStep): SourceHandlePresentation {
	if (step.kind === 'condition') {
		return {
			footerLabels: [
				i18next.t('automation:canvas.conditionThen'),
				i18next.t('automation:canvas.conditionElse'),
			],
			sourceHandles: [
				{ id: null, hidden: true },
				{ id: 'then', left: '30%' },
				{ id: 'else', left: '70%' },
			],
		};
	}

	if (step.kind === 'loop') {
		return {
			footerLabels: [
				i18next.t('automation:canvas.loopBody'),
				i18next.t('automation:canvas.loopNext'),
			],
			sourceHandles: [
				{ id: 'body', left: '30%' },
				{ id: null, left: '70%' },
			],
		};
	}

	if (step.kind === 'confirm_dialog' && step.buttons && step.buttons.length > 0) {
		return {
			footerLabels: step.buttons.map((button) => button.text),
			sourceHandles: [
				...step.buttons.map((_, index) => ({
					id: `btn_${index}`,
					left: `${((index + 1) / (step.buttons!.length + 1)) * 100}%`,
				})),
				{ id: null, hidden: true },
			],
		};
	}

	if (isTerminalStepKind(step.kind)) {
		return {
			footerLabels: [],
			sourceHandles: [],
		};
	}

	return {
		footerLabels: [],
		sourceHandles: [{ id: null }],
	};
}

export function buildStepNodeData(
	step: ScriptStep,
	index: number,
	stepStatus?: string,
): StepNodeData {
	const kind = step.kind;
	const groupKey = KIND_GROUPS[kind] ?? 'general';
	const handles = buildSourceHandlePresentation(step);

	return {
		step,
		index,
		stepStatus,
		label: getKindLabel(kind) || kind,
		groupLabel: getGroupLabel(groupKey) || groupKey,
		groupColorClass: GROUP_COLORS[groupKey] ?? GROUP_COLORS.general,
		accentClass: GROUP_ACCENT_COLORS[groupKey] ?? 'border-l-slate-400',
		summary: getStepSummaryText(step) || '',
		isTerminal: isTerminalStepKind(kind),
		sourceHandles: handles.sourceHandles,
		footerLabels: handles.footerLabels,
	};
}

export function buildStepCanvasNode(
	step: ScriptStep,
	index: number,
	position: { x: number; y: number },
	stepStatus?: string,
): Node<StepNodeData> {
	return {
		id: `step-${index}`,
		type: 'step',
		position,
		sourcePosition: Position.Bottom,
		targetPosition: Position.Top,
		data: buildStepNodeData(step, index, stepStatus),
	};
}

export function syncNodeStatuses(
	nodes: Node<StepNodeData>[],
	liveStatuses: Record<number, string>,
): Node<StepNodeData>[] {
	return nodes.map((node) => {
		if (!node.id.startsWith('step-')) {
			return node;
		}

		const nextStatus = liveStatuses[(node.data as StepNodeData).index];
		if ((node.data as StepNodeData).stepStatus === nextStatus) {
			return node;
		}

		return {
			...node,
			data: {
				...(node.data as StepNodeData),
				stepStatus: nextStatus,
			},
		};
	});
}

export function rebuildIndexedNode(
	node: Node<StepNodeData>,
	step: ScriptStep,
	index: number,
	stepStatus?: string,
): Node<StepNodeData> {
	return {
		...node,
		id: `step-${index}`,
		data: buildStepNodeData(step, index, stepStatus),
	};
}
