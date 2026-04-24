import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('global styles define reusable themed scrollbar tokens and utility class', () => {
	const source = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

	assert.match(source, /--scrollbar-size:/);
	assert.match(source, /--scrollbar-thumb:/);
	assert.match(source, /--scrollbar-thumb-hover:/);
	assert.match(source, /\.mf-scrollbar\s*\{/);
	assert.match(
		source,
		/--scrollbar-thumb-hover:\s*color-mix\(\s*in oklab,\s*var\(--muted-foreground\) 70%,\s*transparent\s*\);/,
	);
});
