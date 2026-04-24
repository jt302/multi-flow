import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('window commands use AppState engine manager recovery helper instead of raw mutex lock', () => {
	const source = readFileSync(new URL('./window_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('state.engine_manager.lock()'), false);
	assert.equal(source.includes('state.lock_engine_manager()'), true);
});
