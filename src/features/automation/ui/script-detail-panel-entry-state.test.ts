import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('script detail panel surfaces a disconnected entry badge and helper copy', () => {
	const detailPanel = readFileSync(
		new URL('./script-detail-panel.tsx', import.meta.url),
		'utf8',
	);
	const stepsViewer = readFileSync(
		new URL('./script-steps-viewer.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(detailPanel.includes('入口未连接'), true);
	assert.equal(stepsViewer.includes('Start 未连接任何步骤'), true);
});
