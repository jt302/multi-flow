import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./tool-call-card.tsx', import.meta.url), 'utf8');

test('tool call card uses animated expand and collapse container', () => {
	assert.equal(source.includes("gridTemplateRows: open ? '1fr' : '0fr'"), true);
	assert.equal(source.includes('transition-all duration-200 ease-in-out'), true);
});

test('tool call card rotates chevron when toggled', () => {
	assert.equal(source.includes('transition-transform duration-200'), true);
	assert.equal(source.includes("open && 'rotate-90'"), true);
});
