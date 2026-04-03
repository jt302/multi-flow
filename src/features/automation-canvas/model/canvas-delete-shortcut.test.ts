import assert from 'node:assert/strict';
import test from 'node:test';

import type { Edge, Node } from '@xyflow/react';

import { START_NODE_ID } from './canvas-helpers.ts';
import { resolveCanvasDeleteTargets } from './canvas-delete-shortcut.ts';

test('resolveCanvasDeleteTargets prefers selected step nodes over edges', () => {
	const result = resolveCanvasDeleteTargets(
		[
			{ id: START_NODE_ID, selected: true } as Node,
			{ id: 'step-0', selected: true } as Node,
		],
		[{ id: 'e-0-1', selected: true } as Edge],
		null,
	);

	assert.deepEqual(result, { nodeIds: ['step-0'], edgeIds: [] });
});

test('resolveCanvasDeleteTargets returns selected edges including the start edge', () => {
	const result = resolveCanvasDeleteTargets(
		[],
		[
			{ id: 'e-start-step-0', selected: true, source: START_NODE_ID, target: 'step-0' } as Edge,
		],
		null,
	);

	assert.deepEqual(result, { nodeIds: [], edgeIds: ['e-start-step-0'] });
});

test('resolveCanvasDeleteTargets falls back to the last clicked edge when selection is missing', () => {
	const result = resolveCanvasDeleteTargets([], [], 'e-0-1');

	assert.deepEqual(result, { nodeIds: [], edgeIds: ['e-0-1'] });
});
