import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildCanvasDataJson,
	buildStartEdge,
	parseCanvasData,
	START_NODE_ID,
	serializeControlFlowGraph,
} from './canvas-helpers.ts';

test('buildStartEdge keeps the start connection deletable for manual graph editing', () => {
	assert.equal(buildStartEdge('step-0').deletable, true);
});

test('buildCanvasDataJson stores start edge target separately from persisted step edges', () => {
	const json = buildCanvasDataJson(
		{
			[START_NODE_ID]: { x: 120, y: 24 },
			'step-0': { x: 200, y: 120 },
		},
		[
			buildStartEdge('step-0'),
			{
				id: 'e-0-1',
				source: 'step-0',
				target: 'step-1',
				type: 'smoothstep',
			},
		],
	);
	const parsed = JSON.parse(json) as {
		startEdgeTarget: string | null;
		edges: Array<{ id: string; source: string; target: string; sourceHandle: string | null }>;
	};

	assert.equal(parsed.startEdgeTarget, 'step-0');
	assert.deepEqual(parsed.edges, [
		{
			id: 'e-0-1',
			source: 'step-0',
			target: 'step-1',
			sourceHandle: null,
		},
	]);
});

test('parseCanvasData preserves an explicitly deleted start edge', () => {
	const parsed = parseCanvasData(
		JSON.stringify({
			positions: { 'step-0': { x: 200, y: 120 } },
			edges: [],
			startEdgeTarget: null,
		}),
		1,
	);

	assert.equal(parsed.startEdgeTarget, null);
	assert.deepEqual(parsed.edges, []);
	assert.equal(parsed.edgesFromSave, true);
});

test('serializeControlFlowGraph does not rebuild a deleted continuation edge', () => {
	const result = serializeControlFlowGraph(
		[{ kind: 'cdp_type', text: 'hello' }, { kind: 'cdp_click' }] as never,
		[],
		{},
	);

	assert.deepEqual(result.remappedEdges, []);
	assert.equal(result.orphanedCount, 1);
});
