import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSonnerTheme } from './sonner-theme.ts';

test('resolveSonnerTheme maps dark mode to dark theme', () => {
	assert.equal(resolveSonnerTheme('dark'), 'dark');
});

test('resolveSonnerTheme maps non-dark mode to light theme', () => {
	assert.equal(resolveSonnerTheme('light'), 'light');
	assert.equal(resolveSonnerTheme('system'), 'light');
});
