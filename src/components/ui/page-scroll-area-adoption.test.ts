import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FILES_EXPECTING_SCROLL_AREA = [
	'/Users/tt/Developer/personal/multi-flow/src/app/ui/workspace-layout.tsx',
	'/Users/tt/Developer/personal/multi-flow/src/features/settings/ui/settings-page.tsx',
	'/Users/tt/Developer/personal/multi-flow/src/features/window-session/ui/windows-page.tsx',
	'/Users/tt/Developer/personal/multi-flow/src/features/automation-canvas/ui/step-palette.tsx',
	'/Users/tt/Developer/personal/multi-flow/src/features/automation-canvas/ui/step-properties-panel.tsx',
] as const;

test('page-level scroll containers reuse ScrollArea to keep scrollbar tracks hidden', () => {
	for (const file of FILES_EXPECTING_SCROLL_AREA) {
		const source = readFileSync(file, 'utf8');
		assert.match(source, /ScrollArea/);
	}
});
