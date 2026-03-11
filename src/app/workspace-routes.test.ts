import assert from 'node:assert/strict';
import test from 'node:test';

import {
	NAV_PATHS,
	RPA_PATHS,
	SETTINGS_RECYCLE_BIN_PATH,
	isWorkspacePath,
	resolveNavFromPath,
	resolvePathFromNav,
} from './workspace-routes.ts';

test('workspace routes resolve explicit nav paths including rpa children', () => {
	assert.equal(NAV_PATHS.rpa, '/rpa/flows');
	assert.equal(RPA_PATHS.flows, '/rpa/flows');
	assert.equal(RPA_PATHS.tasks, '/rpa/tasks');
	assert.equal(RPA_PATHS.runs, '/rpa/runs');
	assert.equal(resolveNavFromPath('/dashboard'), 'dashboard');
	assert.equal(resolveNavFromPath('/rpa'), 'rpa');
	assert.equal(resolveNavFromPath('/rpa/flows'), 'rpa');
	assert.equal(resolveNavFromPath('/rpa/tasks'), 'rpa');
	assert.equal(resolveNavFromPath('/rpa/runs'), 'rpa');
	assert.equal(resolvePathFromNav('settings'), '/settings');
	assert.equal(resolvePathFromNav('rpa'), '/rpa/flows');
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
