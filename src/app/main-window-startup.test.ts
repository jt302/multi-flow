import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('app bootstrap does not manually show the main window', () => {
	const file = readFileSync(new URL('./app.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('getCurrentWindow().show()'), false);
	assert.equal(file.includes('@tauri-apps/api/window'), false);
});

test('tauri main window is manually created from config with dedicated state persistence', () => {
	const libFile = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8');
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

test('main window startup keeps a backend fallback for missed frontend ready handshakes', () => {
	const libFile = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8');
	const windowCommandsFile = readFileSync(
		new URL('../../src-tauri/src/commands/window_commands.rs', import.meta.url),
		'utf8',
	);

	assert.equal(libFile.includes('MAIN_WINDOW_SHOWN'), true);
	assert.equal(libFile.includes('init-fallback'), true);
	assert.equal(windowCommandsFile.includes('show_main_window_if_needed'), true);
});

test('main app router disables transition-based navigation updates during startup', () => {
	const mainFile = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

	assert.equal(mainFile.includes('<BrowserRouter unstable_useTransitions={false}>'), true);
});

function collectRuntimeSourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const fullPath = join(dir, entry);
		const stats = statSync(fullPath);

		if (stats.isDirectory()) {
			return collectRuntimeSourceFiles(fullPath);
		}

		const extension = extname(fullPath);
		if (!['.ts', '.tsx'].includes(extension) || fullPath.includes('.test.')) {
			return [];
		}

		return [fullPath];
	});
}

test('frontend runtime source does not emit console logs', () => {
	const srcRoot = dirname(fileURLToPath(new URL('../main.tsx', import.meta.url)));
	const sourceFiles = collectRuntimeSourceFiles(srcRoot);
	const filesWithConsole = sourceFiles.filter((file) =>
		/console\.(log|warn|error|debug|info)\s*\(/.test(readFileSync(file, 'utf8')),
	);

	assert.deepEqual(filesWithConsole, []);
});
