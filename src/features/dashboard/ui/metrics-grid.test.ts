import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('dashboard metrics keep the top summary cards side by side on small screens', () => {
	const source = readFileSync(new URL('./metrics-grid.tsx', import.meta.url), 'utf8');

	assert.equal(source.includes('grid-cols-4'), true);
	assert.equal(source.includes('grid-cols-2'), false);
	assert.equal(source.includes('sm:grid-cols-2'), false);
	assert.equal(source.includes('xl:grid-cols-4'), false);
	assert.equal(source.includes('Card className="min-w-0 gap-2 py-4"'), true);
	assert.equal(source.includes('CardHeader className="gap-1 px-4 pb-1"'), true);
	assert.equal(source.includes('CardContent className="px-4 pt-0"'), true);
});
