import assert from 'node:assert/strict';
import test from 'node:test';

import { captchaSolverFormSchema } from './captcha-solver-config-card.tsx';

test('captcha config form rejects empty api key', () => {
	const result = captchaSolverFormSchema.safeParse({
		provider: '2captcha',
		apiKey: '',
		baseUrl: '',
		isDefault: false,
	});

	assert.equal(result.success, false);
});

test('captcha config form rejects unsupported provider', () => {
	const result = captchaSolverFormSchema.safeParse({
		provider: 'unknown',
		apiKey: 'key',
		baseUrl: '',
		isDefault: false,
	});

	assert.equal(result.success, false);
});

test('captcha config form rejects invalid custom base url', () => {
	const result = captchaSolverFormSchema.safeParse({
		provider: 'capsolver',
		apiKey: 'key',
		baseUrl: 'not-a-url',
		isDefault: false,
	});

	assert.equal(result.success, false);
});

test('captcha config form accepts supported provider and https base url', () => {
	const result = captchaSolverFormSchema.safeParse({
		provider: 'anticaptcha',
		apiKey: 'key',
		baseUrl: 'https://api.example.com',
		isDefault: true,
	});

	assert.equal(result.success, true);
});
