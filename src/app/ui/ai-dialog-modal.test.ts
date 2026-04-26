import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./ai-dialog-modal.tsx', import.meta.url), 'utf8');

test('table dialog is not locked to max-w-2xl', () => {
	const tableBlock =
		source.split("if (request.dialogType === 'table') {")[1]?.split('// ─── image 类型')[0] ?? '';

	assert.equal(tableBlock.includes('className="max-w-2xl"'), false);
	assert.equal(
		tableBlock.includes(
			'className="grid max-h-[85vh] w-fit max-w-[min(96vw,900px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:w-fit"',
		),
		true,
	);
});

test('table dialog uses inner scroll containers for wide tables', () => {
	const tableBlock =
		source.split("if (request.dialogType === 'table') {")[1]?.split('// ─── image 类型')[0] ?? '';

	assert.equal(tableBlock.includes('className="min-h-0 overflow-y-auto px-6"'), true);
	assert.equal(tableBlock.includes('className="w-full overflow-x-auto pb-4"'), true);
	assert.equal(tableBlock.includes('className="w-max min-w-full"'), true);
	assert.equal(tableBlock.includes('className="border-t bg-background px-6 py-4"'), true);
	assert.equal(
		tableBlock.includes('className="max-w-[240px] break-words whitespace-normal align-top"'),
		true,
	);
});
