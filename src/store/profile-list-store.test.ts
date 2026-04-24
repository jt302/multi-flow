import assert from 'node:assert/strict';
import test from 'node:test';

import { createProfileListStore } from './profile-list-store.ts';

test('profile list store updates filters, selection and reset', () => {
	const store = createProfileListStore();

	store.getState().patchFilters({ keyword: 'airdrop', groupFilter: 'growth' });
	store.getState().setBatchGroupTarget('ops');
	store.getState().toggleProfile('pf_1', true);
	store.getState().toggleProfile('pf_2', true);
	store.getState().toggleProfile('pf_1', false);
	store.getState().setQuickEdit({ profileId: 'pf_2', field: 'visual' });

	assert.deepEqual(store.getState().filters, {
		keyword: 'airdrop',
		groupFilter: 'growth',
		runningFilter: 'all',
		lifecycleFilter: 'active',
	});
	assert.deepEqual(store.getState().selectedProfileIds, ['pf_2']);
	assert.equal(store.getState().batchGroupTarget, 'ops');
	assert.deepEqual(store.getState().quickEdit, { profileId: 'pf_2', field: 'visual' });

	store.getState().reset();

	assert.equal(store.getState().error, null);
	assert.equal(store.getState().batchGroupTarget, '');
	assert.deepEqual(store.getState().selectedProfileIds, []);
	assert.equal(store.getState().quickEdit, null);
	assert.equal(store.getState().filters.keyword, '');
	assert.equal(store.getState().filters.groupFilter, 'all');
});
