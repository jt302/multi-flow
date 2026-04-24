import assert from 'node:assert/strict';
import test from 'node:test';

import { createWindowSyncStore } from './window-sync-store.ts';

test('window sync store enforces single master within selected profiles', () => {
	const store = createWindowSyncStore();

	store.getState().toggleProfile('pf_1', true);
	store.getState().toggleProfile('pf_2', true);
	store.getState().setMasterProfileId('pf_1');
	store.getState().setMasterProfileId('pf_2');
	store.getState().toggleProfile('pf_2', false);

	assert.deepEqual(store.getState().selectedProfileIds, ['pf_1']);
	assert.equal(store.getState().masterProfileId, 'pf_1');
});

test('window sync store defaults the first selected profile as master', () => {
	const store = createWindowSyncStore();

	store.getState().toggleProfile('pf_1', true);
	store.getState().toggleProfile('pf_2', true);

	assert.deepEqual(store.getState().selectedProfileIds, ['pf_1', 'pf_2']);
	assert.equal(store.getState().masterProfileId, 'pf_1');
});

test('window sync store keeps manual master choice when selecting more profiles', () => {
	const store = createWindowSyncStore();

	store.getState().toggleProfile('pf_1', true);
	store.getState().toggleProfile('pf_2', true);
	store.getState().setMasterProfileId('pf_2');
	store.getState().toggleProfile('pf_3', true);

	assert.deepEqual(store.getState().selectedProfileIds, ['pf_1', 'pf_2', 'pf_3']);
	assert.equal(store.getState().masterProfileId, 'pf_2');
});

test('window sync store resets to default panel and sync config', () => {
	const store = createWindowSyncStore();

	store.getState().setActiveConfigTab('text');
	store.getState().setGap(24);
	store.getState().reset();

	assert.equal(store.getState().activeConfigTab, 'window');
	assert.equal(store.getState().arrangeGap, 16);
});
