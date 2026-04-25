import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

test('main sidebar ratio input accepts the default decimal value', () => {
	assert.equal(source.includes('mainRatio: 0.66'), true);
	assert.equal(source.includes('step={0.01}'), true);
	assert.equal(source.includes('step={0.05}'), false);
});

test('grid arrangement always submits non-stretch last row alignment', () => {
	assert.equal(source.includes("lastRowAlign: 'start'"), true);
	assert.equal(
		source.includes("lastRowAlign: mode === 'grid' ? 'start' : values.lastRowAlign"),
		true,
	);
});
