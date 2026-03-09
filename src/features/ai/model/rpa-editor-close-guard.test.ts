import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildComparableFlowDraft,
	hasPendingFlowChanges,
	resolveRpaEditorLeaveMode,
} from './rpa-editor-close-guard.ts';
import { RPA_FLOWS_UPDATED_EVENT } from './rpa-editor-window.ts';

test('hasPendingFlowChanges returns false for equivalent draft snapshots', () => {
	const baseline = buildComparableFlowDraft(
		{
			name: 'Lead flow',
			note: '  collect leads ',
			concurrencyLimit: 3,
			variablesText: 'landingUrl|Landing URL|true|https://example.com',
			defaultTargetProfileIds: ['pf_b', 'pf_a'],
		},
		[
			{
				id: 'node_open',
				position: { x: 40, y: 120 },
				data: { kind: 'open_profile', config: {} },
			},
		] as never,
		[],
	);
	const current = buildComparableFlowDraft(
		{
			name: 'Lead flow',
			note: 'collect leads',
			concurrencyLimit: 3,
			variablesText: 'landingUrl|Landing URL|true|https://example.com',
			defaultTargetProfileIds: ['pf_a', 'pf_b'],
		},
		[
			{
				id: 'node_open',
				position: { x: 40, y: 120 },
				data: { kind: 'open_profile', config: {} },
			},
		] as never,
		[],
	);

	assert.equal(hasPendingFlowChanges(current, baseline), false);
});

test('hasPendingFlowChanges returns true when graph changes', () => {
	const baseline = buildComparableFlowDraft(
		{
			name: 'Lead flow',
			note: '',
			concurrencyLimit: 3,
			variablesText: '',
			defaultTargetProfileIds: [],
		},
		[
			{
				id: 'node_open',
				position: { x: 40, y: 120 },
				data: { kind: 'open_profile', config: {} },
			},
		] as never,
		[],
	);
	const current = buildComparableFlowDraft(
		{
			name: 'Lead flow',
			note: '',
			concurrencyLimit: 3,
			variablesText: '',
			defaultTargetProfileIds: [],
		},
		[
			{
				id: 'node_open',
				position: { x: 40, y: 120 },
				data: { kind: 'open_profile', config: {} },
			},
			{
				id: 'node_end',
				position: { x: 220, y: 120 },
				data: { kind: 'success_end', config: {} },
			},
		] as never,
		[],
	);

	assert.equal(hasPendingFlowChanges(current, baseline), true);
});

test('resolveRpaEditorLeaveMode closes standalone editor windows', () => {
	assert.equal(resolveRpaEditorLeaveMode('rpa-flow-editor'), 'close-window');
	assert.equal(resolveRpaEditorLeaveMode('main'), 'navigate-main');
});

test('rpa flows updated event name is stable for cross-window refresh', () => {
	assert.equal(RPA_FLOWS_UPDATED_EVENT, 'rpa:flows-updated');
});
