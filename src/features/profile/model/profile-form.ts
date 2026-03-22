import { z } from 'zod/v3';

import type {
	ProfileDevicePresetItem,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfileFingerprintSettings,
	WebRtcMode,
} from '@/entities/profile/model/types';

export const DEFAULT_STARTUP_URL = 'https://www.browserscan.net/';
const DEVICE_NAME_PATTERN = /^[A-Za-z0-9-]{1,63}$/;
const MAC_ADDRESS_PATTERN = /^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/i;

export const profileFormSchema = z
	.object({
		name: z.string().trim().min(1, '环境名称不能为空'),
		group: z.string(),
		note: z.string(),
		browserKind: z.string().trim().min(1),
		browserVersion: z.string().trim().min(1, '浏览器版本不能为空'),
		platform: z.string().trim().min(1, '模拟平台不能为空'),
		devicePresetId: z.string().trim().min(1, '设备预设不能为空'),
		startupUrls: z.string(),
		browserBgColor: z
			.string()
			.trim()
			.regex(/^#[0-9a-fA-F]{6}$/, '浏览器背景色必须是 #RRGGBB 格式'),
		proxyId: z.string(),
		language: z.string(),
		timezoneId: z.string(),
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
		randomFingerprint: z.boolean(),
		customLaunchArgsText: z.string(),
		geolocationMode: z.enum(['off', 'ip', 'custom']),
		autoAllowGeolocation: z.boolean(),
		latitude: z.string(),
		longitude: z.string(),
		accuracy: z.string(),
		viewportWidth: z.number().int().min(1, '分辨率宽度必须大于 0'),
		viewportHeight: z.number().int().min(1, '分辨率高度必须大于 0'),
		deviceScaleFactor: z.number().positive('DPR 必须大于 0'),
		fingerprintSeed: z.number().int().nonnegative().nullable(),
	})
	.superRefine((values, ctx) => {
		const startupUrls = parseStartupUrls(values.startupUrls);
		for (const startupUrl of startupUrls) {
			try {
				const parsed = new URL(startupUrl);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: '默认打开 URL 必须是 http 或 https',
						path: ['startupUrls'],
					});
					break;
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '默认打开 URL 格式不正确',
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
					message: 'WebRTC 选择替换时，必须填写 IP',
					path: ['webrtcIpOverride'],
				});
			}
		}

		if (values.deviceNameMode === 'custom') {
			const deviceName = values.customDeviceName.trim();
			if (!deviceName) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '设备名称选择自定义时不能为空',
					path: ['customDeviceName'],
				});
			} else if (!DEVICE_NAME_PATTERN.test(deviceName)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '设备名称仅支持 ASCII 字母、数字和连字符，长度 1-63',
					path: ['customDeviceName'],
				});
			}
		}

		if (values.macAddressMode === 'custom') {
			const macAddress = values.customMacAddress.trim();
			if (!macAddress) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'MAC 地址选择自定义时不能为空',
					path: ['customMacAddress'],
				});
			} else if (!MAC_ADDRESS_PATTERN.test(macAddress)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'MAC 地址必须是合法的 AA:BB:CC:DD:EE:FF 格式',
					path: ['customMacAddress'],
				});
			}
		}

		const fontList = values.customFontListText
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
		if (fontList.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '字体列表不能为空',
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
				message: '纬度范围必须是 -90 到 90',
				path: ['latitude'],
			});
		}
		const lngText = values.longitude.trim();
		const lng = Number(lngText);
		if (!lngText || !Number.isFinite(lng) || lng < -180 || lng > 180) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '经度范围必须是 -180 到 180',
				path: ['longitude'],
			});
		}
		if (values.accuracy.trim()) {
			const acc = Number(values.accuracy);
			if (!Number.isFinite(acc) || acc <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '地理精度必须大于 0',
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

export type ProxySuggestionFieldSource = 'manual' | 'proxy' | 'empty';
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

export function resolveProxySuggestedValues(
	proxy: ProxyLocaleSuggestionInput | null | undefined,
) {
	if (!proxy) {
		return {
			language: '',
			timezoneId: '',
			geolocation: null,
		};
	}
	return {
		language: proxy.effectiveLanguage?.trim() || proxy.suggestedLanguage?.trim() || '',
		timezoneId:
			proxy.effectiveTimezone?.trim() || proxy.suggestedTimezone?.trim() || '',
		geolocation:
			proxy.latitude !== null && proxy.longitude !== null
				? {
						latitude: proxy.latitude.toString(),
						longitude: proxy.longitude.toString(),
						accuracy:
							proxy.geoAccuracyMeters === null
								? ''
								: proxy.geoAccuracyMeters.toString(),
					}
				: null,
	};
}

export function normalizeWebRtcMode(value?: string): WebRtcMode {
	if (
		value === 'replace' ||
		value === 'disable' ||
		value === 'real' ||
		value === 'follow_ip'
	) {
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
		[shuffled[index], shuffled[swapIndex]] = [
			shuffled[swapIndex],
			shuffled[index],
		];
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
	return Array.from(bytes, (value) =>
		value.toString(16).padStart(2, '0').toUpperCase(),
	).join(':');
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
		customDeviceName:
			storedValues?.customDeviceName?.trim() || randomValues.deviceName,
		macAddressMode: storedValues?.macAddressMode === 'custom' ? 'custom' : 'real',
		customMacAddress:
			storedValues?.customMacAddress?.trim() || randomValues.macAddress,
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
	storedValues:
		| Partial<ProfileResolutionValues>
		| null
		| undefined,
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
