import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace topbar keeps sidebar trigger and shows current page title/description on the left', () => {
	const source = readFileSync(new URL('./workspace-topbar.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('<SidebarTrigger className="shrink-0" />'), true);
	assert.equal(source.includes('Command + Navigation'), false);
	assert.equal(source.includes('Breadcrumb'), false);
	assert.equal(source.includes('getWorkspaceSections()[activeNav]'), true);
	assert.equal(source.includes('text-sm font-semibold'), true);
	assert.equal(source.includes('text-xs text-muted-foreground'), true);
	assert.equal(source.includes('header className="flex items-center justify-between gap-3"'), true);
});
