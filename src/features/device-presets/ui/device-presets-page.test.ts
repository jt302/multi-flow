import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('device presets page opens built-in presets as read-only with copy available', () => {
	const source = readFileSync(
		new URL('./device-presets-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes("setFormMode('view')"), true);
	assert.equal(source.includes('onClick={() => openView(preset)}'), true);
	assert.equal(source.includes('readonly={formMode ==='), true);
	assert.equal(source.includes('onClick={() => openCopy(preset)}'), true);
	assert.equal(source.includes('{!preset.isBuiltin ? ('), true);
	assert.equal(source.includes('onClick={() => openEdit(preset)}'), true);
	assert.equal(source.includes('onClick={() => setDeleteTarget(preset)}'), true);
});

test('device presets list displays spoof browser version', () => {
	const source = readFileSync(
		new URL('./device-presets-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes('preset.browserVersion'), true);
});
