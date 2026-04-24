import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile list stats keep the top summary cards side by side on small screens', () => {
	const source = readFileSync(new URL('./profile-list-stats.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('grid-cols-3'), true);
	assert.equal(source.includes('sm:grid-cols-2'), false);
	assert.equal(source.includes('xl:grid-cols-3'), false);
});
