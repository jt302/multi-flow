import test from 'node:test';
import assert from 'node:assert/strict';

import {
	DEFAULT_STARTUP_URL,
	applyProxySuggestionValue,
	buildResolutionValuesFromPreset,
	buildFingerprintSource,
	generateRandomFingerprintSeed,
	mergePreviewSnapshot,
	profileFormSchema,
	resolveInitialResolutionValues,
	resolveInitialWebRtcMode,
	resolveProxySuggestedValues,
} from './profile-form.ts';

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
		webRtcMode: 'follow_ip',
		webrtcIpOverride: '',
		headless: false,
		disableImages: false,
		randomFingerprint: false,
		customLaunchArgsText: '',
		geolocationMode: 'off',
		autoAllowGeolocation: false,
		geoEnabled: false,
		latitude: '',
		longitude: '',
		accuracy: '',
		viewportWidth: 1512,
		viewportHeight: 982,
		deviceScaleFactor: 2,
		fingerprintSeed: 123456789,
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

test('resolveInitialWebRtcMode defaults new profiles to follow_ip but preserves legacy real', () => {
	assert.equal(resolveInitialWebRtcMode(undefined, false), 'follow_ip');
	assert.equal(resolveInitialWebRtcMode(undefined, true), 'real');
	assert.equal(resolveInitialWebRtcMode('replace', true), 'replace');
});

test('resolveInitialResolutionValues prefers stored env override over preset defaults', () => {
	const values = resolveInitialResolutionValues(
		{
			viewportWidth: 1728,
			viewportHeight: 1117,
			deviceScaleFactor: 1.5,
		},
		{
			viewportWidth: 1512,
			viewportHeight: 982,
			deviceScaleFactor: 2,
		},
	);

	assert.deepEqual(values, {
		viewportWidth: 1728,
		viewportHeight: 1117,
		deviceScaleFactor: 1.5,
	});
});

test('resolveInitialResolutionValues falls back to preset defaults when env override is missing', () => {
	const values = resolveInitialResolutionValues(undefined, {
		viewportWidth: 393,
		viewportHeight: 852,
		deviceScaleFactor: 3,
	});

	assert.deepEqual(values, {
		viewportWidth: 393,
		viewportHeight: 852,
		deviceScaleFactor: 3,
	});
});

test('buildResolutionValuesFromPreset returns null without preset', () => {
	assert.equal(buildResolutionValuesFromPreset(null), null);
});

test('profile form schema accepts ip geolocation mode without manual coordinates', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			geolocationMode: 'ip',
			geoEnabled: false,
			latitude: '',
			longitude: '',
			accuracy: '',
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema requires valid coordinates in custom geolocation mode', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			geolocationMode: 'custom',
			geoEnabled: false,
			latitude: '',
			longitude: '',
			accuracy: '',
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'latitude');
});

test('resolveProxySuggestedValues maps proxy portrait into profile fields', () => {
	const suggestion = resolveProxySuggestedValues({
		effectiveLanguage: 'en-US',
		effectiveTimezone: 'America/New_York',
		latitude: 40.7128,
		longitude: -74.006,
		geoAccuracyMeters: 25,
	});

	assert.deepEqual(suggestion, {
		language: 'en-US',
		timezoneId: 'America/New_York',
		geolocation: {
			latitude: '40.7128',
			longitude: '-74.006',
			accuracy: '25',
		},
	});
});

test('applyProxySuggestionValue preserves manual value but allows proxy-owned value to refresh', () => {
	assert.equal(
		applyProxySuggestionValue('manual', 'zh-CN', 'en-US'),
		'zh-CN',
	);
	assert.equal(
		applyProxySuggestionValue('proxy', 'en-US', 'de-DE'),
		'de-DE',
	);
});

test('resolveProxySuggestedValues prefers effective values over suggestion values', () => {
	const suggestion = resolveProxySuggestedValues({
		suggestedLanguage: 'fr-FR',
		suggestedTimezone: 'Europe/Paris',
		effectiveLanguage: 'de-DE',
		effectiveTimezone: 'Europe/Berlin',
		latitude: null,
		longitude: null,
		geoAccuracyMeters: null,
	});

	assert.deepEqual(suggestion, {
		language: 'de-DE',
		timezoneId: 'Europe/Berlin',
		geolocation: null,
	});
});

test('buildFingerprintSource maps random fingerprint to per-launch seed policy', () => {
	const fixed = buildFingerprintSource({
		platform: 'macos',
		browserVersion: '144.0.7559.97',
		devicePresetId: 'macos_desktop',
		randomFingerprint: false,
	});
	assert.equal(fixed.strategy, 'template');
	assert.equal(fixed.seedPolicy, 'fixed');

	const random = buildFingerprintSource({
		platform: 'macos',
		browserVersion: '144.0.7559.97',
		devicePresetId: 'macos_desktop',
		randomFingerprint: true,
	});
	assert.equal(random.strategy, 'random_bundle');
	assert.equal(random.seedPolicy, 'per_launch');
});

test('mergePreviewSnapshot applies env resolution override onto preview snapshot', () => {
	const merged = mergePreviewSnapshot(
		{
			windowWidth: 1512,
			windowHeight: 982,
			deviceScaleFactor: 2,
			language: 'en-US',
			timeZone: 'America/Los_Angeles',
		},
		'',
		'',
		{
			viewportWidth: 1728,
			viewportHeight: 1117,
			deviceScaleFactor: 1.5,
		},
	);

	assert.equal(merged?.windowWidth, 1728);
	assert.equal(merged?.windowHeight, 1117);
	assert.equal(merged?.deviceScaleFactor, 1.5);
});

test('generateRandomFingerprintSeed returns a positive integer seed', () => {
	const seed = generateRandomFingerprintSeed();
	assert.equal(Number.isInteger(seed), true);
	assert.equal(seed >= 0, true);
});
