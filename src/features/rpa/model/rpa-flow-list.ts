import type { RpaFlowItem } from '@/entities/rpa/model/types';

export function getVisibleRpaFlows(flows: RpaFlowItem[]): RpaFlowItem[] {
	return [...flows]
		.filter((flow) => flow.lifecycle === 'active')
		.sort((left, right) => right.updatedAt - left.updatedAt);
}
