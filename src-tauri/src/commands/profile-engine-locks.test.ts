import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile command runtime helpers avoid raw engine manager mutex locks', () => {
	const source = readFileSync(new URL('./profile_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('match state.engine_manager.lock()'), false);
	assert.equal(source.includes('state.lock_engine_manager()'), true);
});
