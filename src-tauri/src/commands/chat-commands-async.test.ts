import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('chat send command spawns background generation instead of awaiting the whole loop inline', () => {
	const source = readFileSync(new URL('./chat_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('tauri::async_runtime::spawn(async move {'), true);
	assert.equal(source.includes('ChatExecutionService::send_message('), true);
});
