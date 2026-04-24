import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildDefaultEdges,
	flattenControlFlowTree,
	serializeControlFlowGraph,
} from './canvas-helpers.ts';

test('buildDefaultEdges stops wiring steps after a terminal browser close step', () => {
	const edges = buildDefaultEdges([
		{ kind: 'cdp_navigate', url: 'https://example.com' },
		{ kind: 'magic_safe_quit' },
		{ kind: 'cdp_click', selector: '#after-close' },
	] as const);

	assert.deepEqual(
		edges.map((edge) => ({ source: edge.source, target: edge.target })),
		[{ source: 'step-0', target: 'step-1' }],
	);
});

test('flattenControlFlowTree keeps steps after magic_safe_quit disconnected', () => {
	const { edges } = flattenControlFlowTree([
		{ kind: 'cdp_navigate', url: 'https://example.com' },
		{ kind: 'magic_safe_quit' },
		{ kind: 'cdp_click', selector: '#after-close' },
	] as const);

	assert.deepEqual(
		edges.map((edge) => ({ source: edge.source, target: edge.target })),
		[{ source: 'step-0', target: 'step-1' }],
	);
});

test('serializeControlFlowGraph strips outgoing edges from magic_safe_quit', () => {
	const result = serializeControlFlowGraph(
		[
			{ kind: 'cdp_navigate', url: 'https://example.com' },
			{ kind: 'magic_safe_quit' },
			{ kind: 'cdp_click', selector: '#after-close' },
		] as const,
		[
			{
				id: 'e-0-1',
				source: 'step-0',
				target: 'step-1',
				type: 'smoothstep',
			},
			{
				id: 'e-1-2',
				source: 'step-1',
				target: 'step-2',
				type: 'smoothstep',
			},
		],
		{},
		'step-0',
	);

	assert.deepEqual(result.nestedSteps, [
		{ kind: 'cdp_navigate', url: 'https://example.com' },
		{ kind: 'magic_safe_quit' },
	]);
	assert.deepEqual(result.orphanedSteps, [{ kind: 'cdp_click', selector: '#after-close' }]);
	assert.deepEqual(
		result.remappedEdges.map((edge) => ({ source: edge.source, target: edge.target })),
		[{ source: 'step-0', target: 'step-1' }],
	);
});
