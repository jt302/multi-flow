import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modSource = readFileSync(new URL('./mod.rs', import.meta.url), 'utf8');
const defsSource = readFileSync(new URL('./tool_defs.rs', import.meta.url), 'utf8');
const commonZhSource = readFileSync(
	new URL('../../../../src/shared/i18n/locales/zh-CN/common.json', import.meta.url),
	'utf8',
);
const commonEnSource = readFileSync(
	new URL('../../../../src/shared/i18n/locales/en-US/common.json', import.meta.url),
	'utf8',
);
const toolModalSource = readFileSync(
	new URL('../../../../src/app/ui/tool-confirmation-modal.tsx', import.meta.url),
	'utf8',
);
const devDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-developer.md', import.meta.url),
	'utf8',
);
const agentDocSource = readFileSync(
	new URL('../../../../docs/ai/ai-tools-agent.md', import.meta.url),
	'utf8',
);

test('exec command tool is registered with its own executor module', () => {
	assert.equal(modSource.includes('pub mod exec_tools;'), true);
	assert.equal(modSource.includes('if name == "exec_command"'), true);
	assert.equal(modSource.includes('exec_tools::execute(args, ctx).await'), true);
	assert.equal(defsSource.includes('"exec_command"'), true);
});

test('tool confirmation modal shows cwd and risk reason for command execution', () => {
	assert.equal(toolModalSource.includes('cwd?: string;'), true);
	assert.equal(toolModalSource.includes('riskReason?: string;'), true);
	assert.equal(commonZhSource.includes('"cwd"'), true);
	assert.equal(commonZhSource.includes('"riskReason"'), true);
	assert.equal(commonEnSource.includes('"cwd"'), true);
	assert.equal(commonEnSource.includes('"riskReason"'), true);
});

test('ai tool docs mention exec command support', () => {
	assert.equal(devDocSource.includes('exec_command'), true);
	assert.equal(agentDocSource.includes('exec_command'), true);
});
