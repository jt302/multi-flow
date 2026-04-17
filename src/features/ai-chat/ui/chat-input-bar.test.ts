import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./chat-input-bar.tsx', import.meta.url), 'utf8');

test('chat input guards Enter while IME composition is active', () => {
	assert.equal(source.includes('compositionRef'), true);
	assert.equal(source.includes('onCompositionStart={() => {'), true);
	assert.equal(source.includes('onCompositionEnd={() => {'), true);
	assert.equal(source.includes('e.nativeEvent.isComposing'), true);
	assert.equal(source.includes("if (isComposing) return;"), true);
});
