import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./general-settings-placeholder.tsx', import.meta.url), 'utf8');
const zh = readFileSync(
	new URL('../../../shared/i18n/locales/zh-CN/settings.json', import.meta.url),
	'utf8',
);
const en = readFileSync(
	new URL('../../../shared/i18n/locales/en-US/settings.json', import.meta.url),
	'utf8',
);

test('general settings exposes manual app update check', () => {
	assert.match(source, /checkAppUpdate/);
	assert.match(source, /installAppUpdate/);
	assert.match(source, /appUpdate/);
});

test('app update settings strings are localized', () => {
	assert.match(zh, /"appUpdate"/);
	assert.match(en, /"appUpdate"/);
	assert.match(zh, /检查更新/);
	assert.match(en, /Check for Updates/);
});
