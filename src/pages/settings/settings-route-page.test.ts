import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

test('settings route fetches resource inventory only on the resources tab', () => {
	assert.match(source, /const isResourcesTab = activeTab\.id === 'resources'/);
	assert.match(source, /useResourcesQuery\(\{\s*enabled: isResourcesTab/s);
	assert.doesNotMatch(source, /useResourcesQuery\(\)/);
});
