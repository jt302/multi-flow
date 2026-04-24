import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('chat execution loads enabled skills globally instead of from session state', () => {
	const executionSource = readFileSync(
		new URL('../services/chat_execution_service.rs', import.meta.url),
		'utf8',
	);
	const commandsSource = readFileSync(new URL('./chat_commands.rs', import.meta.url), 'utf8');

	assert.equal(executionSource.includes('list_enabled_skill_slugs()'), true);
	assert.equal(executionSource.includes('enabled_skill_slugs: &[String]'), false);
	assert.equal(commandsSource.includes('session.enabled_skill_slugs'), false);
	assert.equal(commandsSource.includes('&enabled_skill_slugs'), false);
});
