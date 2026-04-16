import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('useCanvasState guards appends and outgoing connections after terminal steps', () => {
	const source = readFileSync(new URL('./use-canvas-state.ts', import.meta.url), 'utf8');

	assert.equal(source.includes('isTerminalStepKind(lastStep.kind)'), true);
	assert.equal(source.includes('canvas:palette.terminalStepLocked'), true);
	assert.equal(source.includes('canvas:connection.terminalStepNoOutput'), true);
});
