import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildRpaEditorStandaloneSearch,
	parseRpaEditorSearch,
	RPA_FLOWS_UPDATED_EVENT,
} from './rpa-editor-window.ts';

test('buildRpaEditorStandaloneSearch outputs create mode query', () => {
	assert.equal(buildRpaEditorStandaloneSearch(), '?standalone=rpa-editor&mode=create');
});

test('buildRpaEditorStandaloneSearch outputs flow query for existing editor', () => {
	assert.equal(
		buildRpaEditorStandaloneSearch('flow_123'),
		'?standalone=rpa-editor&flowId=flow_123',
	);
});

test('parseRpaEditorSearch reads create mode and flow id', () => {
	assert.deepEqual(parseRpaEditorSearch('?mode=create&flowId=flow_123'), {
		createMode: true,
		flowId: 'flow_123',
	});
});

test('RPA flow update event stays stable', () => {
	assert.equal(RPA_FLOWS_UPDATED_EVENT, 'rpa:flows-updated');
});
