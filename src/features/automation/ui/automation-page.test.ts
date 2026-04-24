import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('automation page switches to a mobile single-pane mode instead of always forcing the split layout', () => {
	const source = readFileSync(new URL('./automation-page.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('useIsMobile'), true);
	assert.equal(source.includes('Sheet'), true);
	assert.equal(source.includes('mobileListOpen'), true);
	assert.equal(source.includes('if (isMobile) {'), true);
});
