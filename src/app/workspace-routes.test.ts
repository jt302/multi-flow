import assert from 'node:assert/strict';
import test from 'node:test';

import {
	NAV_PATHS,
	SETTINGS_RECYCLE_BIN_PATH,
	isWorkspacePath,
	resolveNavFromPath,
	resolvePathFromNav,
} from './workspace-routes.ts';

test('workspace routes resolve explicit nav paths including rpa', () => {
	assert.equal(NAV_PATHS.rpa, '/rpa');
	assert.equal(resolveNavFromPath('/dashboard'), 'dashboard');
	assert.equal(resolveNavFromPath('/rpa'), 'rpa');
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
