import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./app-update-listener.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(
	new URL('../../entities/app-update/api/app-update-api.ts', import.meta.url),
	'utf8',
);

test('app update listener checks automatically only once in production', () => {
	assert.match(source, /import\.meta\.env\.DEV/);
	assert.match(source, /mf_app_update_auto_checked/);
	assert.match(source, /checkAppUpdate\(\)/);
	assert.match(appSource, /<AppUpdateListener \/>/);
});

test('app update listener prompts before install and listens for progress', () => {
	assert.match(apiSource, /app_update:\/\/progress/);
	assert.match(source, /installAppUpdate\(\)/);
	assert.match(source, /AlertDialog/);
	assert.match(source, /downloaded/);
	assert.match(source, /total/);
});
