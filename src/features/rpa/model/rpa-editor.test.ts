import test from 'node:test';
import assert from 'node:assert/strict';

import {
	parseNodeConfigText,
	parseVariablesText,
	rpaFlowMetaSchema,
	rpaNodeConfigSchema,
} from './rpa-editor.ts';

test('rpa flow meta schema accepts bounded concurrency', () => {
	const result = rpaFlowMetaSchema.safeParse({
		name: 'Lead collect',
		note: '',
		concurrencyLimit: 3,
		variablesText: 'landingUrl|Landing URL|true|https://example.com',
	});
	assert.equal(result.success, true);
});

test('rpa node config schema rejects invalid json', () => {
	const result = rpaNodeConfigSchema.safeParse({
		configText: '{bad-json',
	});
	assert.equal(result.success, false);
});

test('parseVariablesText maps pipe syntax into variable descriptors', () => {
	assert.deepEqual(parseVariablesText('landingUrl|Landing URL|true|https://example.com'), [
		{
			key: 'landingUrl',
			label: 'Landing URL',
			required: true,
			defaultValue: 'https://example.com',
		},
	]);
});

test('parseNodeConfigText parses object payload', () => {
	assert.deepEqual(parseNodeConfigText('{"url":"https://example.com"}'), {
		url: 'https://example.com',
	});
});
