import test from 'node:test';
import assert from 'node:assert/strict';

import { createConsoleNavigationStore } from './console-navigation-store.ts';

test('console navigation store tracks and clears profile navigation intent', () => {
	const store = createConsoleNavigationStore();

	store.getState().setProfileNavigationIntent({ profileId: 'pf_9', view: 'detail' });
	assert.deepEqual(store.getState().profileNavigationIntent, { profileId: 'pf_9', view: 'detail' });

	store.getState().clearProfileNavigationIntent();
	assert.equal(store.getState().profileNavigationIntent, null);
});
