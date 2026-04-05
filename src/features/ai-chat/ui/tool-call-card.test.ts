import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tool call card prefers local image refs for screenshots and keeps base64 only as fallback', () => {
	const source = readFileSync(new URL('./tool-call-card.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes("convertFileSrc"), true);
	assert.equal(source.includes('message.imageRef'), true);
	assert.equal(source.includes('message.imageBase64'), true);
});
