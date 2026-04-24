import i18next from 'i18next';
import { z } from 'zod/v3';
import type {
	CookieStateFile,
	ProfileDevicePresetItem,
	ProfileFingerprintSettings,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfilePluginSelection,
	WebRtcMode,
} from '@/entities/profile/model/types';
import { TIMEZONE_SET } from '@/shared/lib/timezone-list';

export const DEFAULT_STARTUP_URL = 'https://www.browserscan.net/';
const DEVICE_NAME_PATTERN = /^[A-Za-z0-9-]{1,63}$/;
const MAC_ADDRESS_PATTERN = /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/i;
const BROWSER_BG_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const profileFormSchema = z
	.object({
		name: z.string().trim().min(1, i18next.t('validation:nameRequired')),
		group: z.string(),
		note: z.string(),
		browserKind: z.string().trim().min(1),
		browserVersion: z.string().trim().min(1, i18next.t('validation:browserVersionRequired')),
		platform: z.string().trim().min(1, i18next.t('validation:platformRequired')),
		devicePresetId: z.string().trim().min(1, i18next.t('validation:devicePresetRequired')),
		startupUrls: z.string(),
		browserBgColor: z.string().trim(),
		browserBgColorMode: z.enum(['inherit', 'custom', 'none']),
		toolbarLabelMode: z.enum(['inherit', 'id_only', 'group_name_and_id']),
		proxyId: z.string(),
		localeMode: z.enum(['auto', 'manual']),
		language: z.string(),
		timezoneId: z.string().refine(
			(v) => v === '' || TIMEZONE_SET.has(v),
			() => ({ message: i18next.t('profile:locale.invalidTimezone') }),
		),
		customFontListText: z.string(),
		deviceNameMode: z.enum(['real', 'custom']),
		customDeviceName: z.string(),
		macAddressMode: z.enum(['real', 'custom']),
		customMacAddress: z.string(),
		doNotTrackEnabled: z.boolean(),
		webRtcMode: z.enum(['real', 'follow_ip', 'replace', 'disable']),
		webrtcIpOverride: z.string(),
		headless: z.boolean(),
		disableImages: z.boolean(),
		portScanProtection: z.boolean(),
		automationDetectionShield: z.boolean(),
		imageLoadingMode: z.enum(['off', 'block', 'max-area']),
		imageMaxArea: z
			.number()
			.int()
			.positive(i18next.t('validation:imageMaxAreaPositive'))
			.nullable(),
		randomFingerprint: z.boolean(),
		customLaunchArgsText: z.string(),
		cookieStateJson: z.string(),
		pluginSelections: z.array(
			z.object({
				packageId: z.string().trim().min(1, i18next.t('validation:pluginIdRequired')),
				enabled: z.boolean(),
			}),
		),
		geolocationMode: z.enum(['off', 'ip', 'custom']),
		autoAllowGeolocation: z.boolean(),
		latitude: z.string(),
		longitude: z.string(),
		accuracy: z.string(),
		viewportWidth: z.number().int().min(1, i18next.t('validation:viewportWidthMin')),
		viewportHeight: z.number().int().min(1, i18next.t('validation:viewportHeightMin')),
		deviceScaleFactor: z.number().positive(i18next.t('validation:dprPositive')),
		fingerprintSeed: z.number().int().nonnegative().nullable(),
	})
	.superRefine((values, ctx) => {
		if (values.localeMode === 'manual') {
			if (!values.language.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('profile:locale.languageRequired'),
					path: ['language'],
				});
			}
			if (!values.timezoneId.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('profile:locale.timezoneRequired'),
					path: ['timezoneId'],
				});
			}
		}
		const startupUrls = parseStartupUrls(values.startupUrls);
		for (const startupUrl of startupUrls) {
			try {
				const parsed = new URL(startupUrl);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: i18next.t('validation:urlProtocol'),
						path: ['startupUrls'],
					});
					break;
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:urlFormat'),
					path: ['startupUrls'],
				});
				break;
			}
		}

		if (values.webRtcMode === 'replace') {
			const ip = values.webrtcIpOverride.trim();
			if (!ip) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:webrtcIpRequired'),
					path: ['webrtcIpOverride'],
				});
			}
		}

		if (
			values.browserBgColorMode === 'custom' &&
			!BROWSER_BG_COLOR_PATTERN.test(values.browserBgColor.trim())
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: i18next.t('validation:bgColorFormat'),
				path: ['browserBgColor'],
			});
		}

		if (values.deviceNameMode === 'custom') {
			const deviceName = values.customDeviceName.trim();
			if (!deviceName) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:customDeviceNameRequired'),
					path: ['customDeviceName'],
				});
			} else if (!DEVICE_NAME_PATTERN.test(deviceName)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:customDeviceNameFormat'),
					path: ['customDeviceName'],
				});
			}
		}

		if (values.macAddressMode === 'custom') {
			const macAddress = values.customMacAddress.trim();
			if (!macAddress) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:customMacAddressRequired'),
					path: ['customMacAddress'],
				});
			} else if (!MAC_ADDRESS_PATTERN.test(macAddress)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:customMacAddressFormat'),
					path: ['customMacAddress'],
				});
			}
		}

		if (values.cookieStateJson.trim()) {
			const cookieState = parseCookieStateJson(values.cookieStateJson);
			if (!cookieState.ok) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: cookieState.error,
					path: ['cookieStateJson'],
				});
			}
		}

		if (values.imageLoadingMode === 'max-area' && values.imageMaxArea === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: i18next.t('validation:imageMaxAreaRequired'),
				path: ['imageMaxArea'],
			});
		}

		const fontList = values.customFontListText
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
		if (fontList.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: i18next.t('validation:fontListRequired'),
				path: ['customFontListText'],
			});
		}

		if (values.geolocationMode !== 'custom') {
			return;
		}

		const latText = values.latitude.trim();
		const lat = Number(latText);
		if (!latText || !Number.isFinite(lat) || lat < -90 || lat > 90) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: i18next.t('validation:latitudeRange'),
				path: ['latitude'],
			});
		}
		const lngText = values.longitude.trim();
		const lng = Number(lngText);
		if (!lngText || !Number.isFinite(lng) || lng < -180 || lng > 180) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: i18next.t('validation:longitudeRange'),
				path: ['longitude'],
			});
		}
		if (values.accuracy.trim()) {
			const acc = Number(values.accuracy);
			if (!Number.isFinite(acc) || acc <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: i18next.t('validation:accuracyPositive'),
					path: ['accuracy'],
				});
			}
		}
	});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ProfileResolutionValues = Pick<
	ProfileFormValues,
	'viewportWidth' | 'viewportHeight' | 'deviceScaleFactor'
