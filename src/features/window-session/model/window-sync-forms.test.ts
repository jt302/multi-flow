import test from 'node:test';
import assert from 'node:assert/strict';

import {
	arrangeWindowsFormSchema,
	getWindowSyncStartValidation,
	syncTextFormSchema,
	windowBoundsBatchFormSchema,
} from './window-sync-forms.ts';

test('getWindowSyncStartValidation only requires correct master and slave selection', () => {
	const validWithoutProbe = getWindowSyncStartValidation(
		['pf_1', 'pf_2'],
		'pf_1',
	);
	assert.equal(validWithoutProbe.ok, true);
	assert.equal(validWithoutProbe.reason, null);

	const missingMaster = getWindowSyncStartValidation(['pf_1', 'pf_2'], null);
	assert.equal(missingMaster.ok, false);
	assert.equal(missingMaster.reason, '请选择主控环境');
});

test('syncTextFormSchema rejects blank text', () => {
	const result = syncTextFormSchema.safeParse({ text: '   ' });
	assert.equal(result.success, false);
});

test('windowBoundsBatchFormSchema requires positive width and height', () => {
	const result = windowBoundsBatchFormSchema.safeParse({ width: 0, height: 200 });
	assert.equal(result.success, false);
});

test('arrangeWindowsFormSchema accepts monitor selection and mode', () => {
	const result = arrangeWindowsFormSchema.safeParse({
		monitorId: 'display-1',
		mode: 'grid',
		gap: 16,
		width: 1280,
		height: 720,
	});
	assert.equal(result.success, true);
});
