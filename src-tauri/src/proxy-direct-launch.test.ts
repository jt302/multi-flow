import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('runtime no longer contains proxy daemon relay code', () => {
	const lib = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');
	const state = readFileSync(new URL('./state.rs', import.meta.url), 'utf8');
	const profileCommands = readFileSync(
		new URL('./commands/profile_commands.rs', import.meta.url),
		'utf8',
	);
	const tauriConfig = readFileSync(new URL('../tauri.conf.json', import.meta.url), 'utf8');

	assert.equal(lib.includes('start_proxy_daemon_sidecar'), false);
	assert.equal(lib.includes('PROXY_DAEMON_SIDECAR_NAME'), false);
	assert.equal(lib.includes('mod local_api_server'), false);
	assert.equal(state.includes('local_api_server'), false);
	assert.equal(profileCommands.includes('start_proxy_runtime'), false);
	assert.equal(profileCommands.includes('stop_proxy_runtime'), false);
	assert.equal(tauriConfig.includes('binaries/proxy-daemon'), false);
});