>;

export type ProxySuggestionFieldSource = 'manual' | 'proxy' | 'host' | 'empty';
export type DeviceIdentityMode = 'real' | 'custom';
export type DeviceIdentityRandomValues = {
	deviceName: string;
	macAddress: string;
};
export type CustomDeviceIdentityValues = {
	deviceNameMode: DeviceIdentityMode;
	customDeviceName: string;
	macAddressMode: DeviceIdentityMode;
	customMacAddress: string;
};

type CookieStateParseResult = { ok: true; value: CookieStateFile } | { ok: false; error: string };

type ResolutionPresetInput = Pick<
	ProfileDevicePresetItem,
	'viewportWidth' | 'viewportHeight' | 'deviceScaleFactor'
>;

type ProxyLocaleSuggestionInput = {
	suggestedLanguage?: string;
	suggestedTimezone?: string;
	effectiveLanguage?: string;
	effectiveTimezone?: string;
	latitude: number | null;
	longitude: number | null;
	geoAccuracyMeters: number | null;
};

export function applyProxySuggestionValue(
	source: ProxySuggestionFieldSource,
	currentValue: string,
	suggestedValue: string,
) {
	if (source === 'manual') {
		return currentValue;
	}
	return suggestedValue || '';
}

export function resolveProxySuggestedValues(proxy: ProxyLocaleSuggestionInput | null | undefined) {
	if (!proxy) {
		return {
			language: '',
			timezoneId: '',
			geolocation: null,
		};
	}
	return {
		language: proxy.effectiveLanguage?.trim() || proxy.suggestedLanguage?.trim() || '',
		timezoneId: proxy.effectiveTimezone?.trim() || proxy.suggestedTimezone?.trim() || '',
		geolocation:
			proxy.latitude !== null && proxy.longitude !== null
				? {
						latitude: proxy.latitude.toString(),
						longitude: proxy.longitude.toString(),
						accuracy: proxy.geoAccuracyMeters === null ? '' : proxy.geoAccuracyMeters.toString(),
					}
				: null,
	};
}

export interface HostLocaleSuggestion {
	exitIp?: string;
	country?: string;
	language?: string;
	timezone?: string;
	latitude?: number;
	longitude?: number;
	source: string;
}

export function resolveHostSuggestedValues(suggestion: HostLocaleSuggestion | null | undefined) {
	return {
		language: suggestion?.language?.trim() || '',
		timezoneId: suggestion?.timezone?.trim() || '',
	};
}

export function normalizeWebRtcMode(value?: string): WebRtcMode {
	if (value === 'replace' || value === 'disable' || value === 'real' || value === 'follow_ip') {
		return value;
	}
	return 'real';
}

export function resolveInitialWebRtcMode(
	value: string | undefined,
	hasInitialProfile: boolean,
): WebRtcMode {
	if (value) {
		return normalizeWebRtcMode(value);
	}
	return hasInitialProfile ? 'real' : 'follow_ip';
}

