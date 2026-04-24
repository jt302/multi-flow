import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./settings-page.tsx', import.meta.url), 'utf8');

test('settings page derives section content from route instead of local tab state', () => {
	assert.doesNotMatch(source, /mf_settings_tab/);
	assert.doesNotMatch(source, /localStorage\.getItem\('mf_settings_tab'\)/);
	assert.doesNotMatch(source, /settingsTabs\.map/);
	assert.doesNotMatch(source, /setActiveTab/);
	assert.match(source, /activeTab,/);
	assert.match(source, /activeTabItem/);
});

test('settings page lazy loads tab bodies instead of bundling every settings panel', () => {
	assert.match(source, /lazy\(/);
	assert.match(source, /<Suspense/);
	assert.doesNotMatch(source, /import \{ AiProviderConfigCard \}/);
	assert.doesNotMatch(source, /import \{ ResourceManagementCard \}/);
	assert.doesNotMatch(source, /import \{ RecycleBinRoutePage \}/);
	assert.doesNotMatch(source, /import \{ DevConfigCard \}/);
});

test('settings page lazy tab fallback shows an explicit loading state', () => {
	assert.match(source, /SettingsTabLoadingFallback/);
	assert.match(source, /role="status"/);
	assert.match(source, /animate-spin/);
	assert.doesNotMatch(
		source,
		/fallback=\{<div className="min-h-40 rounded-xl border border-border\/60 bg-muted\/20" \/>\}/,
	);
});
