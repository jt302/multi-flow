import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('ai agent properties use translated labels and hide tool category picker', () => {
	const source = readFileSync(new URL('./step-properties-panel.tsx', import.meta.url), 'utf8');
	const commandSource = readFileSync(
		new URL('../../../../src-tauri/src/commands/automation_commands.rs', import.meta.url),
		'utf8',
	);
	const zh = JSON.parse(
		readFileSync(
			new URL('../../../shared/i18n/locales/zh-CN/automation.json', import.meta.url),
			'utf8',
		),
	);
	const en = JSON.parse(
		readFileSync(
			new URL('../../../shared/i18n/locales/en-US/automation.json', import.meta.url),
			'utf8',
		),
	);

	assert.equal(zh.fields.prompt, '提示词');
	assert.equal(zh.fields.formatText, '纯文本');
	assert.equal(en.fields.prompt, 'Prompt');
	assert.equal(en.fields.formatText, 'Plain Text');

	const aiAgentBranch = source.slice(
		source.indexOf("kind === 'ai_agent'"),
		source.indexOf("kind === 'ai_judge'"),
	);
	assert.equal(aiAgentBranch.includes('toolCategoriesField()'), false);

	const aiAgentCommandBranch = commandSource.slice(
		commandSource.indexOf('ScriptStep::AiAgent'),
		commandSource.indexOf('ScriptStep::AiJudge'),
	);
	assert.equal(aiAgentCommandBranch.includes('ToolFilter::with_categories'), false);
});

test('ai judge also hides tool category picker and uses all tools', () => {
	const source = readFileSync(new URL('./step-properties-panel.tsx', import.meta.url), 'utf8');
	const commandSource = readFileSync(
		new URL('../../../../src-tauri/src/commands/automation_commands.rs', import.meta.url),
		'utf8',
	);

	const aiJudgeBranch = source.slice(
		source.indexOf("kind === 'ai_judge'"),
		source.indexOf("kind === 'magic_open_new_tab'"),
	);
	assert.equal(aiJudgeBranch.includes('toolCategoriesField()'), false);

	const aiJudgeCommandBranch = commandSource.slice(
		commandSource.indexOf('ScriptStep::AiJudge'),
		commandSource.indexOf('// 自动注入当前页面截图', commandSource.indexOf('ScriptStep::AiJudge')),
	);
	assert.equal(aiJudgeCommandBranch.includes('ToolFilter::with_categories'), false);
});
