import assert from 'node:assert/strict';
import test from 'node:test';

import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { RpaFlowItem } from '@/entities/rpa/model/types';

import {
	countDeletedRecycleBinItems,
	getDeletedRpaFlows,
} from './rpa-recycle-bin.ts';

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

test('getDeletedRpaFlows returns deleted flows only', () => {
	const result = getDeletedRpaFlows([
		createFlow({ id: 'rf_1', lifecycle: 'active' }),
		createFlow({ id: 'rf_2', lifecycle: 'deleted' }),
		createFlow({ id: 'rf_3', lifecycle: 'deleted' }),
	]);

	assert.deepEqual(
		result.map((item) => item.id),
		['rf_2', 'rf_3'],
	);
});

test('countDeletedRecycleBinItems includes deleted RPA flows', () => {
	const profiles = [{ lifecycle: 'deleted' }, { lifecycle: 'active' }] as ProfileItem[];
	const proxies = [{ lifecycle: 'deleted' }] as ProxyItem[];
	const groups = [{ lifecycle: 'deleted' }] as GroupItem[];
	const rpaFlows = [
		createFlow({ lifecycle: 'active' }),
		createFlow({ id: 'rf_2', lifecycle: 'deleted' }),
	];

	assert.equal(
		countDeletedRecycleBinItems({
			profiles,
			proxies,
			groups,
			rpaFlows,
		}),
		4,
	);
});
