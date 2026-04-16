import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('automation canvas window title is localized from frontend instead of hardcoded in tauri', () => {
	const apiSource = readFileSync(
		new URL('../../../entities/automation/api/automation-api.ts', import.meta.url),
		'utf8',
	);
	const tauriSource = readFileSync(
		new URL('../../../../src-tauri/src/commands/automation_canvas_commands.rs', import.meta.url),
		'utf8',
	);

	assert.match(apiSource, /i18next\.t\('automation:canvas\.windowTitle'/);
	assert.doesNotMatch(tauriSource, /流程编辑\s*—/);
});

test('automation canvas step node avoids hardcoded english labels for static canvas copy', () => {
	const stepNodeSource = readFileSync(
		new URL('../../automation-canvas/ui/step-node.tsx', import.meta.url),
		'utf8',
	);
	const nodeDataSource = readFileSync(
		new URL('../../automation-canvas/model/canvas-node-data.ts', import.meta.url),
		'utf8',
	);

	assert.match(stepNodeSource, /automation:canvas\.start/);
	assert.match(nodeDataSource, /automation:canvas\.conditionThen/);
	assert.match(nodeDataSource, /automation:canvas\.conditionElse/);
	assert.match(nodeDataSource, /automation:canvas\.loopBody/);
	assert.match(nodeDataSource, /automation:canvas\.loopNext/);
	assert.doesNotMatch(stepNodeSource, />Start</);
	assert.doesNotMatch(nodeDataSource, /footerLabels:\s*\['then', 'else'\]/);
	assert.doesNotMatch(nodeDataSource, /footerLabels:\s*\['body', 'next'\]/);
});

test('ai chat settings card no longer relies on english fallback copy for missing translations', () => {
	const source = readFileSync(
		new URL('../../settings/ui/ai-chat-settings-card.tsx', import.meta.url),
		'utf8',
	);

	assert.doesNotMatch(source, /Connection Test/);
	assert.doesNotMatch(source, /Model Capabilities/);
	assert.doesNotMatch(source, /Connected/);
});
