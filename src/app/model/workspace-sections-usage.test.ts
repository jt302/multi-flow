import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PAGE_FILES = [
	'../../pages/browser-control/index.tsx',
	'../../features/group/ui/groups-page.tsx',
	'../../features/plugin/ui/plugins-page.tsx',
	'../../features/profile/ui/profile-list-page.tsx',
	'../../features/proxy/ui/proxy-page.tsx',
	'../../features/settings/ui/settings-page.tsx',
	'../../features/window-session/ui/windows-page.tsx',
] as const;

test('workspace pages read only their active section instead of constructing all sections', () => {
	for (const file of PAGE_FILES) {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');

		assert.equal(source.includes('getWorkspaceSections()'), false, file);
		assert.equal(source.includes('getWorkspaceSection('), true, file);
	}
});
