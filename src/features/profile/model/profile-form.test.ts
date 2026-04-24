import assert from 'node:assert/strict';
import test from 'node:test';

import {
	applyProxySuggestionValue,
	buildFingerprintSource,
	buildResolutionValuesFromPreset,
	DEFAULT_STARTUP_URL,
	deriveCookieSiteUrls,
	generateRandomCustomDeviceName,
	generateRandomCustomMacAddress,
	generateRandomFingerprintSeed,
	mergeCookieStateJson,
	mergePreviewSnapshot,
	profileFormSchema,
	resolveInitialCustomDeviceIdentityValues,
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
		browserBgColorMode: 'custom',
		toolbarLabelMode: 'id_only',
		proxyId: '',
		localeMode: 'auto',
		language: '',
		timezoneId: '',
		customFontListText: 'Arial\nHelvetica',
		deviceNameMode: 'real',
		customDeviceName: '',
		macAddressMode: 'real',
		customMacAddress: '',
		doNotTrackEnabled: false,
		webRtcMode: 'follow_ip',
		webrtcIpOverride: '',
		headless: false,
		disableImages: false,
		portScanProtection: false,
		automationDetectionShield: false,
		imageLoadingMode: 'off',
		imageMaxArea: null,
		randomFingerprint: false,
		customLaunchArgsText: '',
		cookieStateJson: '',
		pluginSelections: [],
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

test('profile form schema accepts visual inheritance fields', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			browserBgColor: '',
			browserBgColorMode: 'inherit',
			toolbarLabelMode: 'group_name_and_id',
		}),
	);
	assert.equal(result.success, true);
	if (!result.success) {
		return;
	}
	assert.equal(result.data.browserBgColorMode, 'inherit');
	assert.equal(result.data.toolbarLabelMode, 'group_name_and_id');
});

test('profile form schema accepts empty browser color when mode is none', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			browserBgColor: '',
			browserBgColorMode: 'none',
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema rejects empty browser color when mode is custom', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			browserBgColor: '',
			browserBgColorMode: 'custom',
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'browserBgColor');
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

test('profile form schema keeps chromium protection and image loading settings', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			portScanProtection: true,
			automationDetectionShield: true,
			imageLoadingMode: 'max-area',
			imageMaxArea: 4096,
		}),
	);
	assert.equal(result.success, true);
	if (!result.success) {
		return;
	}
	assert.equal(result.data.portScanProtection, true);
	assert.equal(result.data.automationDetectionShield, true);
	assert.equal(result.data.imageLoadingMode, 'max-area');
	assert.equal(result.data.imageMaxArea, 4096);
});

test('profile form schema requires positive image max area for max-area mode', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			imageLoadingMode: 'max-area',
			imageMaxArea: null,
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'imageMaxArea');
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

test('profile form schema accepts do not track toggle', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			doNotTrackEnabled: true,
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema accepts empty cookie state json', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			cookieStateJson: '',
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema rejects invalid cookie state json', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			cookieStateJson: '{"managed_cookies":"bad"}',
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'cookieStateJson');
});

test('profile form schema accepts real device name and mac address modes without custom values', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			deviceNameMode: 'real',
			customDeviceName: '',
			macAddressMode: 'real',
			customMacAddress: '',
		}),
	);
	assert.equal(result.success, true);
});

test('profile form schema requires valid custom device name and mac address in custom mode', () => {
	const result = profileFormSchema.safeParse(
		buildFormValues({
			deviceNameMode: 'custom',
			customDeviceName: 'bad name',
			macAddressMode: 'custom',
			customMacAddress: 'ZZ:11:22:33:44:55',
		}),
	);
	assert.equal(result.success, false);
	if (result.success) {
		return;
	}
	assert.equal(result.error.issues[0]?.path[0], 'customDeviceName');
	assert.equal(result.error.issues[1]?.path[0], 'customMacAddress');
});

test('resolveInitialCustomDeviceIdentityValues preserves saved custom values', () => {
	const values = resolveInitialCustomDeviceIdentityValues(
		{
			deviceNameMode: 'custom',
			customDeviceName: 'device-a1b2c3d4',
			macAddressMode: 'custom',
			customMacAddress: 'A2:11:22:33:44:55',
		},
		{
			deviceName: 'device-deadbeef',
			macAddress: 'AE:12:34:56:78:90',
		},
	);

	assert.deepEqual(values, {
		deviceNameMode: 'custom',
		customDeviceName: 'device-a1b2c3d4',
		macAddressMode: 'custom',
		customMacAddress: 'A2:11:22:33:44:55',
	});
});

test('generateRandomCustomDeviceName returns expected format', () => {
	const value = generateRandomCustomDeviceName();
	assert.match(value, /^device-[0-9a-f]{8}$/);
});

test('generateRandomCustomMacAddress returns locally administered unicast mac', () => {
	const value = generateRandomCustomMacAddress();
	assert.match(value, /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/);
	const firstOctet = Number.parseInt(value.slice(0, 2), 16);
	assert.equal(firstOctet & 0b10, 0b10);
	assert.equal(firstOctet & 0b1, 0);
});

test('mergeCookieStateJson merges cookies by name domain path and preserves target environment id', () => {
	const merged = mergeCookieStateJson(
		JSON.stringify({
			environment_id: 'env_main',
			managed_cookies: [
				{
					cookie_id: 'ck_1',
					url: 'https://example.com/',
					name: 'sid',
					value: 'old',
					domain: '.example.com',
					path: '/',
				},
			],
		}),
		JSON.stringify({
			environment_id: 'env_other',
			managed_cookies: [
				{
					cookie_id: 'ck_2',
					url: 'https://example.com/',
					name: 'sid',
					value: 'new',
					domain: '.example.com',
					path: '/',
				},
				{
					cookie_id: 'ck_3',
					url: 'https://accounts.example.com/',
					name: 'token',
					value: 'abc',
					domain: 'accounts.example.com',
					path: '/',
				},
			],
		}),
		'env_main',
	);

	assert.deepEqual(JSON.parse(merged), {
		environment_id: 'env_main',
		managed_cookies: [
			{
				cookie_id: 'ck_2',
				url: 'https://example.com/',
				name: 'sid',
				value: 'new',
				domain: '.example.com',
				path: '/',
			},
			{
				cookie_id: 'ck_3',
				url: 'https://accounts.example.com/',
				name: 'token',
				value: 'abc',
				domain: 'accounts.example.com',
				path: '/',
			},
		],
	});
});

test('deriveCookieSiteUrls returns unique sorted site urls from cookie state', () => {
	const sites = deriveCookieSiteUrls({
		environment_id: 'env_1',
		managed_cookies: [
			{
				cookie_id: 'ck_1',
				url: 'https://example.com/',
				name: 'sid',
				value: '1',
			},
			{
				cookie_id: 'ck_2',
				url: 'https://accounts.example.com/path',
				name: 'token',
				value: '2',
			},
			{
				cookie_id: 'ck_3',
				url: 'https://example.com/other',
				name: 'sid2',
				value: '3',
			},
		],
	});

	assert.deepEqual(sites, ['https://accounts.example.com/', 'https://example.com/']);
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
	assert.equal(applyProxySuggestionValue('manual', 'zh-CN', 'en-US'), 'zh-CN');
	assert.equal(applyProxySuggestionValue('proxy', 'en-US', 'de-DE'), 'de-DE');
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
