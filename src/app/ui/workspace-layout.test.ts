import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace layout keeps outlet container full-height for page-level flex layouts', () => {
	const source = readFileSync(new URL('./workspace-layout.tsx', import.meta.url), 'utf8');
	const topbarSource = readFileSync(new URL('./workspace-topbar.tsx', import.meta.url), 'utf8');
	const dialogSource = readFileSync(new URL('../../components/ui/dialog.tsx', import.meta.url), 'utf8');
	const alertDialogSource = readFileSync(new URL('../../components/ui/alert-dialog.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('relative h-dvh w-full overflow-hidden p-2 sm:p-4'), true);
	assert.equal(source.includes('basis-0 flex-col gap-2 sm:gap-4 bg-transparent'), true);
	assert.equal(source.includes('px-3 py-2 sm:px-4 sm:py-2.5'), true);
	assert.equal(source.includes('p-2 sm:p-3 md:p-4'), true);
	assert.equal(source.includes('flex h-full min-h-0 w-full min-w-0 flex-col'), true);
	assert.equal(topbarSource.includes('flex flex-col gap-3 sm:flex-row'), true);
	assert.equal(topbarSource.includes('sm:w-auto'), true);
	assert.equal(dialogSource.includes('w-[calc(100vw-1rem)]'), true);
	assert.equal(dialogSource.includes('max-h-[calc(100vh-1rem)]'), true);
	assert.equal(alertDialogSource.includes('w-[calc(100vw-1rem)]'), true);
	assert.equal(alertDialogSource.includes('max-h-[calc(100vh-1rem)]'), true);
});
