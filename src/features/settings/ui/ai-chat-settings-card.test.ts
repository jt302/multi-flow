import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('ai chat settings card disables config selects when no AI configs are available', () => {
	const source = readFileSync(new URL('./ai-chat-settings-card.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('const hasConfigs = configs.length > 0;'), true);
	assert.equal(source.includes('disabled={!hasConfigs}'), true);
	assert.equal(source.includes("t('aiChatSettings.noConfigs')"), true);
});
