import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const defsSource = readFileSync(new URL('./tool_defs.rs', import.meta.url), 'utf8');
const modSource = readFileSync(new URL('./mod.rs', import.meta.url), 'utf8');
const skillToolsSource = readFileSync(new URL('./skill_tools.rs', import.meta.url), 'utf8');
const commandsSource = readFileSync(
	new URL('../../commands/ai_skill_commands.rs', import.meta.url),
	'utf8',
);
const libSource = readFileSync(new URL('../../lib.rs', import.meta.url), 'utf8');
const devDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-developer.md', import.meta.url),
	'utf8',
);
const agentDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-agent.md', import.meta.url),
	'utf8',
);

test('skill install is registered for both ai tools and tauri commands', () => {
	assert.equal(defsSource.includes('"skill_install"'), true);
	assert.equal(skillToolsSource.includes('"skill_install"'), true);
	assert.equal(commandsSource.includes('install_ai_skill'), true);
	assert.equal(libSource.includes('commands::ai_skill_commands::install_ai_skill'), true);
	assert.equal(modSource.includes('"skill_install"'), true);
});

test('ai tool docs mention skill install support', () => {
	assert.equal(devDocSource.includes('skill_install'), true);
	assert.equal(agentDocSource.includes('skill_install'), true);
});

test('session skill binding entrypoints are removed', () => {
	assert.equal(defsSource.includes('"skill_enable_for_session"'), false);
	assert.equal(skillToolsSource.includes('"skill_enable_for_session"'), false);
	assert.equal(commandsSource.includes('set_session_skills'), false);
	assert.equal(libSource.includes('commands::ai_skill_commands::set_session_skills'), false);
	assert.equal(devDocSource.includes('skill_enable_for_session'), false);
	assert.equal(agentDocSource.includes('skill_enable_for_session'), false);
});

test('skill install docs no longer describe session auto-enable behavior', () => {
	assert.equal(devDocSource.includes('自动启用到当前 session'), false);
	assert.equal(agentDocSource.includes('启用 skill 列表'), false);
});
