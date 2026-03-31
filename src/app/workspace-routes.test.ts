import assert from 'node:assert/strict';
import test from 'node:test';

import {
	NAV_PATHS,
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
	assert.equal(resolveNavFromPath('/plugins'), 'plugins');
	assert.equal(resolvePathFromNav('plugins'), '/plugins');
	assert.equal(resolvePathFromNav('settings'), '/settings');
});

test('workspace routes no longer expose recycle bin as top-level nav', () => {
	assert.equal(resolveNavFromPath('/recycle-bin'), null);
	assert.equal(isWorkspacePath('/recycle-bin'), false);
});

test('workspace routes keep retired legacy path disabled', () => {
	assert.equal(resolveNavFromPath('/ai'), null);
	assert.equal(isWorkspacePath('/ai'), false);
});
