import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FILES_WITH_SHARED_SCROLLBAR_CLASS = [
	'./scroll-area.tsx',
	'./select.tsx',
	'./dropdown-menu.tsx',
	'./command.tsx',
	'./sidebar.tsx',
] as const;

test('shared scroll containers opt into the themed scrollbar utility class', () => {
	for (const file of FILES_WITH_SHARED_SCROLLBAR_CLASS) {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');
		assert.match(source, /mf-scrollbar/);
	}
});

test('scroll area thumb uses the shared scrollbar tokens from the automation runs reference', () => {
	const source = readFileSync(new URL('./scroll-area.tsx', import.meta.url), 'utf8');

	assert.match(source, /bg-\[var\(--scrollbar-thumb\)\]/);
	assert.match(source, /hover:bg-\[var\(--scrollbar-thumb-hover\)\]/);
});
