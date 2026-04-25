import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { createChatStore } from './chat-store.ts';

function createMessage(overrides: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
	return {
		id: 'msg_1',
		sessionId: 'session_1',
		role: 'tool',
		contentText: null,
		toolCallsJson: null,
		toolCallId: 'tool_1',
		toolName: 'cdp_screenshot',
		toolArgsJson: null,
		toolResult: '/tmp/first.png',
		toolStatus: 'completed',
		toolDurationMs: 10,
		imageBase64: null,
		isActive: true,
		createdAt: 1,
		sortOrder: 1,
		thinkingText: null,
		thinkingTokens: null,
		imageRef: null,
		promptTokens: null,
		completionTokens: null,
		...overrides,
	};
}

test('chat store upserts live messages by id instead of appending duplicates', () => {
	const store = createChatStore({ activeSessionId: 'session_1' });
	const first = createMessage();
	const updated = createMessage({
		toolResult: '/tmp/final.png',
		imageRef: '/tmp/final.png',
		toolDurationMs: 42,
	});

	store.getState().appendMessage(first);
	store.getState().appendMessage(updated);

	assert.equal(store.getState().liveMessages.length, 1);
	assert.equal(store.getState().liveMessages[0]?.toolResult, '/tmp/final.png');
	assert.equal(store.getState().liveMessages[0]?.imageRef, '/tmp/final.png');
	assert.equal(store.getState().liveMessages[0]?.toolDurationMs, 42);
});

test('chat store stores empty assistant messages and completes normally', () => {
	const store = createChatStore({ activeSessionId: 'session_1' });
	store.getState().appendMessage(
		createMessage({
			id: 'msg_empty',
			role: 'assistant',
			contentText: '',
			toolCallId: null,
			toolName: null,
			toolStatus: null,
			toolDurationMs: null,
			toolResult: null,
			sortOrder: 2,
		}),
	);

	store.getState().updatePhase({
		sessionId: 'session_1',
		phase: 'done',
		round: 2,
		maxRounds: 100,
		elapsedMs: 10,
	});

	assert.equal(store.getState().liveMessages.length, 1);
	assert.equal(store.getState().liveMessages[0]?.contentText, '');
	assert.equal(store.getState().terminalState, 'success');
});

test('chat store keeps streaming assistant placeholders with tool names on terminal phase', () => {
	const store = createChatStore({ activeSessionId: 'session_1' });
	store.getState().startLiveMessage(
		createMessage({
			id: 'stream_1',
			role: 'assistant',
			contentText: null,
			toolCallId: null,
			toolName: null,
			toolStatus: null,
			toolDurationMs: null,
			toolResult: null,
			sortOrder: 2,
		}),
	);
	store.getState().markToolCallPlaceholder('session_1', 'stream_1', 'captcha_detect');

	store.getState().updatePhase({
		sessionId: 'session_1',
		phase: 'error',
		round: 2,
		maxRounds: 100,
		elapsedMs: 10,
	});

	assert.equal(store.getState().liveMessages.length, 1);
	assert.deepEqual(store.getState().liveMessages[0]?.streamingToolNames, ['captcha_detect']);
	assert.equal(store.getState().liveMessages[0]?.status, 'complete');
});
