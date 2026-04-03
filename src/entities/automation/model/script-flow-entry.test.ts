import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveScriptFlowEntryState } from './script-flow-entry.ts';
import type { AutomationScript } from './types.ts';

function buildScript(overrides: Partial<AutomationScript> = {}): AutomationScript {
	return {
		id: 'script-1',
		name: '测试脚本',
		description: null,
		steps: [{ kind: 'cdp_type', selector: '#q', text: 'hello' }],
		createdAt: 0,
		updatedAt: 0,
		canvasPositionsJson: null,
		variablesSchemaJson: null,
		associatedProfileIds: [],
		aiConfig: null,
		aiConfigId: null,
		settings: undefined,
		...overrides,
	};
}

test('resolveScriptFlowEntryState reports disconnected entry when start edge is removed', () => {
	const state = resolveScriptFlowEntryState(
		buildScript({
			canvasPositionsJson: JSON.stringify({
				positions: { 'step-0': { x: 220, y: 140 } },
				edges: [],
				startEdgeTarget: null,
			}),
		}),
	);

	assert.equal(state.entryConnected, false);
	assert.equal(state.orphanedStepCount, 0);
});

test('resolveScriptFlowEntryState keeps entry connected for legacy canvas data', () => {
	const state = resolveScriptFlowEntryState(
		buildScript({
			canvasPositionsJson: JSON.stringify({
				positions: { 'step-0': { x: 220, y: 140 } },
				edges: [],
			}),
		}),
	);

	assert.equal(state.entryConnected, true);
	assert.equal(state.orphanedStepCount, 0);
});

test('resolveScriptFlowEntryState treats empty scripts as connected', () => {
	const state = resolveScriptFlowEntryState(
		buildScript({
			steps: [],
			canvasPositionsJson: JSON.stringify({
				positions: {},
				edges: [],
				startEdgeTarget: null,
			}),
		}),
	);

	assert.equal(state.entryConnected, true);
	assert.equal(state.orphanedStepCount, 0);
});

test('resolveScriptFlowEntryState reports orphaned step count', () => {
	const state = resolveScriptFlowEntryState(
		buildScript({
			canvasPositionsJson: JSON.stringify({
				positions: { 'step-0': { x: 220, y: 140 } },
				edges: [{ id: 'e-start', source: 'start', target: 'step-0' }],
				startEdgeTarget: 'step-0',
				orphanedSteps: [
					{ kind: 'cdp_click', selector: '#btn' },
					{ kind: 'wait', duration: 1000 },
				],
			}),
		}),
	);

	assert.equal(state.entryConnected, true);
	assert.equal(state.orphanedStepCount, 2);
});
