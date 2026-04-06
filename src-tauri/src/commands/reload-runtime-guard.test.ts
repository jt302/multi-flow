import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function extractFunctionBody(source: string, fnName: string): string {
	const signature = new RegExp(`pub(?: async)? fn ${fnName}\\s*\\(`);
	const signatureMatch = signature.exec(source);
	assert.notEqual(signatureMatch, null, `expected to find function ${fnName}`);

	const startIndex = source.indexOf('{', signatureMatch!.index);
	assert.notEqual(startIndex, -1, `expected ${fnName} to have a body`);

	let depth = 0;
	for (let index = startIndex; index < source.length; index += 1) {
		const char = source[index];
		if (char === '{') {
			depth += 1;
			continue;
		}
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				return source.slice(startIndex + 1, index);
			}
		}
	}

	throw new Error(`failed to extract function body for ${fnName}`);
}

test('reload bootstrap commands avoid inline runtime reconciliation', () => {
	const profileCommands = readFileSync(
		new URL('./profile_commands.rs', import.meta.url),
		'utf8',
	);
	const windowCommands = readFileSync(
		new URL('./window_commands.rs', import.meta.url),
		'utf8',
	);

	const listProfilesBody = extractFunctionBody(profileCommands, 'list_profiles');
	const listOpenProfileWindowsBody = extractFunctionBody(
		windowCommands,
		'list_open_profile_windows',
	);

	assert.equal(
		listProfilesBody.includes('runtime_guard::reconcile_runtime_state'),
		false,
	);
	assert.equal(
		listOpenProfileWindowsBody.includes('runtime_guard::reconcile_runtime_state'),
		false,
	);
});

test('reload bootstrap commands offload synchronous profile queries from the main-thread invoke path', () => {
	const profileCommands = readFileSync(
		new URL('./profile_commands.rs', import.meta.url),
		'utf8',
	);
	const windowCommands = readFileSync(
		new URL('./window_commands.rs', import.meta.url),
		'utf8',
	);
	const syncCommands = readFileSync(
		new URL('./sync_commands.rs', import.meta.url),
		'utf8',
	);
	const groupCommands = readFileSync(
		new URL('./group_commands.rs', import.meta.url),
		'utf8',
	);
	const proxyCommands = readFileSync(
		new URL('./proxy_commands.rs', import.meta.url),
		'utf8',
	);
	const resourceCommands = readFileSync(
		new URL('./resource_commands.rs', import.meta.url),
		'utf8',
	);
	const pluginCommands = readFileSync(
		new URL('./plugin_commands.rs', import.meta.url),
		'utf8',
	);
	const automationCommands = readFileSync(
		new URL('./automation_commands.rs', import.meta.url),
		'utf8',
	);

	assert.equal(profileCommands.includes('pub async fn list_profiles('), true);
	assert.equal(
		extractFunctionBody(profileCommands, 'list_profiles').includes('spawn_blocking'),
		true,
	);

	assert.equal(windowCommands.includes('pub async fn list_open_profile_windows('), true);
	assert.equal(
		extractFunctionBody(windowCommands, 'list_open_profile_windows').includes('spawn_blocking'),
		true,
	);
	assert.equal(syncCommands.includes('pub async fn list_sync_targets('), true);
	assert.equal(
		extractFunctionBody(syncCommands, 'list_sync_targets').includes('spawn_blocking'),
		true,
	);
	assert.equal(groupCommands.includes('pub async fn list_profile_groups('), true);
	assert.equal(
		extractFunctionBody(groupCommands, 'list_profile_groups').includes('spawn_blocking'),
		true,
	);
	assert.equal(proxyCommands.includes('pub async fn list_proxies('), true);
	assert.equal(
		extractFunctionBody(proxyCommands, 'list_proxies').includes('spawn_blocking'),
		true,
	);
	assert.equal(resourceCommands.includes('pub async fn list_resources('), true);
	assert.equal(
		extractFunctionBody(resourceCommands, 'list_resources').includes('spawn_blocking'),
		true,
	);
	assert.equal(pluginCommands.includes('pub async fn list_plugin_packages('), true);
	assert.equal(
		extractFunctionBody(pluginCommands, 'list_plugin_packages').includes('spawn_blocking'),
		true,
	);
	assert.equal(
		automationCommands.includes('pub async fn list_automation_scripts('),
		true,
	);
	assert.equal(
		extractFunctionBody(automationCommands, 'list_automation_scripts').includes(
			'spawn_blocking',
		),
		true,
	);
	assert.equal(automationCommands.includes('pub async fn list_automation_runs('), true);
	assert.equal(
		extractFunctionBody(automationCommands, 'list_automation_runs').includes(
			'spawn_blocking',
		),
		true,
	);
	assert.equal(automationCommands.includes('pub async fn list_ai_configs('), true);
	assert.equal(
		extractFunctionBody(automationCommands, 'list_ai_configs').includes('spawn_blocking'),
		true,
	);
	assert.equal(automationCommands.includes('pub async fn list_captcha_configs('), true);
	assert.equal(
		extractFunctionBody(automationCommands, 'list_captcha_configs').includes(
			'spawn_blocking',
		),
		true,
	);
});
