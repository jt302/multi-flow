import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile multi select only queries profiles while the popover is open', () => {
	const source = readFileSync(new URL('./profile-multi-select.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('useProfilesQuery({'), true);
	assert.equal(source.includes('enabled: open'), true);
	assert.equal(source.includes('refetchInterval: open ? 5000 : false'), true);
});
