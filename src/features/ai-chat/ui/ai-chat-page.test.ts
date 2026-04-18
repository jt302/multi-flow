import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ai chat page hydrates the persisted session lazily before loading the right pane', () => {
	const source = readFileSync(new URL('./ai-chat-page.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('startTransition'), true);
	assert.equal(source.includes('requestAnimationFrame'), true);
	assert.equal(source.includes('hydratedSessionId'), true);
	assert.equal(source.includes('useChatMessagesQuery(hydratedSessionId)'), true);
	assert.equal(source.includes('hydratedSessionId && hydratedSession'), true);
	assert.equal(source.includes('useIsMobile'), true);
	assert.equal(source.includes('Sheet'), true);
	assert.equal(source.includes('mobileSessionsOpen'), true);
});
