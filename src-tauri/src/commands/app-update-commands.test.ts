import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./app_update_commands.rs', import.meta.url), 'utf8');
const modSource = readFileSync(new URL('./mod.rs', import.meta.url), 'utf8');
const libSource = readFileSync(new URL('../lib.rs', import.meta.url), 'utf8');

test('app update commands are registered with tauri', () => {
	assert.match(modSource, /pub mod app_update_commands;/);
	assert.match(libSource, /commands::app_update_commands::check_app_update/);
	assert.match(libSource, /commands::app_update_commands::install_app_update/);
});

test('app update install blocks while runtime work is active', () => {
	assert.match(source, /active_session_count\(\)/);
	assert.match(source, /cancel_tokens/);
	assert.match(source, /ensure_can_install_update/);
});

test('app update progress event payload is stable', () => {
	assert.match(source, /APP_UPDATE_PROGRESS_EVENT/);
	assert.match(source, /app_update:\/\/progress/);
	assert.match(source, /downloaded/);
	assert.match(source, /total/);
	assert.match(source, /phase/);
});
