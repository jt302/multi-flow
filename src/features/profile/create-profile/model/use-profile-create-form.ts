import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
	listFingerprintPresets,
	listProfileFontFamilies,
	previewFingerprintBundle,
} from '@/entities/profile/api/profiles-api';
import type {
	CreateProfilePayload,
	ProfileFingerprintSnapshot,
} from '@/entities/profile/model/types';
import type {
	GroupItem,
	ProfileItem,
	ProxyItem,
	ResourceItem,
} from '@/features/console/types';
import { detectClientPlatform } from '@/features/console/utils';

import {
	buildFingerprintSource,
	compareVersions,
	DEFAULT_STARTUP_URL,
	mergePreviewSnapshot,
	normalizeWebRtcMode,
	parseCustomFontList,
	profileFormSchema,
	randomizeFontList,
	type ProfileFormValues,
} from './profile-form';

type UseProfileCreateFormOptions = {
	groups: GroupItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	onSubmit: (payload: CreateProfilePayload) => Promise<void>;
	onBack: () => void;
	mode?: 'create' | 'edit';
	initialProfile?: ProfileItem;
	initialProxyId?: string;
};

export function resourceStatusLabel(item: ResourceItem | undefined) {
	if (!item) {
		return '当前宿主系统无该版本资源';
	}
	return item.installed ? '已安装' : '未下载，启动时自动下载';
}

export function useProfileCreateForm({
	groups,
	proxies,
	resources,
	onSubmit,
	onBack,
	mode = 'create',
	initialProfile,
	initialProxyId,
}: UseProfileCreateFormOptions) {
	const initialBasic = initialProfile?.settings?.basic;
	const initialFingerprint = initialProfile?.settings?.fingerprint;
	const initialAdvanced = initialProfile?.settings?.advanced;
	const hostPlatform = detectClientPlatform();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const initialRandomFontsApplied = useRef(false);
	const [previewSnapshot, setPreviewSnapshot] =
		useState<ProfileFingerprintSnapshot | null>(
			initialFingerprint?.fingerprintSnapshot ?? null,
		);

	const hostChromiumVersions = useMemo(() => {
		return resources
			.filter((item) => item.kind === 'chromium' && item.platform === hostPlatform)
			.slice()
			.sort((left, right) => compareVersions(left.version, right.version));
	}, [hostPlatform, resources]);
	const latestHostVersion = hostChromiumVersions[0]?.version ?? '';
	const defaultPlatform = initialBasic?.platform ?? detectClientPlatform();
	const defaultBrowserVersion = initialBasic?.browserVersion ?? latestHostVersion;

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			name: initialProfile?.name ?? '',
			group: initialProfile?.group === '未分组' ? '' : (initialProfile?.group ?? ''),
			note: initialProfile?.note === '未填写备注' ? '' : (initialProfile?.note ?? ''),
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

	const { getValues, setValue, watch, handleSubmit } = form;

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

	const groupSuggestions = useMemo(() => {
		const names = groups.map((item) => item.name.trim()).filter(Boolean);
		return Array.from(new Set(names)).slice(0, 8);
	}, [groups]);

	const availableProxies = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'active'),
		[proxies],
	);

	const selectedResource = useMemo(
		() => hostChromiumVersions.find((item) => item.version === browserVersion),
		[browserVersion, hostChromiumVersions],
	);

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

	const devicePresetsQuery = useQuery({
		queryKey: ['device-presets', platform, browserVersion],
		queryFn: () => listFingerprintPresets(platform, browserVersion),
		enabled: Boolean(platform && browserVersion),
	});

	useEffect(() => {
		const items = devicePresetsQuery.data ?? [];
		if (items.length === 0) {
			return;
		}
		if (items.some((item) => item.id === devicePresetId)) {
			return;
		}
		setValue('devicePresetId', items[0]?.id ?? '', {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [devicePresetId, devicePresetsQuery.data, setValue]);

	const fontFamiliesQuery = useQuery({
		queryKey: ['profile-font-families', platform],
		queryFn: () => listProfileFontFamilies(platform),
		enabled: Boolean(platform),
	});

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
	}, [platform, setValue]);

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
		if (!platform || !browserVersion || !devicePresetId || !fontFamiliesQuery.data?.length) {
			return;
		}
		initialRandomFontsApplied.current = true;
		const randomized = randomizeFontList(fontFamiliesQuery.data);
		setValue('customFontListText', randomized.join('\n'), {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [
		browserVersion,
		devicePresetId,
		fontFamiliesQuery.data,
		getValues,
		initialProfile,
		platform,
		setValue,
	]);

	const customFonts = useMemo(
		() => parseCustomFontList(customFontListText),
		[customFontListText],
	);

	const previewQuery = useQuery({
		queryKey: [
			'fingerprint-preview',
			platform,
			browserVersion,
			devicePresetId,
			randomFingerprint,
			customFonts,
		],
		queryFn: () =>
			previewFingerprintBundle(
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
			),
		enabled:
			Boolean(platform && browserVersion && devicePresetId) && customFonts.length > 0,
	});

	useEffect(() => {
		if (previewQuery.data) {
			setPreviewSnapshot(previewQuery.data);
			return;
		}
		if (previewQuery.isError || customFonts.length === 0) {
			setPreviewSnapshot(null);
		}
	}, [customFonts.length, previewQuery.data, previewQuery.isError]);

	const mergedPreviewSnapshot = useMemo(
		() => mergePreviewSnapshot(previewSnapshot, language, timezoneId),
		[language, previewSnapshot, timezoneId],
	);

	const onFormSubmit = handleSubmit(async (values) => {
		setSubmitError(null);
		const customLaunchArgs = values.customLaunchArgsText
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		const source = buildFingerprintSource(values);
		let snapshot = mergePreviewSnapshot(previewSnapshot, values.language, values.timezoneId);
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
			const accuracy = values.accuracy.trim() ? Number(values.accuracy.trim()) : undefined;
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
					customLaunchArgs: customLaunchArgs.length ? customLaunchArgs : undefined,
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
	});

	return {
		mode,
		form,
		submitError,
		hostPlatform,
		hostChromiumVersions,
		groupSuggestions,
		availableProxies,
		devicePresetsQuery,
		fontFamiliesQuery,
		previewQuery,
		selectedResource,
		mergedPreviewSnapshot,
		resourceStatusLabel,
		regenerateFontList,
		onFormSubmit,
		values: {
			browserKind,
			browserVersion,
			browserBgColor,
			platform,
			proxyId,
			devicePresetId,
			customFontListText,
			webRtcMode,
			randomFingerprint,
			language,
			timezoneId,
			geoEnabled,
			name: watch('name'),
			headless: watch('headless'),
			disableImages: watch('disableImages'),
		} as const,
		setValue,
	};
}
