import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('profile list filters do not repeat the list title inside the toolbar', () => {
	const source = readFileSync(
		new URL('./profile-list-filters.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes("t('common:profileList')"), false);
	assert.equal(source.includes('<h2 className="text-sm font-semibold">'), false);
	assert.equal(source.includes('RefreshCw'), false);
	assert.equal(source.includes('Plus'), false);
	assert.equal(source.includes('onRefresh'), false);
	assert.equal(source.includes('onCreateClick'), false);
});
