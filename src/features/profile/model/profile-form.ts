import { z } from 'zod/v3';

import type {
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	WebRtcMode,
} from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';

export const DEFAULT_STARTUP_URL = 'https://www.browserscan.net/';

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
		webRtcMode: z.enum(['real', 'replace', 'disable']),
		webrtcIpOverride: z.string(),
		headless: z.boolean(),
		disableImages: z.boolean(),
		randomFingerprint: z.boolean(),
		customLaunchArgsText: z.string(),
		geoEnabled: z.boolean(),
		latitude: z.string(),
		longitude: z.string(),
		accuracy: z.string(),
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

		if (!values.geoEnabled) {
			return;
		}

		const lat = Number(values.latitude);
		if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: '纬度范围必须是 -90 到 90',
				path: ['latitude'],
			});
		}
		const lng = Number(values.longitude);
		if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
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

export type ProxySuggestionFieldSource = 'manual' | 'proxy' | 'empty';

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
	proxy:
		| Pick<
				ProxyItem,
				| 'suggestedLanguage'
				| 'suggestedTimezone'
				| 'latitude'
				| 'longitude'
				| 'geoAccuracyMeters'
		  >
		| null
		| undefined,
) {
	if (!proxy) {
		return {
			language: '',
			timezoneId: '',
			geolocation: null,
		};
	}
	return {
		language: proxy.suggestedLanguage?.trim() || '',
		timezoneId: proxy.suggestedTimezone?.trim() || '',
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
	if (value === 'replace' || value === 'disable' || value === 'real') {
		return value;
	}
	return 'real';
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

export function mergePreviewSnapshot(
	snapshot: ProfileFingerprintSnapshot | null,
	language: string,
	timezoneId: string,
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
	};
}
