import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./fs-preferences-drawer.tsx', import.meta.url), 'utf8');

test('fs preferences drawer keeps dialog content scrollable when height is constrained', () => {
	assert.equal(source.includes('grid-rows-[auto_minmax(0,1fr)]'), true);
	assert.equal(source.includes('min-h-0 flex-1 overflow-y-auto'), true);
});

test('fs preferences drawer uses a consistent whitelist form grid and aligns action buttons', () => {
	assert.equal(source.includes('sm:grid-cols-[168px_minmax(0,1fr)]'), true);
	assert.equal(source.includes('name="path"'), true);
	assert.equal(source.includes("placeholder={t('fileSystem.pathPlaceholder')}"), true);
	assert.equal(source.includes('className="shrink-0"'), true);
});
