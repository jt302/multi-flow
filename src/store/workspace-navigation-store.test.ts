import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkspaceNavigationStore } from './workspace-navigation-store.ts';

test('workspace navigation store tracks and clears profile navigation intent', () => {
	const store = createWorkspaceNavigationStore();

	store.getState().setProfileNavigationIntent({ profileId: 'pf_9', view: 'detail' });
	assert.deepEqual(store.getState().profileNavigationIntent, { profileId: 'pf_9', view: 'detail' });

	store.getState().clearProfileNavigationIntent();
	assert.equal(store.getState().profileNavigationIntent, null);
});
