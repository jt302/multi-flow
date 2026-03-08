import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CircleAlert, Loader2, Plus, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Icon,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import {
	listProfileFontFamilies,
	listFingerprintPresets,
	previewFingerprintBundle,
} from '../api/profiles-api';
import { PlatformGlyph } from '../components/platform-mark';
import type {
	CreateProfilePayload,
	GroupItem,
	ProfileDevicePresetItem,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfileItem,
	ProxyItem,
	ResourceItem,
	WebRtcMode,
} from '../types';
import { PLATFORM_OPTIONS, detectClientPlatform } from '../utils';

const DEFAULT_STARTUP_URL = 'https://www.browserscan.net/';

const profileFormSchema = z
	.object({
		name: z.string().trim().min(1, '环境名称不能为空'),
		group: z.string(),
		note: z.string(),
		browserKind: z.string().trim().min(1),
		browserVersion: z.string().trim().min(1, '浏览器版本不能为空'),
		platform: z.string().trim().min(1, '模拟平台不能为空'),
		devicePresetId: z.string().trim().min(1, '设备预设不能为空'),
		startupUrl: z.string(),
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
		const startupUrl = values.startupUrl.trim();
		if (startupUrl) {
			try {
				const parsed = new URL(startupUrl);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: '默认打开 URL 必须是 http 或 https',
						path: ['startupUrl'],
					});
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '默认打开 URL 格式不正确',
					path: ['startupUrl'],
				});
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

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type ProfileCreatePageProps = {
	groups: GroupItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	onSubmit: (payload: CreateProfilePayload) => Promise<void>;
	onBack: () => void;
	mode?: 'create' | 'edit';
	initialProfile?: ProfileItem;
	initialProxyId?: string;
};

function sectionTitle(title: string, desc: string) {
	return (
		<div className="mb-2">
			<p className="text-sm font-semibold">{title}</p>
			<p className="text-xs text-muted-foreground">{desc}</p>
		</div>
	);
}

function normalizeWebRtcMode(value?: string): WebRtcMode {
	if (value === 'replace' || value === 'disable' || value === 'real') {
		return value;
	}
	return 'real';
}

