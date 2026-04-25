import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function extractFunctionBody(source: string, name: string): string {
	const start = source.indexOf(`fn ${name}(`);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = source.indexOf('{', start);
	assert.notEqual(bodyStart, -1, `${name} should have a body`);
	let depth = 0;
	for (let i = bodyStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(bodyStart, i + 1);
		}
	}
	throw new Error(`${name} body not closed`);
}

test('automation ai config loader uses shared global default resolver', () => {
	const source = readFileSync(new URL('./automation_commands.rs', import.meta.url), 'utf8');
	const body = extractFunctionBody(source, 'load_ai_config');

	assert.equal(body.includes('.resolve_ai_provider_config(ai_config_id.map(String::as_str))'), true);
	assert.equal(body.includes('find_ai_config_by_id'), false);
	assert.equal(body.includes('read_ai_provider_config().unwrap_or_default()'), false);
});
