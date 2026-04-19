import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
	listFingerprintPresets,
	listProfileFontFamilies,
	previewFingerprintBundle,
	readProfileCookies,
} from '@/entities/profile/api/profiles-api';
import { listPluginPackages, readProfilePlugins } from '@/entities/plugin/api/plugins-api';
import type {
	CreateProfilePayload,
	ProfileFingerprintSnapshot,
	ProfileItem,
} from '@/entities/profile/model/types';
import type { PluginPackage } from '@/entities/plugin/model/types';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import { detectClientPlatform } from '@/shared/lib/platform';

import { fetchHostLocaleSuggestion } from '@/entities/host-locale/api';
import {
	applyProxySuggestionValue,
	buildFingerprintSource,
	buildResolutionValuesFromPreset,
	compareVersions,
	dedupeProfilePluginSelections,
	generateRandomCustomDeviceName,
	generateRandomCustomMacAddress,
	generateRandomFingerprintSeed,
	mergePreviewSnapshot,
	normalizeCookieStateJson,
	parseCustomFontList,
	parseStartupUrls,
	profileFormSchema,
	randomizeFontList,
	resolveInitialCustomDeviceIdentityValues,
	resolveInitialResolutionValues,
	resolveInitialWebRtcMode,
	resolveProxySuggestedValues,
	resolveHostSuggestedValues,
	type ProxySuggestionFieldSource,
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
		return i18next.t('profile:noResourceForVersion');
	}
	return item.installed ? i18next.t('common:installed') : i18next.t('common:autoDownloadOnStartup');
}

