import assert from 'node:assert/strict';
import test from 'node:test';

import {
	NAV_PATHS,
	SETTINGS_RECYCLE_BIN_PATH,
	isWorkspacePath,
	resolveNavFromPath,
	resolvePathFromNav,
} from './workspace-routes.ts';

test('workspace routes resolve explicit nav paths without retired rpa entries', () => {
	assert.equal('rpa' in NAV_PATHS, false);
	assert.equal(resolveNavFromPath('/dashboard'), 'dashboard');
	assert.equal(resolveNavFromPath('/rpa'), null);
	assert.equal(resolveNavFromPath('/rpa/flows'), null);
	assert.equal(resolveNavFromPath('/rpa/tasks'), null);
	assert.equal(resolveNavFromPath('/rpa/runs'), null);
	assert.equal(isWorkspacePath('/rpa'), false);
	assert.equal(isWorkspacePath('/rpa/flows'), false);
	assert.equal(resolvePathFromNav('settings'), '/settings');
});

test('workspace routes treat recycle bin as settings child path', () => {
	assert.equal(SETTINGS_RECYCLE_BIN_PATH, '/settings/recycle-bin');
	assert.equal(resolveNavFromPath(SETTINGS_RECYCLE_BIN_PATH), 'settings');
	assert.equal(isWorkspacePath(SETTINGS_RECYCLE_BIN_PATH), true);
});

test('workspace routes keep retired legacy path disabled', () => {
	assert.equal(resolveNavFromPath('/ai'), null);
	assert.equal(isWorkspacePath('/ai'), false);
});
