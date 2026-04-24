import assert from 'node:assert/strict';
import test from 'node:test';

import {
	formatDisplayMonitorName,
	formatDisplayMonitorOptionLabel,
} from './display-monitor-label.ts';
import type { DisplayMonitorItem } from './types.ts';

function createMonitor(overrides: Partial<DisplayMonitorItem> = {}): DisplayMonitorItem {
	return {
		id: 'display-1',
		name: '',
		isPrimary: false,
		isBuiltin: false,
		friendlyName: null,
		manufacturer: null,
		model: null,
		hostDeviceName: null,
		scaleFactor: 2,
		positionX: 0,
		positionY: 0,
		width: 3024,
		height: 1964,
		workArea: {
			x: 0,
			y: 0,
			width: 1512,
			height: 944,
		},
		...overrides,
	};
}

function t(key: string) {
	switch (key) {
		case 'window:arrange.builtinDisplay':
			return '内置屏幕';
		case 'window:arrange.monitorFallback':
			return '显示器';
		case 'window:arrange.primaryMonitor':
			return '主显示器';
		default:
			return key;
	}
}

test('formatDisplayMonitorName prefers host device label for built-in displays', () => {
	const label = formatDisplayMonitorName(
		createMonitor({
			isBuiltin: true,
			hostDeviceName: 'MacBook Pro',
			friendlyName: 'Built-in Retina Display',
		}),
		t,
	);

	assert.equal(label, 'MacBook Pro 内置屏幕');
});

test('formatDisplayMonitorName falls back to friendly name for external displays', () => {
	const label = formatDisplayMonitorName(
		createMonitor({
			friendlyName: 'Dell U2720Q',
			name: '\\\\.\\DISPLAY1',
		}),
		t,
	);

	assert.equal(label, 'Dell U2720Q');
});

test('formatDisplayMonitorName falls back to manufacturer and model before legacy name', () => {
	const label = formatDisplayMonitorName(
		createMonitor({
			manufacturer: 'LG',
			model: '27UL850',
			name: 'Display 1',
		}),
		t,
	);

	assert.equal(label, 'LG 27UL850');
});

test('formatDisplayMonitorName uses localized resolution fallback when monitor metadata is empty', () => {
	const label = formatDisplayMonitorName(
		createMonitor({
			width: 2560,
			height: 1440,
		}),
		t,
	);

	assert.equal(label, '2560×1440 显示器');
});

test('formatDisplayMonitorOptionLabel keeps resolution single and appends primary marker', () => {
	const label = formatDisplayMonitorOptionLabel(
		createMonitor({
			isPrimary: true,
			width: 2560,
			height: 1440,
		}),
		t,
	);

	assert.equal(label, '2560×1440 显示器 (主显示器)');
});
