import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
	new URL('./settings-page.tsx', import.meta.url),
	'utf8',
);

test('settings page derives section content from route instead of local tab state', () => {
	assert.doesNotMatch(source, /mf_settings_tab/);
	assert.doesNotMatch(source, /localStorage\.getItem\('mf_settings_tab'\)/);
	assert.doesNotMatch(source, /settingsTabs\.map/);
	assert.doesNotMatch(source, /setActiveTab/);
	assert.match(source, /activeTab,/);
	assert.match(source, /activeTabItem/);
});
