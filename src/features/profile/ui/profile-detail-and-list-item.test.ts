import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('profile list item edits background color inside dialog and offers reset action', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('<Dialog open={isBgEditing}'), true);
	assert.equal(file.includes('重置背景色'), true);
	assert.equal(file.includes('恢复默认表现'), true);
});

test('profile detail page reveals directories before falling back to openPath', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('revealItemInDir'), true);
	assert.equal(file.includes('await openPath(path);'), true);
});

test('profile list page adds one-click stop action for all filtered running profiles', () => {
	const pageFile = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');
	const toolbarFile = readFileSync(new URL('./profile-list-toolbar.tsx', import.meta.url), 'utf8');
	const filtersFile = readFileSync(new URL('./profile-list-filters.tsx', import.meta.url), 'utf8');

	assert.equal(pageFile.includes('filteredRunningIds'), true);
	assert.equal(pageFile.includes('ConfirmActionDialog'), true);
	assert.equal(pageFile.includes('确认停止当前筛选结果中的'), true);
	assert.equal(toolbarFile.includes('onStopAllRunning'), true);
	assert.equal(filtersFile.includes('一键停止运行中'), true);
});

test('profile list item exposes cookie export actions', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('导出 Cookie'), true);
	assert.equal(file.includes('按站点导出'), true);
	assert.equal(file.includes('导出整个 profile'), true);
	assert.equal(file.includes('@tauri-apps/plugin-dialog'), true);
	assert.equal(file.includes('save({'), true);
});

test('profile list item exposes profile plugin management entry', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('插件管理'), true);
	assert.equal(file.includes('环境插件管理'), true);
	assert.equal(file.includes('updateProfilePlugins'), true);
});

test('advanced settings section exposes cookie json input and merge action', () => {
	const file = readFileSync(new URL('./advanced-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('Cookie JSON'), true);
	assert.equal(file.includes('合并 Cookie'), true);
	assert.equal(file.includes('cookie-state-file'), true);
	assert.equal(file.includes('环境本地 Cookie 文件'), true);
});

test('profile create form includes plugin selection section', () => {
	const file = readFileSync(new URL('./profile-create-form.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('PluginsSettingsSection'), true);
	assert.equal(file.includes('pluginPackagesQuery'), true);
});

test('plugins page exposes proxy selector for download and update actions', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('useProxiesQuery'), true);
	assert.equal(file.includes('下载代理'), true);
	assert.equal(file.includes('selectedDownloadProxyId'), true);
	assert.equal(file.includes('readPluginDownloadPreference'), true);
	assert.equal(file.includes('updatePluginDownloadPreference'), true);
});

test('plugins page renders plugin icon and name in library cards', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('plugin.iconPath'), true);
	assert.equal(file.includes('plugin.name} 图标'), true);
	assert.equal(file.includes('<img'), true);
	assert.equal(file.includes('convertFileSrc'), true);
});

test('plugins page exposes open-in-store action', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('在商店中打开'), true);
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
