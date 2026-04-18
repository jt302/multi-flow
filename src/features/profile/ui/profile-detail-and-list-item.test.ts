import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('profile list item exposes visual dialog with translated background controls', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("field: 'visual'"), true);
	assert.equal(file.includes("t('profile:visual.backgroundColorLabel')"), true);
	assert.equal(file.includes("t('profile:visual.noBackgroundColor')"), true);
	assert.equal(file.includes("t('profile:visual.customColor')"), true);
});

test('profile list item exposes numeric id and visual inheritance controls', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('numericId'), true);
	assert.equal(file.includes('resolvedToolbarText'), true);
	assert.equal(file.includes('resolvedBrowserBgColor'), true);
	assert.equal(file.includes("t('profile:visual.inheritGroup')"), true);
	assert.equal(file.includes("t('profile:visual.groupNameAndId')"), true);
});

test('profile list table includes a dedicated group column', () => {
	const file = readFileSync(new URL('./profile-list-table.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('list.group')"), true);
});

test('profile list item separates numeric id from chromium label display', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:list.identifier')"), true);
	assert.equal(file.includes("t('profile:list.chromiumLabel')"), true);
	assert.equal(
		file.includes('<Badge variant="outline" className="max-w-[140px] truncate text-[10px]">'),
		false,
	);
});

test('profile list item uses readable foreground in visual preview', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('getReadableForeground'), true);
	assert.equal(file.includes('previewForegroundColor'), true);
	assert.equal(file.includes('previewBadgeStyle'), true);
});

test('profile detail page reveals directories before falling back to openPath', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('revealItemInDir'), true);
	assert.equal(file.includes('await openPath(path);'), true);
});

test('profile detail page disables edit config while profile is running', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('const editConfigDisabled = profile.running;'), true);
	assert.equal(file.includes('disabled={editConfigDisabled}'), true);
	assert.equal(
		file.includes("title={editConfigDisabled ? t('detail.editConfigDisabledRunning') : undefined}"),
		true,
	);
});

test('profile list page adds one-click stop action for all filtered running profiles', () => {
	const pageFile = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');
	const toolbarFile = readFileSync(new URL('./profile-list-toolbar.tsx', import.meta.url), 'utf8');
	const filtersFile = readFileSync(new URL('./profile-list-filters.tsx', import.meta.url), 'utf8');

	assert.equal(pageFile.includes('filteredRunningIds'), true);
	assert.equal(pageFile.includes('ConfirmActionDialog'), true);
	assert.equal(pageFile.includes("t('list.stopAllConfirmDesc'"), true);
	assert.equal(toolbarFile.includes('onStopAllRunning'), true);
	assert.equal(filtersFile.includes("t('common:stopAllRunning')"), true);
});

test('profile list item exposes cookie export actions', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:actions.exportCookie')"), true);
	assert.equal(file.includes("t('profile:actions.exportBySite')"), true);
	assert.equal(file.includes("t('profile:actions.exportAll')"), true);
	assert.equal(file.includes('@tauri-apps/plugin-dialog'), true);
	assert.equal(file.includes('save({'), true);
});

test('profile list item exposes profile plugin management entry', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:actions.pluginManage')"), true);
	assert.equal(file.includes("t('profile:plugins.title')"), true);
	assert.equal(file.includes('updateProfilePlugins'), true);
});

test('advanced settings section exposes cookie json input and merge action', () => {
	const file = readFileSync(new URL('./advanced-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('advanced.cookieJson')"), true);
	assert.equal(file.includes("t('advanced.mergeCookie')"), true);
	assert.equal(file.includes("t('advanced.cookieHelp')"), true);
	assert.equal(file.includes("t('advanced.mergeCookieDesc')"), true);
});

test('profile create form includes plugin selection section', () => {
	const file = readFileSync(new URL('./profile-create-form.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('PluginsSettingsSection'), true);
	assert.equal(file.includes('pluginPackagesQuery'), true);
});

test('group form dialog exposes visual defaults editor', () => {
	const file = readFileSync(new URL('../../group/ui/group-form-dialog.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('toolbarLabelMode'), true);
	assert.equal(file.includes('browserBgColor'), true);
	assert.equal(file.includes("t('group:form.visualSectionTitle')"), true);
	assert.equal(file.includes("t('group:form.browserBgColorDefault')"), true);
});

test('basic settings section clears browser color errors when leaving custom mode', () => {
	const file = readFileSync(new URL('./basic-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("clearErrors('browserBgColor')"), true);
	assert.equal(file.includes("shouldValidate: nextMode === 'custom'"), true);
});

test('plugins page exposes proxy selector for download and update actions', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('useProxiesQuery'), true);
	assert.equal(file.includes("t('downloadCrx.proxyNone')"), true);
	assert.equal(file.includes('selectedDownloadProxyId'), true);
	assert.equal(file.includes('readPluginDownloadPreference'), true);
	assert.equal(file.includes('updatePluginDownloadPreference'), true);
});

test('plugins page renders plugin icon and name in library cards', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('plugin.iconPath'), true);
	assert.equal(file.includes("t('library.iconAlt', { name: plugin.name })"), true);
	assert.equal(file.includes('<img'), true);
	assert.equal(file.includes('convertFileSrc'), true);
});

test('plugins page exposes open-in-store action', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('library.openInStore')"), true);
	assert.equal(file.includes('@tauri-apps/plugin-opener'), true);
	assert.equal(file.includes('plugin.storeUrl'), true);
});

test('tauri config enables asset protocol for app data icons', () => {
	const file = readFileSync(
		new URL('../../../../src-tauri/tauri.conf.json', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes('"assetProtocol"'), true);
	assert.equal(file.includes('"enable": true'), true);
	assert.equal(file.includes('"$APPDATA/**"'), true);
});

test('tauri bundle includes default skills resources', () => {
	const file = readFileSync(
		new URL('../../../../src-tauri/tauri.conf.json', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes('"resources"'), true);
	assert.equal(file.includes('"../docs/default-skills"'), true);
	assert.equal(file.includes('"default-skills"'), true);
});
