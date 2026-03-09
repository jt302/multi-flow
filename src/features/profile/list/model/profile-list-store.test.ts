import test from 'node:test';
import assert from 'node:assert/strict';

import { createProfileListStore } from './profile-list-store.ts';

test('profile list store updates filters, selection and reset', () => {
	const store = createProfileListStore();

	store.getState().patchFilters({ keyword: 'airdrop', groupFilter: 'growth' });
	store.getState().toggleProfile('pf_1', true);
	store.getState().toggleProfile('pf_2', true);
	store.getState().toggleProfile('pf_1', false);
	store.getState().setQuickEdit({ profileId: 'pf_2', field: 'toolbar' });

	assert.deepEqual(store.getState().filters, {
		keyword: 'airdrop',
		groupFilter: 'growth',
		runningFilter: 'all',
		lifecycleFilter: 'active',
	});
	assert.deepEqual(store.getState().selectedProfileIds, ['pf_2']);
	assert.deepEqual(store.getState().quickEdit, { profileId: 'pf_2', field: 'toolbar' });

	store.getState().reset();

	assert.equal(store.getState().error, null);
	assert.deepEqual(store.getState().selectedProfileIds, []);
	assert.equal(store.getState().quickEdit, null);
	assert.equal(store.getState().filters.keyword, '');
	assert.equal(store.getState().filters.groupFilter, 'all');
});
