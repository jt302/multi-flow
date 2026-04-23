import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getPluginUpdateActionLabelKey,
	getPluginUpdateCheckToastKey,
	getPluginUpdatePackageToastKey,
	getPluginUpdateStatusLabelKey,
} from './plugin-update-status';

test('plugin update status maps to localized label keys', () => {
	assert.equal(
		getPluginUpdateStatusLabelKey('up_to_date'),
		'library.updateStatuses.upToDate',
	);
	assert.equal(
		getPluginUpdateStatusLabelKey('update_available'),
		'library.updateStatuses.updateAvailable',
	);
	assert.equal(getPluginUpdateStatusLabelKey('error'), 'library.updateStatuses.error');
	assert.equal(
		getPluginUpdateStatusLabelKey('unknown'),
		'library.updateStatuses.unknown',
	);
	assert.equal(
		getPluginUpdateStatusLabelKey(undefined),
		'library.updateStatuses.unknown',
	);
});

test('plugin update check toast maps to status-specific localized keys', () => {
	assert.equal(
		getPluginUpdateCheckToastKey('up_to_date'),
		'library.updateCheckToast.upToDate',
	);
	assert.equal(
		getPluginUpdateCheckToastKey('update_available'),
		'library.updateCheckToast.updateAvailable',
	);
	assert.equal(getPluginUpdateCheckToastKey('error'), 'library.updateCheckToast.error');
	assert.equal(
		getPluginUpdateCheckToastKey('unknown'),
		'library.updateCheckToast.unknown',
	);
	assert.equal(
		getPluginUpdateCheckToastKey(undefined),
		'library.updateCheckToast.unknown',
	);
});

test('plugin update package toast maps to status-specific localized keys', () => {
	assert.equal(
		getPluginUpdatePackageToastKey('up_to_date'),
		'library.updatePackageToast.updated',
	);
	assert.equal(
		getPluginUpdatePackageToastKey('update_available'),
		'library.updatePackageToast.stillUpdateAvailable',
	);
	assert.equal(
		getPluginUpdatePackageToastKey('error'),
		'library.updatePackageToast.statusCheckFailed',
	);
	assert.equal(
		getPluginUpdatePackageToastKey('unknown'),
		'library.updatePackageToast.statusUnknown',
	);
	assert.equal(
		getPluginUpdatePackageToastKey(undefined),
		'library.updatePackageToast.statusUnknown',
	);
});

test('plugin update action label maps to status-specific localized keys', () => {
	assert.equal(
		getPluginUpdateActionLabelKey('update_available'),
		'library.updatePluginActions.update',
	);
	assert.equal(
		getPluginUpdateActionLabelKey('up_to_date'),
		'library.updatePluginActions.redownload',
	);
	assert.equal(
		getPluginUpdateActionLabelKey('error'),
		'library.updatePluginActions.checkAndUpdate',
	);
	assert.equal(
		getPluginUpdateActionLabelKey('unknown'),
		'library.updatePluginActions.checkAndUpdate',
	);
	assert.equal(
		getPluginUpdateActionLabelKey(undefined),
		'library.updatePluginActions.checkAndUpdate',
	);
});
