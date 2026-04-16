import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStepNodeData } from './canvas-node-data.ts';

test('buildStepNodeData precomputes canvas display fields for confirm dialog nodes', () => {
	const data = buildStepNodeData(
		{
			kind: 'confirm_dialog',
			title: '是否继续执行当前流程',
			buttons: [
				{ text: '继续', value: 'continue' },
				{ text: '停止', value: 'stop' },
			],
		} as never,
		3,
		'waiting_human',
	);

	assert.equal(data.index, 3);
	assert.equal(data.label.length > 0, true);
	assert.equal(data.groupLabel.length > 0, true);
	assert.equal(data.stepStatus, 'waiting_human');
	assert.equal(data.summary.includes('是否继续执行当前流程'), true);
	assert.equal(data.isTerminal, false);
	assert.deepEqual(
		data.sourceHandles.map((handle) => handle.id),
		['btn_0', 'btn_1', null],
	);
	assert.deepEqual(data.footerLabels, ['继续', '停止']);
});

test('buildStepNodeData marks terminal steps without output handles', () => {
	const data = buildStepNodeData(
		{
			kind: 'end',
			message: '流程结束',
		} as never,
		1,
	);

	assert.equal(data.isTerminal, true);
	assert.deepEqual(data.sourceHandles, []);
	assert.equal(data.summary.includes('流程结束'), true);
});
