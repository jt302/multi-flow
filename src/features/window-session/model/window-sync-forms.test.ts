import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

import zhWindow from '@/shared/i18n/locales/zh-CN/window.json';

import {
	arrangeWindowsFormSchema,
	getWindowSyncStartValidation,
	syncTextFormSchema,
	windowBoundsBatchFormSchema,
} from './window-sync-forms.ts';

await i18next.init({
	lng: 'zh-CN',
	fallbackLng: 'zh-CN',
	defaultNS: 'window',
	resources: {
		'zh-CN': {
			window: zhWindow,
		},
	},
});

test('getWindowSyncStartValidation only requires correct master and slave selection', () => {
	const validWithoutProbe = getWindowSyncStartValidation(['pf_1', 'pf_2'], 'pf_1');
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

test('arrangeWindowsFormSchema ignores blank inactive layout fields for main sidebar mode', () => {
	const result = arrangeWindowsFormSchema.safeParse({
		monitorId: 'display-1',
		mode: 'main_with_sidebar',
		rows: '',
		columns: '',
		width: '',
		height: '',
		gapX: 16,
		gapY: 16,
		paddingTop: 12,
		paddingRight: 12,
		paddingBottom: 12,
		paddingLeft: 12,
		lastRowAlign: 'stretch',
		flow: 'row_major',
		cascadeStep: 32,
		mainRatio: 0.66,
		mainPosition: 'left',
		order: 'selection',
		chromeDecorationCompensation: 'auto',
	});
	assert.equal(result.success, true);
});
