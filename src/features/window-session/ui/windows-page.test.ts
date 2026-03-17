import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('windows sync page renders recent warning diagnostics again', () => {
	const windowsPage = readFileSync(
		new URL('./windows-page.tsx', import.meta.url),
		'utf8',
	);
	const pageTypes = readFileSync(
		new URL('../model/page-types.ts', import.meta.url),
		'utf8',
	);
	const windowsRoute = readFileSync(
		new URL('../../../pages/windows/index.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(windowsPage.includes('最近 warning'), true);
	assert.equal(pageTypes.includes('recentWarnings'), true);
	assert.equal(windowsRoute.includes('recentWarnings'), true);
});

test('windows sync page keeps config cards shrinkable inside responsive grid', () => {
	const windowsPage = readFileSync(
		new URL('./windows-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(
		windowsPage.includes('lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'),
		true,
	);
	assert.equal(
		windowsPage.includes('border border-border/60 shadow-none min-w-0'),
		true,
	);
	assert.equal(
		windowsPage.includes('SelectTrigger className="cursor-pointer w-full"'),
		true,
	);
});

test('windows sync page renders bound sync diagnostics from upstream protocol', () => {
	const windowsPage = readFileSync(
		new URL('./windows-page.tsx', import.meta.url),
		'utf8',
	);
	const windowsRoute = readFileSync(
		new URL('../../../pages/windows/index.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(windowsPage.includes('绑定窗口'), true);
	assert.equal(windowsPage.includes('坐标模式'), true);
	assert.equal(windowsPage.includes('sidecar 端口'), true);
	assert.equal(windowsPage.includes('最近错误'), true);
	assert.equal(windowsRoute.includes('boundBrowserId'), true);
	assert.equal(windowsRoute.includes('boundWindowToken'), true);
	assert.equal(windowsRoute.includes('coordinateMode'), true);
});
