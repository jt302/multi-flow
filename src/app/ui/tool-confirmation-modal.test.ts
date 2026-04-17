import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./tool-confirmation-modal.tsx', import.meta.url), 'utf8');

test('dangerous confirmation button keeps white text on destructive background', () => {
	assert.equal(source.includes('text-white'), true);
	assert.equal(source.includes('text-destructive-foreground'), false);
});
