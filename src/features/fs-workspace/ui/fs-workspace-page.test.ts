import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./fs-workspace-page.tsx', import.meta.url), 'utf8');
const zhLocale = readFileSync(
	new URL('../../../shared/i18n/locales/zh-CN/chat.json', import.meta.url),
	'utf8',
);
const enLocale = readFileSync(
	new URL('../../../shared/i18n/locales/en-US/chat.json', import.meta.url),
	'utf8',
);

test('fs workspace page localizes the default root label instead of rendering backend text directly', () => {
	assert.equal(
		source.includes("root.isDefault ? t('fileSystem.defaultRootLabel') : root.label"),
		true,
	);
	assert.equal(
		source.includes("selectedRoot?.isDefault ? t('fileSystem.defaultRootLabel') : selectedRoot?.label"),
		true,
	);
});

test('fs workspace page localizes the description badge', () => {
	assert.equal(
		source.includes("t('fileSystem.hasDescriptionBadge')"),
		true,
	);
});

test('fs workspace locales include file system root and description badge labels', () => {
	assert.equal(zhLocale.includes('"defaultRootLabel": "AI 沙箱"'), true);
	assert.equal(zhLocale.includes('"hasDescriptionBadge": "说明"'), true);
	assert.equal(enLocale.includes('"defaultRootLabel": "AI Sandbox"'), true);
	assert.equal(enLocale.includes('"hasDescriptionBadge": "Desc"'), true);
});
