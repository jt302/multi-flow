import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FILES_EXPECTING_SCROLL_AREA = [
	'../../app/ui/workspace-layout.tsx',
	'../../features/settings/ui/settings-page.tsx',
	'../../features/window-session/ui/windows-page.tsx',
	'../../features/automation-canvas/ui/step-palette.tsx',
	'../../features/automation-canvas/ui/step-properties-panel.tsx',
] as const;

test('page-level scroll containers reuse ScrollArea to keep scrollbar tracks hidden', () => {
	for (const file of FILES_EXPECTING_SCROLL_AREA) {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');
		assert.match(source, /ScrollArea/);
	}
});
