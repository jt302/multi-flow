import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('automation canvas deletes edges from a window keydown fallback using the last clicked edge', () => {
	const source = readFileSync(
		new URL('./automation-canvas-page.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes('lastClickedEdgeRef.current = edge.id;'), true);
	assert.equal(source.includes("window.addEventListener('keydown', handleGlobalKeyDown);"), true);
	assert.equal(source.includes("deleteKeyCode={null}"), true);
});
