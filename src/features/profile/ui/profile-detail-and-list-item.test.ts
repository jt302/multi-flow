import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('profile list item edits background color inside dialog and offers reset action', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('<Dialog open={isBgEditing}'), true);
	assert.equal(file.includes('重置背景色'), true);
	assert.equal(file.includes('恢复默认表现'), true);
});

test('profile detail page reveals directories before falling back to openPath', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('revealItemInDir'), true);
	assert.equal(file.includes('await openPath(path);'), true);
});
