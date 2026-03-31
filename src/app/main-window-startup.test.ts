import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app bootstrap does not manually show the main window', () => {
	const file = readFileSync(new URL('./app.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('getCurrentWindow().show()'), false);
	assert.equal(file.includes("@tauri-apps/api/window"), false);
});

test('tauri main window is manually created from config with dedicated state persistence', () => {
	const libFile = readFileSync(
		new URL('../../src-tauri/src/lib.rs', import.meta.url),
		'utf8',
	);
	const tauriConfigFile = readFileSync(
		new URL('../../src-tauri/tauri.conf.json', import.meta.url),
		'utf8',
	);

	assert.equal(libFile.includes('const MAIN_WINDOW_LABEL: &str = "main";'), true);
	assert.equal(libFile.includes('.skip_initial_state(MAIN_WINDOW_LABEL)'), true);
	assert.equal(libFile.includes('WebviewWindowBuilder::from_config'), true);
	assert.equal(libFile.includes('main-window-state.json'), true);
	assert.equal(libFile.includes('load_saved_main_window_state'), true);
	assert.equal(libFile.includes('save_main_window_state'), true);
	assert.equal(libFile.includes('scale_factor'), true);
	assert.equal(tauriConfigFile.includes('"create": false'), true);
});
