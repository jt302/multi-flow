import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('chat send command spawns background generation instead of awaiting the whole loop inline', () => {
	const source = readFileSync(new URL('./chat_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('tauri::async_runtime::spawn(async move {'), true);
	assert.equal(source.includes('ChatExecutionService::send_message('), true);
});

test('chat send command resolves global ai config through default config id', () => {
	const source = readFileSync(new URL('./chat_commands.rs', import.meta.url), 'utf8');
	const start = source.indexOf('pub async fn send_chat_message(');
	const end = source.indexOf('// 全局提示词', start);
	const body = source.slice(start, end);

	assert.equal(body.includes('.resolve_ai_provider_config(ai_config_id.as_deref())'), true);
	assert.equal(body.includes('.list_ai_configs()'), false);
	assert.equal(body.includes('.next()'), false);
});
