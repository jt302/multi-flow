import assert from 'node:assert/strict';
import test from 'node:test';

import type { RpaFlowItem } from '@/entities/rpa/model/types';

import { getVisibleRpaFlows } from './rpa-flow-list.ts';

function createFlow(overrides: Partial<RpaFlowItem>): RpaFlowItem {
	return {
		id: 'rf_000001',
		name: 'Flow',
		note: null,
		lifecycle: 'active',
		definition: {
			nodes: [],
			edges: [],
			entryNodeId: 'node_1',
			variables: [],
			defaults: { concurrencyLimit: 3 },
		},
		defaultTargetProfileIds: [],
		createdAt: 100,
		updatedAt: 100,
		deletedAt: null,
		lastRunAt: null,
		...overrides,
	};
}

test('getVisibleRpaFlows only returns active flows sorted by updatedAt desc', () => {
	const result = getVisibleRpaFlows([
		createFlow({ id: 'rf_1', name: 'Archived', lifecycle: 'deleted', updatedAt: 500 }),
		createFlow({ id: 'rf_2', name: 'Newer', updatedAt: 400 }),
		createFlow({ id: 'rf_3', name: 'Older', updatedAt: 200 }),
	]);

	assert.deepEqual(
		result.map((item) => item.id),
		['rf_2', 'rf_3'],
	);
});
