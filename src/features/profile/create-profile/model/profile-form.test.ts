import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_STARTUP_URL, profileFormSchema } from './profile-form.ts';

function buildFormValues(overrides: Record<string, unknown> = {}) {
	return {
		name: 'test-profile',
		group: '',
		note: '',
		browserKind: 'chromium',
		browserVersion: '144.0.7559.97',
		platform: 'macos',
		devicePresetId: 'preset_1',
		startupUrls: DEFAULT_STARTUP_URL,
		browserBgColor: '#0F8A73',
		proxyId: '',
		language: '',
		timezoneId: '',
		customFontListText: 'Arial\nHelvetica',
		webRtcMode: 'real',
		webrtcIpOverride: '',
		headless: false,
		disableImages: false,
		randomFingerprint: true,
		customLaunchArgsText: '',
		geoEnabled: false,
		latitude: '',
		longitude: '',
		accuracy: '',
		...overrides,
	};
}

test('profile form schema accepts multiple startup urls split by line', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			startupUrls: 'https://example.com\nhttps://example.org/path',
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema rejects non http startup urls in multi line input', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			startupUrls: 'https://example.com\nftp://example.org',
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'startupUrls');
});