function buildAcceptLanguages(language: string): string | undefined {
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

function parseCustomFontList(text: string): string[] {
	return Array.from(
		new Set(
			text
				.split('\n')
				.map((item) => item.trim())
				.filter(Boolean),
		),
	);
}

function randomizeFontList(pool: string[]): string[] {
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
	const targetCount = Math.max(48, Math.min(shuffled.length, Math.round(shuffled.length * keepRatio)));
	return shuffled.slice(0, targetCount);
}

function versionParts(version: string) {
	return version.split('.').map((value) => Number.parseInt(value, 10) || 0);
}

function compareVersions(left: string, right: string) {
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

function buildFingerprintSource(
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

function mergePreviewSnapshot(
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

function resourceStatusLabel(item: ResourceItem | undefined) {
	if (!item) {
		return '当前宿主系统无该版本资源';
	}
	return item.installed ? '已安装' : '未下载，启动时自动下载';
}

function PlatformOptionCard({
	value,
	selected,
	onSelect,
}: {
	value: (typeof PLATFORM_OPTIONS)[number];
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			type="button"
			variant="outline"
			className={cn(
				'h-auto cursor-pointer justify-start rounded-xl border px-3 py-3 text-left whitespace-normal shadow-none transition-colors',
				selected
					? 'border-primary/35 bg-primary/65 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-primary/18 hover:text-slate-50 dark:border-primary/30 dark:bg-primary/12 dark:hover:bg-primary/16 dark:hover:text-slate-50'
					: 'bg-background text-foreground hover:border-primary/25 hover:bg-accent/40 hover:text-foreground',
			)}
			onClick={onSelect}
		>
			<div className="flex w-full min-w-0 items-start gap-3">
				<div
					className={cn(
						'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
						selected
							? 'border-white/15 bg-white/10 text-slate-50'
							: `${value.badgeClass} border-border/60`,
					)}
				>
					<PlatformGlyph meta={value} size="lg" forceLight={selected} />
				</div>
				<div className="min-w-0 space-y-1">
					<p className="min-w-0 break-words text-base font-semibold leading-none">
						{value.label}
					</p>
					<p
						className={cn(
							'text-xs leading-5',
							selected ? 'text-slate-50/75' : 'text-muted-foreground',
						)}
					>
						{value.hint}
					</p>
				</div>
			</div>
		</Button>
	);
}

export function ProfileCreatePage({
	groups,
	proxies,
	resources,
	onSubmit,
	onBack,
	mode = 'create',
	initialProfile,
	initialProxyId,
}: ProfileCreatePageProps) {
	const initialBasic = initialProfile?.settings?.basic;
	const initialFingerprint = initialProfile?.settings?.fingerprint;
	const initialAdvanced = initialProfile?.settings?.advanced;
	const hostPlatform = detectClientPlatform();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [availableDevicePresets, setAvailableDevicePresets] = useState<
		ProfileDevicePresetItem[]
	>([]);
	const [devicePresetsLoading, setDevicePresetsLoading] = useState(false);
	const [devicePresetsError, setDevicePresetsError] = useState<string | null>(
		null,
	);
	const [availableFontFamilies, setAvailableFontFamilies] = useState<string[]>([]);
	const initialRandomFontsApplied = useRef(false);
	const [previewSnapshot, setPreviewSnapshot] =
		useState<ProfileFingerprintSnapshot | null>(
			initialFingerprint?.fingerprintSnapshot ?? null,
		);

	const hostChromiumVersions = useMemo(() => {
		return resources
			.filter(
				(item) => item.kind === 'chromium' && item.platform === hostPlatform,
			)
			.slice()
			.sort((left, right) => compareVersions(left.version, right.version));
	}, [hostPlatform, resources]);
	const latestHostVersion = hostChromiumVersions[0]?.version ?? '';
	const defaultPlatform = initialBasic?.platform ?? detectClientPlatform();
	const defaultBrowserVersion =
		initialBasic?.browserVersion ?? latestHostVersion;

	const groupSuggestions = useMemo(() => {
		const names = groups.map((item) => item.name.trim()).filter(Boolean);
		return Array.from(new Set(names)).slice(0, 8);
	}, [groups]);

	const availableProxies = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'active'),
		[proxies],
	);

	const {
		register,
		handleSubmit,
		getValues,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			name: initialProfile?.name ?? '',
			group:
				initialProfile?.group === '未分组' ? '' : (initialProfile?.group ?? ''),
			note:
				initialProfile?.note === '未填写备注'
					? ''
					: (initialProfile?.note ?? ''),
			browserKind: initialBasic?.browserKind ?? 'chromium',
			browserVersion: defaultBrowserVersion,
			platform: defaultPlatform,
			devicePresetId: initialBasic?.devicePresetId ?? '',
			startupUrl: initialBasic?.startupUrl ?? DEFAULT_STARTUP_URL,
			browserBgColor: initialBasic?.browserBgColor ?? '#0F8A73',
			proxyId: initialProxyId ?? '__none__',
			language: initialFingerprint?.fingerprintSnapshot?.language ?? '',
			timezoneId: initialFingerprint?.fingerprintSnapshot?.timeZone ?? '',
			customFontListText:
				initialFingerprint?.customFontList?.join('\n') ??
				initialFingerprint?.fingerprintSnapshot?.customFontList?.join('\n') ??
				'',
			webRtcMode: normalizeWebRtcMode(initialFingerprint?.webRtcMode),
			webrtcIpOverride: initialFingerprint?.webrtcIpOverride ?? '',
			headless: initialAdvanced?.headless ?? false,
			disableImages: initialAdvanced?.disableImages ?? false,
			randomFingerprint: initialAdvanced?.randomFingerprint ?? true,
			customLaunchArgsText: initialAdvanced?.customLaunchArgs?.join('\n') ?? '',
			geoEnabled: Boolean(initialAdvanced?.geolocation),
			latitude: initialAdvanced?.geolocation?.latitude?.toString() ?? '',
			longitude: initialAdvanced?.geolocation?.longitude?.toString() ?? '',
			accuracy: initialAdvanced?.geolocation?.accuracy?.toString() ?? '',
		},
	});

	const browserKind = watch('browserKind');
	const browserVersion = watch('browserVersion');
	const browserBgColor = watch('browserBgColor');
	const platform = watch('platform');
	const proxyId = watch('proxyId');
	const devicePresetId = watch('devicePresetId');
	const customFontListText = watch('customFontListText');
	const webRtcMode = watch('webRtcMode');
	const randomFingerprint = watch('randomFingerprint');
	const language = watch('language');
	const timezoneId = watch('timezoneId');
	const geoEnabled = watch('geoEnabled');

	const selectedResource = useMemo(
		() => hostChromiumVersions.find((item) => item.version === browserVersion),
		[browserVersion, hostChromiumVersions],
	);
	const mergedPreviewSnapshot = useMemo(
		() => mergePreviewSnapshot(previewSnapshot, language, timezoneId),
		[language, previewSnapshot, timezoneId],
	);

	const regenerateFontList = useCallback(async () => {
		if (!platform) {
			return;
		}
		const pool = await listProfileFontFamilies(platform);
		const randomized = randomizeFontList(pool);
		setValue('customFontListText', randomized.join('\n'), {
			shouldDirty: true,
			shouldValidate: true,
		});
		setAvailableFontFamilies(pool);
	}, [platform, setValue]);

	useEffect(() => {
		if (
			browserVersion &&
			hostChromiumVersions.some((item) => item.version === browserVersion)
		) {
			return;
		}
		if (!latestHostVersion) {
			return;
		}
		setValue('browserVersion', latestHostVersion, {
			shouldDirty: !browserVersion,
			shouldValidate: true,
		});
	}, [browserVersion, hostChromiumVersions, latestHostVersion, setValue]);

	useEffect(() => {
		let active = true;
		setDevicePresetsLoading(true);
		setDevicePresetsError(null);
		void listFingerprintPresets(platform, browserVersion)
			.then((items) => {
				if (!active) {
					return;
				}
				setAvailableDevicePresets(items);
				if (!items.some((item) => item.id === devicePresetId)) {
					setValue('devicePresetId', items[0]?.id ?? '', {
						shouldDirty: items.length > 0,
						shouldValidate: true,
					});
				}
			})
			.catch((error) => {
				if (!active) {
					return;
				}
				setAvailableDevicePresets([]);
				setDevicePresetsError(
					error instanceof Error ? error.message : '加载设备预设失败',
				);
			})
			.finally(() => {
				if (active) {
					setDevicePresetsLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [browserVersion, devicePresetId, platform, setValue]);

	useEffect(() => {
		let active = true;
		if (!platform) {
			setAvailableFontFamilies([]);
			return;
		}
		void listProfileFontFamilies(platform)
			.then((items) => {
				if (active) {
					setAvailableFontFamilies(items);
				}
			})
			.catch(() => {
				if (active) {
					setAvailableFontFamilies([]);
				}
			});
		return () => {
			active = false;
		};
	}, [platform]);

	useEffect(() => {
		if (initialRandomFontsApplied.current) {
			return;
		}
		if (initialProfile) {
			initialRandomFontsApplied.current = true;
			return;
		}
		if (getValues('customFontListText').trim()) {
			initialRandomFontsApplied.current = true;
			return;
		}
		if (!platform || !browserVersion || !devicePresetId) {
			return;
		}
		initialRandomFontsApplied.current = true;
		void regenerateFontList().catch((error) => {
			setPreviewError(
				error instanceof Error ? error.message : '随机生成字体列表失败',
			);
			initialRandomFontsApplied.current = false;
		});
	}, [
		browserVersion,
		devicePresetId,
		getValues,
		initialProfile,
		platform,
		regenerateFontList,
	]);

	useEffect(() => {
		if (!platform || !browserVersion || !devicePresetId) {
			setPreviewSnapshot(null);
			return;
		}
		const customFonts = parseCustomFontList(customFontListText);
		if (customFonts.length === 0) {
			setPreviewSnapshot(null);
			setPreviewError(null);
			return;
		}
		let active = true;
		setPreviewLoading(true);
		setPreviewError(null);
		void previewFingerprintBundle(
			buildFingerprintSource({
				platform,
				browserVersion,
				devicePresetId,
				randomFingerprint,
			}),
			{
				fontListMode: 'custom',
				customFontList: customFonts,
			},
		)
			.then((snapshot) => {
				if (!active) {
					return;
				}
				setPreviewSnapshot(snapshot);
			})
			.catch((error) => {
				if (!active) {
					return;
				}
				setPreviewSnapshot(null);
				setPreviewError(
					error instanceof Error ? error.message : '指纹摘要预览失败',
				);
			})
			.finally(() => {
				if (active) {
					setPreviewLoading(false);
				}
			});
		return () => {
			active = false;
		};
	}, [
		browserVersion,
		customFontListText,
		devicePresetId,
		platform,
		randomFingerprint,
	]);

	const onFormSubmit = async (values: ProfileFormValues) => {
		setSubmitError(null);
		const customLaunchArgs = values.customLaunchArgsText
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		const source = buildFingerprintSource(values);
		let snapshot = mergePreviewSnapshot(
			previewSnapshot,
			values.language,
			values.timezoneId,
		);
		if (!snapshot) {
			snapshot = mergePreviewSnapshot(
				await previewFingerprintBundle(source, {
					fontListMode: 'custom',
					customFontList: parseCustomFontList(values.customFontListText),
				}),
				values.language,
				values.timezoneId,
			);
		}
		if (!snapshot) {
			setSubmitError('指纹摘要尚未就绪，请稍后再试');
			return;
		}

		let geolocation:
			| { latitude: number; longitude: number; accuracy?: number }
			| undefined;
		if (values.geoEnabled) {
			const accuracy = values.accuracy.trim()
				? Number(values.accuracy.trim())
				: undefined;
			geolocation = {
				latitude: Number(values.latitude),
				longitude: Number(values.longitude),
				accuracy,
			};
		}

		const payload: CreateProfilePayload = {
			name: values.name.trim(),
			group: values.group.trim() || undefined,
			note: values.note.trim() || undefined,
			proxyId: values.proxyId === '__none__' ? undefined : values.proxyId,
			settings: {
				basic: {
					browserKind: values.browserKind,
					browserVersion: values.browserVersion,
					platform: values.platform,
					devicePresetId: values.devicePresetId,
					startupUrl: values.startupUrl.trim() || undefined,
					browserBgColor: values.browserBgColor.trim() || undefined,
				},
				fingerprint: {
					fingerprintSource: source,
					fingerprintSnapshot: snapshot,
					language: values.language.trim() || undefined,
					timezoneId: values.timezoneId.trim() || undefined,
					fontListMode: 'custom',
					customFontList: parseCustomFontList(values.customFontListText),
					webRtcMode: values.webRtcMode,
					webrtcIpOverride:
						values.webRtcMode === 'replace'
							? values.webrtcIpOverride.trim() || undefined
							: undefined,
				},
				advanced: {
					headless: values.headless,
					disableImages: values.disableImages,
					customLaunchArgs: customLaunchArgs.length
						? customLaunchArgs
						: undefined,
					randomFingerprint: values.randomFingerprint,
					fixedFingerprintSeed: values.randomFingerprint
						? undefined
						: snapshot.fingerprintSeed,
					geolocation,
				},
			},
		};

		try {
			await onSubmit(payload);
			onBack();
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : '保存环境失败');
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/65 px-3 py-2.5">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						profiles / create
					</p>
					<h2 className="text-base font-semibold">
						{mode === 'edit' ? '修改环境配置' : '创建环境'}
					</h2>
				</div>
				<Button
					type="button"
					variant="outline"
					className="cursor-pointer"
					onClick={onBack}
				>
					<Icon icon={ArrowLeft} size={14} />
					返回列表
				</Button>
			</div>

			<Card className="p-4">
				<CardHeader className="p-0 pb-2">
					<CardTitle className="text-sm">完整配置创建</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 p-0">
					<form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
						<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
							<div className="space-y-4">
								<div className="rounded-xl border border-border/70 p-3">
									{sectionTitle(
										'基础设置',
										'环境名称、浏览器版本、模拟平台、设备预设与分组',
									)}
									<div className="grid gap-3 md:grid-cols-2">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">
												环境名称
											</p>
											<Input
												{...register('name')}
												placeholder="例如 AirDrop-001"
												autoFocus
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">分组</p>
											<Input
												{...register('group')}
												placeholder="例如 AirDrop"
											/>
											{groupSuggestions.length > 0 ? (
												<div className="mt-1 flex flex-wrap gap-1">
													{groupSuggestions.map((value) => (
														<Button
															key={value}
															type="button"
															size="sm"
															variant="ghost"
															className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
															onClick={() =>
																setValue('group', value, { shouldDirty: true })
															}
														>
															{value}
														</Button>
													))}
												</div>
											) : null}
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">
												浏览器内核
											</p>
											<Select
												value={browserKind}
												onValueChange={(value) =>
													setValue('browserKind', value, { shouldDirty: true })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="选择内核" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="chromium">Chromium</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div>
											<div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
												<span>浏览器版本</span>
												<Badge
													variant={
														selectedResource?.installed
															? 'secondary'
															: 'outline'
													}
												>
													{resourceStatusLabel(selectedResource)}
												</Badge>
											</div>
											<Select
												value={browserVersion}
												onValueChange={(value) =>
													setValue('browserVersion', value, {
														shouldDirty: true,
														shouldValidate: true,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="选择浏览器版本" />
												</SelectTrigger>
												<SelectContent>
													{hostChromiumVersions.map((item) => (
														<SelectItem key={item.id} value={item.version}>
															{item.version} ·{' '}
															{item.installed ? '已安装' : '未下载'}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="mt-1 text-[11px] text-muted-foreground">
												仅展示当前宿主系统 {hostPlatform} 可运行的 Chromium
												版本。
											</p>
										</div>
										<div className="md:col-span-2">
											<p className="mb-1 text-xs text-muted-foreground">
												模拟平台
											</p>
											<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
												{PLATFORM_OPTIONS.map((item) => (
													<PlatformOptionCard
														key={item.value}
														value={item}
														selected={platform === item.value}
														onSelect={() =>
															setValue('platform', item.value, {
																shouldDirty: true,
																shouldValidate: true,
															})
														}
													/>
												))}
											</div>
										</div>
										<div className="md:col-span-2">
											<p className="mb-1 text-xs text-muted-foreground">
												设备预设
											</p>
											<Select
												value={devicePresetId}
												onValueChange={(value) =>
													setValue('devicePresetId', value, {
														shouldDirty: true,
														shouldValidate: true,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="选择设备预设" />
												</SelectTrigger>
												<SelectContent>
													{availableDevicePresets.map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.label} · {item.viewportWidth}x
															{item.viewportHeight} · DPR{' '}
															{item.deviceScaleFactor}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="mt-1 text-[11px] text-muted-foreground">
												{devicePresetsLoading
													? '设备预设加载中...'
													: devicePresetsError
														? `设备预设加载失败：${devicePresetsError}`
														: '预设会决定 UA、UA metadata、窗口尺寸、DPR、GL、字体、CPU、RAM 等整套指纹参数'}
											</p>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">备注</p>
											<Input
												{...register('note')}
												placeholder="业务描述、批次等"
											/>
										</div>
										<div className="md:col-span-2">
											<p className="mb-1 text-xs text-muted-foreground">
												默认打开 URL
											</p>
											<Input
												{...register('startupUrl')}
												placeholder={DEFAULT_STARTUP_URL}
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">
												浏览器背景色
											</p>
											<div className="flex items-center gap-2">
												<Input
													type="color"
													value={browserBgColor}
													onChange={(event) =>
														setValue('browserBgColor', event.target.value, {
															shouldDirty: true,
															shouldValidate: true,
														})
													}
													className="h-10 w-12 cursor-pointer rounded-lg p-1"
												/>
												<Input
													{...register('browserBgColor')}
													placeholder="#0F8A73"
												/>
											</div>
										</div>
									</div>
								</div>

								<div className="rounded-xl border border-border/70 p-3">
									{sectionTitle(
										'指纹策略',
										'只配置上层意图，系统按平台/设备/版本自动解析整套指纹',
									)}
									<div className="grid gap-3 md:grid-cols-2">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">语言</p>
											<Input
												{...register('language')}
												placeholder="如 zh-CN / en-US"
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">时区</p>
											<Input
												{...register('timezoneId')}
												placeholder="如 Asia/Shanghai"
											/>
										</div>
										<div className="md:col-span-2">
											<div className="mb-1 flex items-center justify-between gap-2">
												<p className="text-xs text-muted-foreground">
													字体列表
												</p>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
													onClick={() => {
														void regenerateFontList().catch((error) => {
															setPreviewError(
																error instanceof Error
																	? error.message
																	: '随机生成字体列表失败',
															);
														});
													}}
												>
													<Icon icon={Sparkles} size={12} />
													随机生成
												</Button>
											</div>
											<Textarea
												{...register('customFontListText')}
												placeholder={'Arial\nHelvetica Neue\nSegoe UI'}
												className="min-h-[140px]"
											/>
											<p className="mt-1 text-[11px] text-muted-foreground">
												当前平台字体池 {availableFontFamilies.length} 项。进入页面会先随机生成一套，可继续手动修改。
											</p>
										</div>
										<div className="md:col-span-2">
											<p className="mb-1 text-xs text-muted-foreground">
												WebRTC
											</p>
											<Select
												value={webRtcMode}
												onValueChange={(value) =>
													setValue('webRtcMode', value as WebRtcMode, {
														shouldDirty: true,
														shouldValidate: true,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="选择 WebRTC 策略" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="real">真实（不覆盖）</SelectItem>
													<SelectItem value="replace">
														替换（指定 IP）
													</SelectItem>
													<SelectItem value="disable">禁用</SelectItem>
												</SelectContent>
											</Select>
										</div>
										{webRtcMode === 'replace' ? (
											<div className="md:col-span-2">
												<p className="mb-1 text-xs text-muted-foreground">
													WebRTC 替换 IP
												</p>
												<Input
													{...register('webrtcIpOverride')}
													placeholder="例如 8.8.8.8"
												/>
											</div>
										) : null}
										<label className="flex items-center gap-2 text-sm md:col-span-2">
											<Checkbox
												checked={randomFingerprint}
												onCheckedChange={(checked) =>
													setValue('randomFingerprint', checked === true, {
														shouldDirty: true,
													})
												}
											/>
											随机整套指纹（每次启动使用新的 bundle / fingerprint-seed）
										</label>
									</div>
								</div>

								<div className="rounded-xl border border-border/70 p-3">
									{sectionTitle('代理配置', '创建环境时直接绑定代理')}
									<Select
										value={proxyId || '__none__'}
										onValueChange={(value) =>
											setValue('proxyId', value, { shouldDirty: true })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="不绑定代理" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">不绑定代理</SelectItem>
											{availableProxies.map((item) => (
												<SelectItem key={item.id} value={item.id}>
													{item.name} · {item.protocol.toUpperCase()}://
													{item.host}:{item.port}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="rounded-xl border border-border/70 p-3">
									{sectionTitle('高级设置', '无头模式、启动参数与地理位置')}
									<div className="space-y-3">
										<label className="flex items-center gap-2 text-sm">
											<Checkbox
												checked={watch('headless')}
												onCheckedChange={(checked) =>
													setValue('headless', checked === true, {
														shouldDirty: true,
													})
												}
											/>
											无头模式 (Headless)
										</label>
										<label className="flex items-center gap-2 text-sm">
											<Checkbox
												checked={watch('disableImages')}
												onCheckedChange={(checked) =>
													setValue('disableImages', checked === true, {
														shouldDirty: true,
													})
												}
											/>
											禁用图片加载
										</label>
										<label className="flex items-center gap-2 text-sm">
											<Checkbox
												checked={geoEnabled}
												onCheckedChange={(checked) =>
													setValue('geoEnabled', checked === true, {
														shouldDirty: true,
														shouldValidate: true,
													})
												}
											/>
											启用地理位置覆盖
										</label>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">
												自定义启动参数（每行一个）
											</p>
											<Textarea
												{...register('customLaunchArgsText')}
												placeholder={
													'--custom-main-language=zh-CN\n--custom-time-zone=Asia/Shanghai\n--disable-features=OptimizationHints'
												}
												className="min-h-[112px]"
											/>
										</div>
										{geoEnabled ? (
											<div className="grid gap-3 md:grid-cols-3">
												<div>
													<p className="mb-1 text-xs text-muted-foreground">
														纬度
													</p>
													<Input
														{...register('latitude')}
														placeholder="31.2304"
													/>
												</div>
												<div>
													<p className="mb-1 text-xs text-muted-foreground">
														经度
													</p>
													<Input
														{...register('longitude')}
														placeholder="121.4737"
													/>
												</div>
												<div>
													<p className="mb-1 text-xs text-muted-foreground">
														精度(米)
													</p>
													<Input {...register('accuracy')} placeholder="20" />
												</div>
											</div>
										) : null}
									</div>
								</div>

								{submitError ? (
									<p className="text-xs text-destructive">{submitError}</p>
								) : null}
								{errors.name?.message ? (
									<p className="text-xs text-destructive">
										{errors.name.message}
									</p>
								) : null}
								{errors.browserVersion?.message ? (
									<p className="text-xs text-destructive">
										{errors.browserVersion.message}
									</p>
								) : null}
								{errors.platform?.message ? (
									<p className="text-xs text-destructive">
										{errors.platform.message}
									</p>
								) : null}
								{errors.devicePresetId?.message ? (
									<p className="text-xs text-destructive">
										{errors.devicePresetId.message}
									</p>
								) : null}
								{errors.browserBgColor?.message ? (
									<p className="text-xs text-destructive">
										{errors.browserBgColor.message}
									</p>
								) : null}
								{errors.startupUrl?.message ? (
									<p className="text-xs text-destructive">
										{errors.startupUrl.message}
									</p>
								) : null}
								{errors.webrtcIpOverride?.message ? (
									<p className="text-xs text-destructive">
										{errors.webrtcIpOverride.message}
									</p>
								) : null}
								{errors.customFontListText?.message ? (
									<p className="text-xs text-destructive">
										{errors.customFontListText.message}
									</p>
								) : null}
								{errors.latitude?.message ? (
									<p className="text-xs text-destructive">
										{errors.latitude.message}
									</p>
								) : null}
								{errors.longitude?.message ? (
									<p className="text-xs text-destructive">
										{errors.longitude.message}
									</p>
								) : null}
								{errors.accuracy?.message ? (
									<p className="text-xs text-destructive">
										{errors.accuracy.message}
									</p>
								) : null}
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										className="flex-1 cursor-pointer"
										onClick={onBack}
									>
										取消
									</Button>
									<Button
										type="submit"
										className="flex-1 cursor-pointer"
										disabled={
											!watch('name').trim() ||
											isSubmitting ||
											!mergedPreviewSnapshot
										}
									>
										<Icon icon={Plus} size={14} />
										{isSubmitting
											? mode === 'edit'
												? '保存中...'
												: '创建中...'
											: mode === 'edit'
												? '保存修改'
												: '创建环境'}
									</Button>
								</div>
							</div>

							<div className="space-y-4 xl:sticky xl:top-3">
								<FingerprintSummaryCard
									hostPlatform={hostPlatform}
									browserVersion={browserVersion}
									selectedResource={selectedResource}
									randomFingerprint={randomFingerprint}
									previewLoading={previewLoading}
									previewError={previewError}
									mergedPreviewSnapshot={mergedPreviewSnapshot}
								/>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

type SummaryMetricProps = {
	label: string;
	value: string;
};

type FingerprintSummaryCardProps = {
	hostPlatform: string;
	browserVersion: string;
	selectedResource?: ResourceItem;
	randomFingerprint: boolean;
	previewLoading: boolean;
	previewError: string | null;
	mergedPreviewSnapshot: ProfileFingerprintSnapshot | null;
};

function FingerprintSummaryCard({
	hostPlatform,
	browserVersion,
	selectedResource,
	randomFingerprint,
	previewLoading,
	previewError,
	mergedPreviewSnapshot,
}: FingerprintSummaryCardProps) {
	return (
		<div className="rounded-xl border border-border/70 p-3">
			{sectionTitle(
				'指纹摘要',
				'右侧固定展示当前配置最终会注入给 Chromium 的关键参数',
			)}
			<div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-3">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<Badge variant="secondary">宿主资源 {hostPlatform}</Badge>
					<Badge
						variant={selectedResource?.installed ? 'secondary' : 'outline'}
					>
						{browserVersion || '未选择版本'} ·{' '}
						{resourceStatusLabel(selectedResource)}
					</Badge>
					{mergedPreviewSnapshot?.presetLabel ? (
						<Badge variant="outline">{mergedPreviewSnapshot.presetLabel}</Badge>
					) : null}
					{randomFingerprint ? (
						<Badge variant="outline">随机整套</Badge>
					) : (
						<Badge variant="secondary">固定指纹</Badge>
					)}
				</div>
				{previewLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Icon icon={Loader2} size={14} className="animate-spin" />
						正在解析指纹摘要...
					</div>
				) : mergedPreviewSnapshot ? (
					<div className="space-y-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								UserAgent
							</p>
							<p className="mt-1 break-words text-xs">
								{mergedPreviewSnapshot.userAgent || '未生成'}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								UA Metadata
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customUaMetadata || '未生成'}
							</p>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<SummaryMetric
								label="平台参数"
								value={mergedPreviewSnapshot.customPlatform || '未设置'}
							/>
							<SummaryMetric
								label="窗口 / DPR"
								value={
									mergedPreviewSnapshot.windowWidth &&
									mergedPreviewSnapshot.windowHeight
										? `${mergedPreviewSnapshot.windowWidth}x${mergedPreviewSnapshot.windowHeight} · ${mergedPreviewSnapshot.deviceScaleFactor ?? '-'}x`
										: '未设置'
								}
							/>
							<SummaryMetric
								label="CPU / RAM"
								value={
									mergedPreviewSnapshot.customCpuCores &&
									mergedPreviewSnapshot.customRamGb
										? `${mergedPreviewSnapshot.customCpuCores} 核 / ${mergedPreviewSnapshot.customRamGb} GB`
										: '未设置'
								}
							/>
							<SummaryMetric
								label="触点"
								value={
									mergedPreviewSnapshot.customTouchPoints?.toString() ||
									'桌面模式'
								}
							/>
							<SummaryMetric
								label="语言"
								value={mergedPreviewSnapshot.language || '跟随代理或系统'}
							/>
							<SummaryMetric
								label="时区"
								value={mergedPreviewSnapshot.timeZone || '跟随代理或系统'}
							/>
							<SummaryMetric
								label="Accept-Language"
								value={mergedPreviewSnapshot.acceptLanguages || '未覆盖'}
							/>
							<SummaryMetric
								label="Seed"
								value={
									mergedPreviewSnapshot.fingerprintSeed?.toString() ||
									'启动时生成'
								}
							/>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								GL / GPU
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customGlVendor || '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customGlRenderer || '未设置'}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								字体集合
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customFontList?.length
									? `${mergedPreviewSnapshot.customFontList.length} 个字体`
									: '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customFontList
									?.slice(0, 6)
									.join(' / ') || '未设置'}
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2 text-sm text-destructive">
						<Icon icon={CircleAlert} size={14} />
						{previewError || '指纹摘要暂不可用'}
					</div>
				)}
			</div>
			{previewError ? (
				<p className="mt-2 text-xs text-destructive">{previewError}</p>
			) : null}
		</div>
	);
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/70 p-2">
			<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 break-words text-xs">{value}</p>
		</div>
	);
}
