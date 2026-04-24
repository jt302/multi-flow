import assert from 'node:assert/strict';
import test from 'node:test';

import {
	isWorkspacePath,
	NAV_PATHS,
	PROFILES_DEVICE_PRESETS_PATH,
	resolveNavFromPath,
	resolvePathFromNav,
	SETTINGS_DEFAULT_PATH,
	SETTINGS_PATHS,
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

test('workspace routes treat settings children as settings nav and expose default child path', () => {
	assert.equal(SETTINGS_DEFAULT_PATH, '/settings/general');
	assert.equal(SETTINGS_PATHS.general, '/settings/general');
	assert.equal(SETTINGS_PATHS.appearance, '/settings/appearance');
	assert.equal(SETTINGS_PATHS.resources, '/settings/resources');
	assert.equal(SETTINGS_PATHS.ai, '/settings/ai');
	assert.equal(SETTINGS_PATHS['recycle-bin'], '/settings/recycle-bin');
	assert.equal(resolveNavFromPath(SETTINGS_PATHS.general), 'settings');
	assert.equal(resolveNavFromPath(SETTINGS_PATHS.resources), 'settings');
	assert.equal(resolveNavFromPath(SETTINGS_PATHS.ai), 'settings');
	assert.equal(resolveNavFromPath(PROFILES_DEVICE_PRESETS_PATH), 'profiles');
	assert.equal(isWorkspacePath(SETTINGS_PATHS.general), true);
	assert.equal(isWorkspacePath(SETTINGS_PATHS['recycle-bin']), true);
});
