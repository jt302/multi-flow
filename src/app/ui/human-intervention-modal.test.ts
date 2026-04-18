import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./human-intervention-modal.tsx', import.meta.url), 'utf8');

test('table dialog uses viewport-based width instead of fixed max-w-2xl', () => {
	assert.equal(source.includes('max-w-2xl'), false);
	assert.equal(source.includes('w-[min(96vw,1200px)]'), true);
	assert.equal(source.includes('flex max-h-[85vh] w-[min(96vw,1200px)] max-w-none flex-col overflow-hidden'), true);
});

test('table dialog keeps an explicit horizontal overflow container', () => {
	assert.equal(source.includes('overflow-x-auto'), true);
	assert.equal(source.includes('w-max min-w-full'), true);
	assert.equal(source.includes('min-h-0 w-full flex-1'), true);
});

test('table dialog allows cell content to wrap', () => {
	assert.equal(source.includes('break-words whitespace-normal'), true);
});
