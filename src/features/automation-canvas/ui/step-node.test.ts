import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('step node uses memoized render path without transition-all during dragging', () => {
	const source = readFileSync(new URL('./step-node.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('memo('), true);
	assert.equal(source.includes('transition-all'), false);
});