export function useProfileCreateForm({
	proxies,
	resources,
	onSubmit,
	onBack,
	mode = 'create',
	initialProfile,
	initialProxyId,
}: UseProfileCreateFormOptions) {
	const { t } = useTranslation();
	const initialBasic = initialProfile?.settings?.basic;
	const initialFingerprint = initialProfile?.settings?.fingerprint;
	const initialAdvanced = initialProfile?.settings?.advanced;
	const initialCookieStateJson = useMemo(
		() =>
			normalizeCookieStateJson(
				initialAdvanced?.cookieStateJson,
				initialProfile?.id,
			),
		[initialAdvanced?.cookieStateJson, initialProfile?.id],
	);
	const initialResolutionOverride = useMemo(
		() => ({
			viewportWidth: initialFingerprint?.viewportWidth,
			viewportHeight: initialFingerprint?.viewportHeight,
			deviceScaleFactor: initialFingerprint?.deviceScaleFactor,
		}),
		[
			initialFingerprint?.deviceScaleFactor,
			initialFingerprint?.viewportHeight,
			initialFingerprint?.viewportWidth,
		],
	);
	const initialGeolocationMode =
		initialAdvanced?.geolocationMode ??
		(initialAdvanced?.geolocation ? 'custom' : 'off');
	const hostPlatform = detectClientPlatform();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const initialRandomFontsApplied = useRef(false);
	const resolutionInitialized = useRef(false);
	const lastAppliedResolutionPresetId = useRef<string | null>(null);
	const [proxySuggestionSource, setProxySuggestionSource] = useState<{
		language: ProxySuggestionFieldSource;
		timezoneId: ProxySuggestionFieldSource;
		geolocation: ProxySuggestionFieldSource;
	}>(() => ({
		language: initialFingerprint?.fingerprintSnapshot?.language ? 'manual' : 'empty',
		timezoneId: initialFingerprint?.fingerprintSnapshot?.timeZone ? 'manual' : 'empty',
		geolocation:
			initialGeolocationMode === 'custom'
				? 'manual'
				: initialAdvanced?.geolocationMode === 'ip'
					? 'proxy'
					: 'empty',
	}));
	const [previewSnapshot, setPreviewSnapshot] =
		useState<ProfileFingerprintSnapshot | null>(
			initialFingerprint?.fingerprintSnapshot ?? null,
		);
	const [initialDeviceIdentityValues] = useState(() =>
		resolveInitialCustomDeviceIdentityValues(initialFingerprint, {
			deviceName: generateRandomCustomDeviceName(),
			macAddress: generateRandomCustomMacAddress(),
		}),
	);
	const [previewFingerprintSeed, setPreviewFingerprintSeed] = useState<number>(() => {
		return (
			initialAdvanced?.fixedFingerprintSeed ??
			initialFingerprint?.fingerprintSnapshot?.fingerprintSeed ??
			generateRandomFingerprintSeed()
		);
	});

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
			group: initialProfile?.group === t('common:noGroup') ? '' : (initialProfile?.group ?? ''),
			note: initialProfile?.note === t('common:noNote') ? '' : (initialProfile?.note ?? ''),
			browserKind: initialBasic?.browserKind ?? 'chromium',
			browserVersion: defaultBrowserVersion,
			platform: defaultPlatform,
			devicePresetId: initialBasic?.devicePresetId ?? '',
			startupUrls:
				initialBasic?.startupUrls?.join('\n') ??
				initialBasic?.startupUrl ??
				'',
			browserBgColor: initialBasic?.browserBgColor ?? '',
			browserBgColorMode:
				initialBasic?.browserBgColorMode ??
				(initialBasic?.browserBgColor ? 'custom' : 'inherit'),
			toolbarLabelMode:
				initialBasic?.toolbarLabelMode ??
				(initialProfile?.group && initialProfile.group !== t('common:noGroup')
					? 'inherit'
					: 'id_only'),
			proxyId: initialProxyId ?? '__none__',
			localeMode: (initialProfile?.settings?.localeMode as 'auto' | 'manual' | undefined) ?? 'auto',
			language: initialFingerprint?.fingerprintSnapshot?.language ?? '',
			timezoneId: initialFingerprint?.fingerprintSnapshot?.timeZone ?? '',
			customFontListText:
				initialFingerprint?.customFontList?.join('\n') ??
				initialFingerprint?.fingerprintSnapshot?.customFontList?.join('\n') ??
				'',
			deviceNameMode: initialDeviceIdentityValues.deviceNameMode,
			customDeviceName: initialDeviceIdentityValues.customDeviceName,
			macAddressMode: initialDeviceIdentityValues.macAddressMode,
			customMacAddress: initialDeviceIdentityValues.customMacAddress,
			doNotTrackEnabled: initialFingerprint?.doNotTrackEnabled ?? false,
			webRtcMode: resolveInitialWebRtcMode(
				initialFingerprint?.webRtcMode,
				Boolean(initialProfile),
			),
			webrtcIpOverride: initialFingerprint?.webrtcIpOverride ?? '',
			headless: initialAdvanced?.headless ?? false,
			disableImages: initialAdvanced?.disableImages ?? false,
			randomFingerprint: initialAdvanced?.randomFingerprint ?? false,
			customLaunchArgsText: initialAdvanced?.customLaunchArgs?.join('\n') ?? '',
			cookieStateJson: initialCookieStateJson,
			pluginSelections: initialAdvanced?.pluginSelections ?? [],
			geolocationMode: initialGeolocationMode,
			autoAllowGeolocation: initialAdvanced?.autoAllowGeolocation ?? false,
			latitude: initialAdvanced?.geolocation?.latitude?.toString() ?? '',
			longitude: initialAdvanced?.geolocation?.longitude?.toString() ?? '',
			accuracy: initialAdvanced?.geolocation?.accuracy?.toString() ?? '',
			viewportWidth:
				initialResolutionOverride.viewportWidth ??
				initialFingerprint?.fingerprintSnapshot?.windowWidth,
			viewportHeight:
				initialResolutionOverride.viewportHeight ??
				initialFingerprint?.fingerprintSnapshot?.windowHeight,
			deviceScaleFactor:
				initialResolutionOverride.deviceScaleFactor ??
				initialFingerprint?.fingerprintSnapshot?.deviceScaleFactor,
			fingerprintSeed:
				initialAdvanced?.fixedFingerprintSeed ??
				initialFingerprint?.fingerprintSnapshot?.fingerprintSeed ??
				previewFingerprintSeed,
		},
	});

	const { getValues, setValue, watch, handleSubmit } = form;

	const localeMode = watch('localeMode');
	const browserKind = watch('browserKind');
	const browserVersion = watch('browserVersion');
	const browserBgColor = watch('browserBgColor');
	const browserBgColorMode = watch('browserBgColorMode');
	const toolbarLabelMode = watch('toolbarLabelMode');
	const platform = watch('platform');
	const proxyId = watch('proxyId');
	const devicePresetId = watch('devicePresetId');
	const customFontListText = watch('customFontListText');
	const deviceNameMode = watch('deviceNameMode');
	const macAddressMode = watch('macAddressMode');
	const webRtcMode = watch('webRtcMode');
	const randomFingerprint = watch('randomFingerprint');
	const fingerprintSeed = watch('fingerprintSeed');
	const language = watch('language');
	const timezoneId = watch('timezoneId');
	const geolocationMode = watch('geolocationMode');
	const viewportWidth = watch('viewportWidth');
	const viewportHeight = watch('viewportHeight');
	const deviceScaleFactor = watch('deviceScaleFactor');
	const cookieStateJson = watch('cookieStateJson');
	const pluginSelections = watch('pluginSelections');

	const availableProxies = useMemo(
		() => proxies.filter((item) => item.lifecycle === 'active'),
		[proxies],
	);
	const selectedProxy = useMemo(
		() => availableProxies.find((item) => item.id === proxyId) ?? null,
		[availableProxies, proxyId],
	);
	const proxySuggestedValues = useMemo(
		() => resolveProxySuggestedValues(selectedProxy),
		[selectedProxy],
	);

	const { data: hostLocaleSuggestion } = useQuery({
		queryKey: ['host-locale-suggestion'],
		queryFn: fetchHostLocaleSuggestion,
		enabled: localeMode === 'auto' && (!proxyId || proxyId === '__none__'),
		staleTime: 5 * 60_000,
		retry: false,
	});
	const hostSuggestedValues = useMemo(
		() => resolveHostSuggestedValues(!selectedProxy ? (hostLocaleSuggestion ?? null) : null),
		[selectedProxy, hostLocaleSuggestion],
	);

	const selectedResource = useMemo(
		() => hostChromiumVersions.find((item) => item.version === browserVersion),
		[browserVersion, hostChromiumVersions],
	);

	useEffect(() => {
		const isHostSuggestion = !selectedProxy;
		const activeValues = isHostSuggestion ? hostSuggestedValues : proxySuggestedValues;
		const nextLanguage = applyProxySuggestionValue(
			proxySuggestionSource.language,
			getValues('language'),
			activeValues.language,
		);
		if (nextLanguage !== getValues('language')) {
			setValue('language', nextLanguage, { shouldDirty: false, shouldValidate: true });
		}

		const nextTimezone = applyProxySuggestionValue(
			proxySuggestionSource.timezoneId,
			getValues('timezoneId'),
			activeValues.timezoneId,
		);
		if (nextTimezone !== getValues('timezoneId')) {
			setValue('timezoneId', nextTimezone, { shouldDirty: false, shouldValidate: true });
		}

		setProxySuggestionSource((prev) => {
			const langSrc: ProxySuggestionFieldSource =
				prev.language === 'manual'
					? 'manual'
					: proxySuggestedValues.language
						? 'proxy'
						: hostSuggestedValues.language
							? 'host'
							: 'empty';
			const tzSrc: ProxySuggestionFieldSource =
				prev.timezoneId === 'manual'
					? 'manual'
					: proxySuggestedValues.timezoneId
						? 'proxy'
						: hostSuggestedValues.timezoneId
							? 'host'
							: 'empty';
			const geoSrc: ProxySuggestionFieldSource =
				prev.geolocation === 'manual'
					? 'manual'
					: proxySuggestedValues.geolocation
						? 'proxy'
						: 'empty';
			const next = { language: langSrc, timezoneId: tzSrc, geolocation: geoSrc } as const;
			if (
				next.language === prev.language &&
				next.timezoneId === prev.timezoneId &&
				next.geolocation === prev.geolocation
			) {
				return prev;
			}
			return next;
		});
	}, [getValues, proxySuggestedValues, hostSuggestedValues, proxySuggestionSource, setValue, selectedProxy]);

	const markProxyFieldManual = useCallback((field: 'language' | 'timezoneId' | 'geolocation') => {
		setProxySuggestionSource((prev) => ({ ...prev, [field]: 'manual' }));
	}, []);

	const restoreProxySuggestedValues = useCallback(() => {
		setProxySuggestionSource({
			language: proxySuggestedValues.language ? 'proxy' : 'empty',
			timezoneId: proxySuggestedValues.timezoneId ? 'proxy' : 'empty',
			geolocation: proxySuggestedValues.geolocation ? 'proxy' : 'empty',
		});
		setValue('language', proxySuggestedValues.language, { shouldDirty: false, shouldValidate: true });
		setValue('timezoneId', proxySuggestedValues.timezoneId, { shouldDirty: false, shouldValidate: true });
	}, [proxySuggestedValues, setValue]);

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
	const selectedDevicePreset = useMemo(() => {
		return (
			(devicePresetsQuery.data ?? []).find((item) => item.id === devicePresetId) ?? null
		);
	}, [devicePresetId, devicePresetsQuery.data]);

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

	useEffect(() => {
		const presetResolution = buildResolutionValuesFromPreset(selectedDevicePreset);
		if (!presetResolution || !selectedDevicePreset) {
			return;
		}
		if (!resolutionInitialized.current) {
			const initialResolution = resolveInitialResolutionValues(
				initialResolutionOverride,
				selectedDevicePreset,
			);
			if (initialResolution) {
				setValue('viewportWidth', initialResolution.viewportWidth, {
					shouldDirty: false,
					shouldValidate: true,
				});
				setValue('viewportHeight', initialResolution.viewportHeight, {
					shouldDirty: false,
					shouldValidate: true,
				});
				setValue('deviceScaleFactor', initialResolution.deviceScaleFactor, {
					shouldDirty: false,
					shouldValidate: true,
				});
			}
			resolutionInitialized.current = true;
			lastAppliedResolutionPresetId.current = selectedDevicePreset.id;
			return;
		}
		if (lastAppliedResolutionPresetId.current === selectedDevicePreset.id) {
			return;
		}
		setValue('viewportWidth', presetResolution.viewportWidth, {
			shouldDirty: true,
			shouldValidate: true,
		});
		setValue('viewportHeight', presetResolution.viewportHeight, {
			shouldDirty: true,
			shouldValidate: true,
		});
		setValue('deviceScaleFactor', presetResolution.deviceScaleFactor, {
			shouldDirty: true,
			shouldValidate: true,
		});
		lastAppliedResolutionPresetId.current = selectedDevicePreset.id;
	}, [initialResolutionOverride, selectedDevicePreset, setValue]);

	const fontFamiliesQuery = useQuery({
		queryKey: ['profile-font-families', platform],
		queryFn: () => listProfileFontFamilies(platform),
		enabled: Boolean(platform),
	});

	const runtimeCookieStateLoaded = useRef(false);
	const runtimeCookieStateQuery = useQuery({
		queryKey: ['profile-cookie-state', initialProfile?.id],
		queryFn: () => readProfileCookies(initialProfile!.id),
		enabled: mode === 'edit' && Boolean(initialProfile?.id),
	});

	useEffect(() => {
		if (runtimeCookieStateLoaded.current) {
			return;
		}
		if (!runtimeCookieStateQuery.data) {
			return;
		}
		if (getValues('cookieStateJson') !== initialCookieStateJson) {
			runtimeCookieStateLoaded.current = true;
			return;
		}
		runtimeCookieStateLoaded.current = true;
		setValue('cookieStateJson', runtimeCookieStateQuery.data.json, {
			shouldDirty: false,
			shouldValidate: true,
		});
	}, [getValues, initialCookieStateJson, runtimeCookieStateQuery.data, setValue]);

	const pluginPackagesQuery = useQuery<PluginPackage[]>({
		queryKey: ['plugin-packages'],
		queryFn: listPluginPackages,
	});
	const runtimePluginSelectionsLoaded = useRef(false);
	const runtimePluginSelectionsQuery = useQuery({
		queryKey: ['profile-plugins', initialProfile?.id],
		queryFn: () => readProfilePlugins(initialProfile!.id),
		enabled: mode === 'edit' && Boolean(initialProfile?.id),
	});

	useEffect(() => {
		if (runtimePluginSelectionsLoaded.current) {
			return;
		}
		if (!runtimePluginSelectionsQuery.data) {
			return;
		}
		runtimePluginSelectionsLoaded.current = true;
		setValue(
			'pluginSelections',
			dedupeProfilePluginSelections(runtimePluginSelectionsQuery.data),
			{
				shouldDirty: false,
				shouldValidate: true,
			},
		);
	}, [runtimePluginSelectionsQuery.data, setValue]);

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
			fingerprintSeed,
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
					fingerprintSeed: fingerprintSeed ?? previewFingerprintSeed,
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
		() =>
			mergePreviewSnapshot(previewSnapshot, language, timezoneId, {
				viewportWidth,
				viewportHeight,
				deviceScaleFactor,
			}),
		[
			deviceScaleFactor,
			language,
			previewSnapshot,
			timezoneId,
			viewportHeight,
			viewportWidth,
		],
	);

	const regenerateFingerprintSeed = useCallback(() => {
		const nextSeed = generateRandomFingerprintSeed();
		setPreviewFingerprintSeed(nextSeed);
		setValue('fingerprintSeed', nextSeed, {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [setValue]);

	const regenerateCustomDeviceName = useCallback(() => {
		setValue('customDeviceName', generateRandomCustomDeviceName(), {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [setValue]);

	const regenerateCustomMacAddress = useCallback(() => {
		setValue('customMacAddress', generateRandomCustomMacAddress(), {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [setValue]);

	const onFormSubmit = handleSubmit(async (values) => {
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
			{
				viewportWidth: values.viewportWidth,
				viewportHeight: values.viewportHeight,
				deviceScaleFactor: values.deviceScaleFactor,
			},
		);
		if (!snapshot) {
			snapshot = mergePreviewSnapshot(
				await previewFingerprintBundle(source, {
					fontListMode: 'custom',
					customFontList: parseCustomFontList(values.customFontListText),
					fingerprintSeed: values.fingerprintSeed,
				}),
				values.language,
				values.timezoneId,
				{
					viewportWidth: values.viewportWidth,
					viewportHeight: values.viewportHeight,
					deviceScaleFactor: values.deviceScaleFactor,
				},
			);
		}
		if (!snapshot) {
			setSubmitError(t('common:fingerprintNotReady'));
			return;
		}

		let geolocation:
			| { latitude: number; longitude: number; accuracy?: number }
			| undefined;
		if (values.geolocationMode === 'custom') {
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
				localeMode: values.localeMode,
				basic: {
					browserKind: values.browserKind,
					browserVersion: values.browserVersion,
					platform: values.platform,
					devicePresetId: values.devicePresetId,
					startupUrls: parseStartupUrls(values.startupUrls),
					browserBgColor:
						values.browserBgColorMode === 'custom'
							? values.browserBgColor.trim() || undefined
							: undefined,
					browserBgColorMode: values.browserBgColorMode,
					toolbarLabelMode:
						values.toolbarLabelMode === 'inherit'
							? undefined
							: values.toolbarLabelMode,
				},
				fingerprint: {
					fingerprintSource: source,
					fingerprintSnapshot: snapshot,
					language: values.language.trim() || undefined,
					timezoneId: values.timezoneId.trim() || undefined,
					fontListMode: 'custom',
					customFontList: parseCustomFontList(values.customFontListText),
					deviceNameMode: values.deviceNameMode,
					customDeviceName:
						values.deviceNameMode === 'custom'
							? values.customDeviceName.trim() || undefined
							: undefined,
					macAddressMode: values.macAddressMode,
					customMacAddress:
						values.macAddressMode === 'custom'
							? values.customMacAddress.trim() || undefined
							: undefined,
					doNotTrackEnabled: values.doNotTrackEnabled,
					webRtcMode: values.webRtcMode,
					webrtcIpOverride:
						values.webRtcMode === 'replace'
							? values.webrtcIpOverride.trim() || undefined
							: undefined,
					viewportWidth: values.viewportWidth,
					viewportHeight: values.viewportHeight,
					deviceScaleFactor: values.deviceScaleFactor,
				},
				advanced: {
					headless: values.headless,
					disableImages: values.disableImages,
					geolocationMode: values.geolocationMode,
					autoAllowGeolocation: values.autoAllowGeolocation,
					customLaunchArgs: customLaunchArgs.length ? customLaunchArgs : undefined,
					randomFingerprint: values.randomFingerprint,
					fixedFingerprintSeed:
						values.fingerprintSeed ?? snapshot.fingerprintSeed,
					cookieStateJson:
						normalizeCookieStateJson(
							values.cookieStateJson,
							initialProfile?.id,
						) || undefined,
					pluginSelections:
						values.pluginSelections.length > 0
							? dedupeProfilePluginSelections(values.pluginSelections)
							: undefined,
					geolocation,
				},
			},
		};

		try {
			await onSubmit(payload);
			onBack();
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : t('common:saveProfileFailed'));
		}
	});

	return {
		mode,
		form,
		submitError,
		hostPlatform,
		hostChromiumVersions,
		availableProxies,
		devicePresetsQuery,
		pluginPackagesQuery,
		fontFamiliesQuery,
		previewQuery,
		selectedResource,
		mergedPreviewSnapshot,
		resourceStatusLabel,
		regenerateFontList,
		regenerateFingerprintSeed,
		regenerateCustomDeviceName,
		regenerateCustomMacAddress,
		markProxyFieldManual,
		restoreProxySuggestedValues,
		onFormSubmit,
		values: {
			browserKind,
			browserVersion,
			group: watch('group'),
			browserBgColor,
			browserBgColorMode,
			toolbarLabelMode,
			platform,
			proxyId,
			devicePresetId,
			customFontListText,
			deviceNameMode,
			customDeviceName: watch('customDeviceName'),
			macAddressMode,
			customMacAddress: watch('customMacAddress'),
			doNotTrackEnabled: watch('doNotTrackEnabled'),
			webRtcMode,
			randomFingerprint,
			fingerprintSeed,
			language,
			timezoneId,
			geolocationMode,
			viewportWidth,
			viewportHeight,
			deviceScaleFactor,
			cookieStateJson,
			pluginSelections,
			autoAllowGeolocation: watch('autoAllowGeolocation'),
			proxySuggestionSource,
			selectedProxy,
			localeMode,
			name: watch('name'),
			headless: watch('headless'),
			disableImages: watch('disableImages'),
			runtimeCookieStateLoading: runtimeCookieStateQuery.isLoading,
			runtimeCookieStateError:
				runtimeCookieStateQuery.error instanceof Error
					? runtimeCookieStateQuery.error.message
					: null,
		} as const,
		setValue,
	};
}
