import test from 'node:test';
import assert from 'node:assert/strict';

import {
	parseNodeConfigText,
	parseVariablesText,
	rpaFlowMetaSchema,
	rpaNodeConfigSchema,
	resolveNodeConfigGuide,
	validateNodeConfigForKind,
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

test('resolveNodeConfigGuide returns field hints for known kind', () => {
	const guide = resolveNodeConfigGuide('wait_for_selector');
	assert.equal(guide.kind, 'wait_for_selector');
	assert.equal(guide.fields.length > 0, true);
	assert.equal(guide.fields[0].key, 'selector');
});

test('validateNodeConfigForKind detects missing required fields', () => {
	const errors = validateNodeConfigForKind('input_text', { selector: '#email' });
	assert.equal(errors.length > 0, true);
	assert.match(errors[0], /缺少必填字段/);
});
