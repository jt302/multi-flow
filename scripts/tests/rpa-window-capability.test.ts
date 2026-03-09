import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('default tauri capability allows rpa flow editor window', () => {
	const filePath = resolve(process.cwd(), 'src-tauri/capabilities/default.json');
	const raw = readFileSync(filePath, 'utf8');
	const capability = JSON.parse(raw) as { windows?: string[] };
	assert.equal(capability.windows?.includes('rpa-flow-editor'), true);
});
