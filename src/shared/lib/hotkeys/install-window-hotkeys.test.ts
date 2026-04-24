import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('window hotkey minimizes main and closes other windows', () => {
	const source = readFileSync(new URL('./install-window-hotkeys.ts', import.meta.url), 'utf8');

	assert.equal(source.includes("currentWindow.label === 'main'"), true);
	assert.equal(source.includes('void currentWindow.minimize();'), true);
	assert.equal(source.includes('void currentWindow.close();'), true);
	assert.equal(source.includes('void getCurrentWindow().minimize();'), false);
});
