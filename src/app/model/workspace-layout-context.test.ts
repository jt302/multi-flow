import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkspaceLayoutOutletContext } from './workspace-layout-context.ts';

test('workspace layout outlet context only keeps navigation and theme fields', () => {
	const context = buildWorkspaceLayoutOutletContext({
		activeNav: 'profiles',
		theme: {
			resolvedMode: 'dark',
			useCustomColor: true,
			preset: 'harbor',
			customColor: '#00aaff',
			customPresets: ['#00AAFF'],
			themeMode: 'system',
			setThemeMode: () => {},
			onPresetChange: () => {},
			onCustomColorChange: () => {},
			onToggleCustomColor: () => {},
			onAddCustomPreset: () => {},
			onApplyCustomPreset: () => {},
			onDeleteCustomPreset: () => {},
		},
		navigation: {
			pathname: '/profiles',
			intent: null,
			onConsumeNavigationIntent: () => {},
			onSetProfileNavigationIntent: () => {},
			onNavigate: () => {},
		},
		data: { should: 'be removed' },
		actions: { should: 'be removed too' },
	});

	assert.deepEqual(Object.keys(context).sort(), ['activeNav', 'navigation', 'theme']);
	assert.equal(context.activeNav, 'profiles');
	assert.equal(context.navigation.pathname, '/profiles');
	assert.equal(context.theme.customColor, '#00aaff');
});
