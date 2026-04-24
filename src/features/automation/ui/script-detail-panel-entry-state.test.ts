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

	assert.equal(detailPanel.includes("t('detail.entryNotConnected')"), true);
	assert.equal(stepsViewer.includes("t('common:entryNotConnectedHint')"), true);
});
