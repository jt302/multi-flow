import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const defsSource = readFileSync(new URL('./tool_defs.rs', import.meta.url), 'utf8');
const devDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-developer.md', import.meta.url),
	'utf8',
);
const agentDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-agent.md', import.meta.url),
	'utf8',
);

test('captcha solve tool exposes extended provider parameters', () => {
	for (const token of ['gt', 'challenge', 'public_key', 'enterprise_payload', 'user_agent']) {
		assert.equal(defsSource.includes(`"${token}"`), true);
	}
});

test('captcha tool docs mention extended detection fields and strict solve semantics', () => {
	for (const token of ['gt', 'challenge', 'publicKey']) {
		assert.equal(devDocSource.includes(token), true);
		assert.equal(agentDocSource.includes(token), true);
	}
	assert.equal(devDocSource.includes('非空 `solution` token/text'), true);
	assert.equal(agentDocSource.includes('非空 token/text'), true);
});
