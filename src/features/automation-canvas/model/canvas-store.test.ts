import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanvasStore } from './canvas-store.ts';

test('canvas store updates drag positions immediately and only persists when dragging ends', async () => {
	const persistedPositions: string[] = [];
	const scheduled: Array<() => void> = [];
	const store = createCanvasStore(
		{
			id: 'script_drag',
			name: 'drag test',
			steps: [{ kind: 'cdp_click', selector: '#submit' }] as never,
			canvasPositionsJson: null,
			variablesSchemaJson: null,
			settings: null,
		} as never,
		{},
		{
				updateScriptCanvasPositions: async (_scriptId, positionsJson) => {
					persistedPositions.push(positionsJson);
				},
				setTimeoutFn: ((callback: () => void) => {
					scheduled.push(callback);
					return scheduled.length as never;
				}) as unknown as typeof setTimeout,
				clearTimeoutFn: (() => undefined) as typeof clearTimeout,
			},
		);

	store.getState().onNodesChange([
		{
			id: 'step-0',
			type: 'position',
			position: { x: 320, y: 180 },
			dragging: true,
		},
	]);

	assert.deepEqual(store.getState().nodes[1]?.position, { x: 320, y: 180 });
	assert.deepEqual(persistedPositions, []);

	store.getState().onNodesChange([
		{
			id: 'step-0',
			type: 'position',
			position: { x: 360, y: 240 },
			dragging: false,
		},
	]);

	assert.equal(scheduled.length > 0, true);
	const runScheduled = scheduled[scheduled.length - 1];
	await runScheduled?.();
	assert.equal(persistedPositions.length, 1);
	assert.equal(
		String(persistedPositions[0]).indexOf('"step-0":{"x":360,"y":240}') >= 0,
		true,
	);
});

test('canvas store syncLiveStatuses refreshes only the node runtime status payload', () => {
	const store = createCanvasStore(
		{
			id: 'script_status',
			name: 'status test',
			steps: [{ kind: 'cdp_click', selector: '#submit' }] as never,
			canvasPositionsJson: null,
			variablesSchemaJson: null,
			settings: null,
		} as never,
		{},
	);

	const before = store.getState().nodes[1];
	store.getState().syncLiveStatuses({ 0: 'running' });
	const after = store.getState().nodes[1];

	assert.equal(before?.data.index, after?.data.index);
	assert.equal(before?.data.label, after?.data.label);
	assert.equal(after?.data.stepStatus, 'running');
});
