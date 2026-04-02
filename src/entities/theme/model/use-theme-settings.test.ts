import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('theme settings sync native color-scheme with resolved mode for document scrollbars', () => {
	const source = readFileSync(new URL('./use-theme-settings.ts', import.meta.url), 'utf8');

	assert.match(
		source,
		/const resolvedMode = themeMode === 'system' \? \(systemDark \? 'dark' : 'light'\) : themeMode;/,
	);
	assert.match(source, /root\.style\.colorScheme\s*=\s*resolvedMode;/);
});
