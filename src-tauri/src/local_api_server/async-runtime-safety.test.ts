import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('local api server avoids reqwest blocking client in async runtime paths', () => {
	const source = readFileSync(new URL('./mod.rs', import.meta.url), 'utf8');
	const profileCommands = readFileSync(
		new URL('../commands/profile_commands.rs', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes('reqwest::blocking::Client'), false);
	assert.equal(source.includes('use reqwest::Client;'), true);
	assert.equal(source.includes('crate::runtime_compat::block_on_compat'), true);
	assert.equal(profileCommands.includes('reqwest::blocking::Client'), false);
});
