import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('mcp commands accept payload args to match frontend tauri invoke contract', () => {
	const source = readFileSync(new URL('./mcp_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('payload: CreateMcpServerRequest'), true);
	assert.equal(source.includes('.create_server(payload)'), true);
	assert.equal(source.includes('payload: UpdateMcpServerRequest'), true);
	assert.equal(source.includes('.update_server(&id, payload)'), true);
	assert.equal(source.includes('req: CreateMcpServerRequest'), false);
	assert.equal(source.includes('req: UpdateMcpServerRequest'), false);
});
