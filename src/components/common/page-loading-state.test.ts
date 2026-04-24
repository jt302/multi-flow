import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./page-loading-state.tsx', import.meta.url), 'utf8');

test('page loading state exposes one accessible shared page fallback style', () => {
	assert.match(source, /role="status"/);
	assert.match(source, /aria-live="polite"/);
	assert.match(source, /min-h-40/);
	assert.match(source, /border-border\/60/);
	assert.match(source, /bg-muted\/20/);
	assert.match(source, /animate-spin/);
});
