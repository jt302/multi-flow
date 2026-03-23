import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('workspace layout keeps outlet container full-height for page-level flex layouts', () => {
	const source = readFileSync(new URL('./workspace-layout.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('relative h-dvh w-full overflow-hidden p-4'), true);
	assert.equal(source.includes('basis-0 flex-col gap-3 bg-transparent"'), true);
	assert.equal(source.includes('w-full shrink-0 border-border/60 bg-card/84 px-4 py-2 backdrop-blur-2xl'), true);
	assert.equal(source.includes('div className="h-full w-full overflow-y-auto p-4 md:p-5"'), true);
	assert.equal(source.includes('flex h-full min-h-0 w-full min-w-0 flex-col'), true);
	assert.equal(source.includes('md:pl-2'), false);
	assert.equal(source.includes('bg-card/84 px-4 py-2 backdrop-blur-2xl'), true);
});
