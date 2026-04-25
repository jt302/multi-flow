import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('proxy bind and unbind actions refresh profiles and bindings', () => {
	const source = readFileSync(new URL('./use-proxy-actions.ts', import.meta.url), 'utf8').replace(
		/\r\n/g,
		'\n',
	);

	assert.equal(
		source.includes(
			'await bindProfileProxyApi(profileId, proxyId);\n\t\t\tawait refreshProfilesAndBindings();',
		),
		true,
	);
	assert.equal(
		source.includes(
			'await unbindProfileProxyApi(profileId);\n\t\t\tawait refreshProfilesAndBindings();',
		),
		true,
	);
});