export function buildAcceptLanguages(language: string): string | undefined {
	const primary = language.trim();
	if (!primary) {
		return undefined;
	}
	const base = primary.split('-')[0]?.trim() || primary;
	if (base.toLowerCase() === primary.toLowerCase()) {
		return `${primary},en;q=0.8`;
	}
	return `${primary},${base};q=0.9,en;q=0.8`;
}

export function parseCustomFontList(text: string): string[] {
	return Array.from(
		new Set(
			text
				.split('\n')
				.map((item) => item.trim())
				.filter(Boolean),
		),
	);
}

export function parseStartupUrls(text: string): string[] {
	return Array.from(
		new Set(
			text
				.split('\n')
				.map((item) => item.trim())
				.filter(Boolean),
		),
	);
}

export function randomizeFontList(pool: string[]): string[] {
	if (pool.length <= 8) {
		return pool;
	}
	const shuffled = [...pool];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	const keepRatio = 0.7 + Math.random() * 0.2;
	const targetCount = Math.max(
		48,
		Math.min(shuffled.length, Math.round(shuffled.length * keepRatio)),
	);
	return shuffled.slice(0, targetCount);
}

export function generateRandomCustomDeviceName() {
	const bytes = new Uint32Array(1);
	globalThis.crypto?.getRandomValues?.(bytes);
	const suffix = (bytes[0] || Math.floor(Math.random() * 0xffffffff))
		.toString(16)
		.padStart(8, '0')
		.slice(-8);
	return `device-${suffix}`;
}

