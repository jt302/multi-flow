import assert from 'node:assert/strict';
import test from 'node:test';

import { computeArrangePreview } from './arrange-preview.ts';

test('grid preview keeps incomplete last row at cell width by default', () => {
	const bounds = computeArrangePreview({
		workArea: { x: 0, y: 0, width: 1000, height: 800 },
		n: 3,
		mode: 'grid',
		rows: 2,
		columns: 2,
		gapX: 0,
		gapY: 0,
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
	});

	assert.equal(bounds.length, 3);
	assert.equal(bounds[0].width, 500);
	assert.equal(bounds[2].x, 0);
	assert.equal(bounds[2].width, 500);
});
