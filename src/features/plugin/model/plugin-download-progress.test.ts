import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('plugin api exposes progress events and active download snapshots', () => {
	const api = readFileSync(
		new URL('../../../entities/plugin/api/plugins-api.ts', import.meta.url),
		'utf8',
	);

	assert.equal(api.includes("listen<PluginDownloadProgressEvent>('plugin_download_progress'"), true);
	assert.equal(api.includes("'get_active_plugin_downloads'"), true);
	assert.equal(api.includes('createPluginTaskId'), true);
});

test('workspace layout mounts plugin download listener with global lifetime', () => {
	const layout = readFileSync(
		new URL('../../../app/ui/workspace-layout.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(layout.includes('PluginDownloadListener'), true);
	assert.equal(layout.includes('<PluginDownloadListener />'), true);
});

test('plugin backend emits progress and registers active download command', () => {
	const pluginCommands = readFileSync(
		new URL('../../../../src-tauri/src/commands/plugin_commands.rs', import.meta.url),
		'utf8',
	);
	const lib = readFileSync(
		new URL('../../../../src-tauri/src/lib.rs', import.meta.url),
		'utf8',
	);
	const state = readFileSync(
		new URL('../../../../src-tauri/src/state.rs', import.meta.url),
		'utf8',
	);

	assert.equal(pluginCommands.includes('const PLUGIN_PROGRESS_EVENT: &str = "plugin_download_progress";'), true);
	assert.equal(pluginCommands.includes('pub fn get_active_plugin_downloads'), true);
	assert.equal(pluginCommands.includes('emit_plugin_progress'), true);
	assert.equal(pluginCommands.includes('download_binary_with_progress'), true);
	assert.equal(lib.includes('commands::plugin_commands::get_active_plugin_downloads'), true);
	assert.equal(state.includes('active_plugin_downloads'), true);
});