export function generateRandomCustomMacAddress() {
	const bytes = new Uint8Array(6);
	globalThis.crypto?.getRandomValues?.(bytes);
	if (bytes.every((value) => value === 0)) {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}
	bytes[0] = (bytes[0] | 0x02) & 0xfe;
	return Array.from(bytes, (value) => value.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCookieEntry(value: unknown): value is CookieStateFile['managed_cookies'][number] {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.cookie_id === 'string' &&
		typeof value.url === 'string' &&
		typeof value.name === 'string' &&
		typeof value.value === 'string'
	);
}

export function parseCookieStateJson(input: string): CookieStateParseResult {
	const trimmed = input.trim();
	if (!trimmed) {
		return {
			ok: false,
			error: 'Cookie JSON 不能为空',
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return {
			ok: false,
			error: 'Cookie JSON 必须是合法 JSON',
		};
	}

	if (!isRecord(parsed)) {
		return {
			ok: false,
			error: 'Cookie JSON 顶层必须是对象',
		};
	}

	if (!Array.isArray(parsed.managed_cookies)) {
		return {
			ok: false,
			error: 'Cookie JSON 必须包含 managed_cookies 数组',
		};
	}

	if (!parsed.managed_cookies.every(isValidCookieEntry)) {
		return {
			ok: false,
			error: 'Cookie JSON 中每条 Cookie 至少需要 cookie_id、url、name、value',
		};
	}

	return {
		ok: true,
		value: parsed as CookieStateFile,
	};
}

export function normalizeCookieStateJson(
	input: string | null | undefined,
	environmentId?: string | null,
) {
	const trimmed = input?.trim() ?? '';
	if (!trimmed) {
		return '';
	}
	const parsed = parseCookieStateJson(trimmed);
	if (!parsed.ok) {
		return trimmed;
	}
	const normalized: CookieStateFile = {
		...parsed.value,
		environment_id: parsed.value.environment_id?.trim() || environmentId?.trim() || undefined,
	};
	return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function mergeCookieStateJson(
	currentInput: string,
	incomingInput: string,
	environmentId?: string | null,
) {
	const current = parseCookieStateJson(currentInput);
	if (!current.ok) {
		throw new Error(current.error);
	}
	const incoming = parseCookieStateJson(incomingInput);
	if (!incoming.ok) {
		throw new Error(incoming.error);
	}

	const merged = new Map<string, CookieStateFile['managed_cookies'][number]>();
	for (const cookie of current.value.managed_cookies) {
		const key = `${cookie.name}\u0000${cookie.domain ?? ''}\u0000${cookie.path ?? ''}`;
		merged.set(key, cookie);
	}
	for (const cookie of incoming.value.managed_cookies) {
		const key = `${cookie.name}\u0000${cookie.domain ?? ''}\u0000${cookie.path ?? ''}`;
		merged.set(key, cookie);
	}

	return `${JSON.stringify(
		{
			environment_id: current.value.environment_id?.trim() || environmentId?.trim() || undefined,
			managed_cookies: Array.from(merged.values()),
		} satisfies CookieStateFile,
		null,
		2,
	)}\n`;
}

export function deriveCookieSiteUrls(cookieState: CookieStateFile) {
	const sites = new Set<string>();
	for (const cookie of cookieState.managed_cookies) {
		try {
			const parsed = new URL(cookie.url);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				continue;
			}
			sites.add(`${parsed.origin}/`);
		} catch {}
	}
	return Array.from(sites).sort((left, right) => left.localeCompare(right));
}

export function dedupeProfilePluginSelections(
	selections: ProfilePluginSelection[],
): ProfilePluginSelection[] {
	const merged = new Map<string, ProfilePluginSelection>();
	for (const selection of selections) {
		const packageId = selection.packageId.trim();
		if (!packageId) {
			continue;
		}
		merged.set(packageId, {
			packageId,
			enabled: selection.enabled,
		});
	}
	return Array.from(merged.values());
}

export function resolveInitialCustomDeviceIdentityValues(
	storedValues:
		| Pick<
				ProfileFingerprintSettings,
				'deviceNameMode' | 'customDeviceName' | 'macAddressMode' | 'customMacAddress'
		  >
		| null
		| undefined,
	randomValues: DeviceIdentityRandomValues,
): CustomDeviceIdentityValues {
	return {
		deviceNameMode: storedValues?.deviceNameMode === 'custom' ? 'custom' : 'real',
		customDeviceName: storedValues?.customDeviceName?.trim() || randomValues.deviceName,
		macAddressMode: storedValues?.macAddressMode === 'custom' ? 'custom' : 'real',
		customMacAddress: storedValues?.customMacAddress?.trim() || randomValues.macAddress,
	};
}

function versionParts(version: string) {
	return version.split('.').map((value) => Number.parseInt(value, 10) || 0);
}

export function compareVersions(left: string, right: string) {
	const leftParts = versionParts(left);
	const rightParts = versionParts(right);
	const length = Math.max(leftParts.length, rightParts.length);
	for (let index = 0; index < length; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;
		if (leftValue !== rightValue) {
			return rightValue - leftValue;
		}
	}
	return 0;
}

export function buildFingerprintSource(
	values: Pick<
		ProfileFormValues,
		'platform' | 'browserVersion' | 'devicePresetId' | 'randomFingerprint'
	>,
): ProfileFingerprintSource {
	return {
		platform: values.platform,
		devicePresetId: values.devicePresetId,
		browserVersion: values.browserVersion,
		strategy: values.randomFingerprint ? 'random_bundle' : 'template',
		seedPolicy: values.randomFingerprint ? 'per_launch' : 'fixed',
	};
}

export function generateRandomFingerprintSeed() {
	const bytes = new Uint32Array(1);
	globalThis.crypto?.getRandomValues?.(bytes);
	return bytes[0] || Math.floor(Math.random() * 0xffffffff);
}

export function buildResolutionValuesFromPreset(
	preset: ResolutionPresetInput | null | undefined,
): ProfileResolutionValues | null {
	if (!preset) {
		return null;
	}
	return {
		viewportWidth: preset.viewportWidth,
		viewportHeight: preset.viewportHeight,
		deviceScaleFactor: preset.deviceScaleFactor,
	};
}

export function resolveInitialResolutionValues(
	storedValues: Partial<ProfileResolutionValues> | null | undefined,
	preset: ResolutionPresetInput | null | undefined,
): ProfileResolutionValues | null {
	if (
		typeof storedValues?.viewportWidth === 'number' &&
		typeof storedValues?.viewportHeight === 'number' &&
		typeof storedValues?.deviceScaleFactor === 'number'
	) {
		return {
			viewportWidth: storedValues.viewportWidth,
			viewportHeight: storedValues.viewportHeight,
			deviceScaleFactor: storedValues.deviceScaleFactor,
		};
	}
	return buildResolutionValuesFromPreset(preset);
}

export function mergePreviewSnapshot(
	snapshot: ProfileFingerprintSnapshot | null,
	language: string,
	timezoneId: string,
	resolution?: Partial<ProfileResolutionValues> | null,
): ProfileFingerprintSnapshot | null {
	if (!snapshot) {
		return null;
	}
	const trimmedLanguage = language.trim();
	const trimmedTimezone = timezoneId.trim();
	return {
		...snapshot,
		language: trimmedLanguage || snapshot.language,
		acceptLanguages: trimmedLanguage
			? buildAcceptLanguages(trimmedLanguage)
			: snapshot.acceptLanguages,
		timeZone: trimmedTimezone || snapshot.timeZone,
		windowWidth:
			typeof resolution?.viewportWidth === 'number'
				? resolution.viewportWidth
				: snapshot.windowWidth,
		windowHeight:
			typeof resolution?.viewportHeight === 'number'
				? resolution.viewportHeight
				: snapshot.windowHeight,
		deviceScaleFactor:
			typeof resolution?.deviceScaleFactor === 'number'
				? resolution.deviceScaleFactor
				: snapshot.deviceScaleFactor,
	};
}
