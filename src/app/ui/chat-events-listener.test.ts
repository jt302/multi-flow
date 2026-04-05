import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('chat events listener does not invalidate chat messages for every live message event', () => {
	const source = readFileSync(new URL('./chat-events-listener.tsx', import.meta.url), 'utf8');
	const messageListenerBlock = source.split("listen<ChatMessageEvent>('ai_chat://message', (event) => {")[1]?.split("}).then((unlisten) => {")[0] ?? '';

	assert.equal(source.includes("listen<ChatMessageEvent>('ai_chat://message'"), true);
	assert.equal(messageListenerBlock.includes('queryKeys.chatMessages(event.payload.sessionId)'), false);
	assert.equal(source.includes('state.appendMessage(event.payload.message);'), true);
});
