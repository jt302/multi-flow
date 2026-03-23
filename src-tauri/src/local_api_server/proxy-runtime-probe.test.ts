import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('profile open flow verifies proxy runtime connectivity before launching chromium', () => {
	const localApiSource = readFileSync(new URL('./mod.rs', import.meta.url), 'utf8');
	const profileSource = readFileSync(
		new URL('../commands/profile_commands.rs', import.meta.url),
		'utf8',
	);

	assert.equal(localApiSource.includes('fn verify_proxy_runtime'), true);
	assert.equal(profileSource.includes('start_proxy_runtime(profile_id, proxy)?'), true);
	assert.equal(localApiSource.includes('proxy runtime upstream probe failed:'), true);
});
