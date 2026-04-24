import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace topbar keeps sidebar trigger and shows current page title/description on the left', () => {
	const source = readFileSync(new URL('./workspace-topbar.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('<SidebarTrigger className="shrink-0" />'), true);
	assert.equal(source.includes('Command + Navigation'), false);
	assert.equal(source.includes('Breadcrumb'), false);
	assert.equal(source.includes('getWorkspaceSections()[activeNav]'), false);
	assert.equal(source.includes('getWorkspaceSection(activeNav)'), true);
	assert.equal(source.includes('text-sm font-semibold'), true);
	assert.equal(source.includes('text-xs text-muted-foreground'), true);
	assert.equal(source.includes('header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"'), true);
	assert.equal(source.includes('flex min-w-0 items-center gap-3 sm:flex-1'), true);
	assert.equal(source.includes('flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto sm:max-w-full sm:shrink-0'), true);
	assert.equal(source.includes('min-w-0 flex-1 justify-start border-border/40 bg-background/50'), true);
	assert.equal(source.includes('min-w-0 flex-1 justify-start bg-background/50'), true);
	assert.equal(source.includes('shrink-0 rounded-xl border border-border/40 bg-background/50'), true);
	assert.equal(source.includes('rounded-xl border border-border/40 bg-background/50'), true);
});
