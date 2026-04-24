import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('page header becomes actions-only and stays hidden without actions', () => {
	const source = readFileSync(new URL('./page-header.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('if (!actions) return null'), true);
	assert.equal(source.includes('justify-end'), true);
	assert.equal(source.includes('text-base font-semibold'), false);
	assert.equal(source.includes('text-xs text-muted-foreground'), false);
});
