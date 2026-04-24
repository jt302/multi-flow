import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FILES_EXPECTING_SCROLL_AREA = [
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

test('workspace layout keeps the primary route container on native scrolling', () => {
	const source = readFileSync(
		new URL('../../app/ui/workspace-layout.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(source.includes("@/components/ui/scroll-area"), false);
	assert.equal(source.includes('<ScrollArea className="flex-1 min-h-0">'), false);
	assert.match(source, /className="flex-1 min-h-0 overflow-y-auto/);
});
