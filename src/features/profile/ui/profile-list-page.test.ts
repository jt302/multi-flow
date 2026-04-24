import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile list page places refresh and create actions in the section header', () => {
	const source = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('actions={'), true);
	assert.equal(source.includes("tCommon('refresh')"), true);
	assert.equal(source.includes("tCommon('createItem', { item: tCommon('profile') })"), true);
});
