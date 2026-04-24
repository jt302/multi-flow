import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('app installs a panic hook that logs backtraces for poisoned-lock root causes', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('install_panic_hook()'), true);
	assert.equal(source.includes('panic::set_hook'), true);
	assert.equal(source.includes('std::backtrace::Backtrace::force_capture'), true);
	assert.equal(source.includes('logger::error('), true);
});
