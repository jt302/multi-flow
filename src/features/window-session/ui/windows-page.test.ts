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

	assert.equal(windowsPage.includes("t('syncDiag.recentWarnings')"), true);
	assert.equal(pageTypes.includes('recentWarnings'), true);
	assert.equal(windowsRoute.includes('recentWarnings'), true);
});

test('windows sync page keeps config cards shrinkable inside responsive grid', () => {
	const windowsPage = readFileSync(
		new URL('./windows-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(
		windowsPage.includes('sm:grid-cols-[minmax(0,1fr)_repeat(2,auto)]'),
		true,
	);
	assert.equal(
		windowsPage.includes('rounded-lg border border-border/60 px-3 py-2'),
		true,
	);
	assert.equal(
		windowsPage.includes('w-full cursor-pointer sm:w-auto'),
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

	assert.equal(windowsPage.includes("t('syncDiag.boundWindow')"), true);
	assert.equal(windowsPage.includes("t('syncDiag.coordinateMode')"), true);
	assert.equal(windowsPage.includes("t('syncDiag.sidecarPort')"), true);
	assert.equal(windowsPage.includes("t('syncDiag.lastError')"), true);
	assert.equal(windowsRoute.includes('sessionPayload'), true);
	assert.equal(windowsRoute.includes('buildSyncTargetItems'), true);
	assert.equal(windowsRoute.includes('syncInstances'), true);
});

test('windows sync page uses a single stateful sync action button with loading copy', () => {
	const windowsPage = readFileSync(
		new URL('./windows-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(windowsPage.includes("t('page.startingSync')"), true);
	assert.equal(windowsPage.includes("t('page.stoppingSync')"), true);
	assert.equal(windowsPage.includes('const [syncActionPending, setSyncActionPending] = useState(false);'), true);
	assert.equal(
		windowsPage.includes('disabled={') && windowsPage.includes('!startValidation.ok'),
		true,
	);
	assert.equal(windowsPage.includes("t('syncActions.restartSync')"), true);
	assert.equal(windowsPage.includes("t('syncActions.refreshSyncStatus')"), true);
});
