import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';

export const createDevicePresetSchema = (t: (key: string) => string) =>
	z.object({
		label: z.string().trim().min(1, t('common:validation.devicePreset.nameRequired')),
		platform: z.string().trim().min(1, t('common:validation.devicePreset.platformRequired')),
		platformVersion: z
			.string()
			.trim()
			.min(1, t('common:validation.devicePreset.platformVersionRequired')),
		viewportWidth: z.number().int().min(1, t('common:validation.devicePreset.widthMin')),
		viewportHeight: z.number().int().min(1, t('common:validation.devicePreset.heightMin')),
		deviceScaleFactor: z.number().positive(t('common:validation.devicePreset.dprPositive')),
		touchPoints: z.number().int().min(0, t('common:validation.devicePreset.touchPointsMin')),
		customPlatform: z
			.string()
			.trim()
			.min(1, t('common:validation.devicePreset.customPlatformRequired')),
		arch: z.string().trim().min(1, t('common:validation.devicePreset.archRequired')),
		bitness: z.string().trim().min(1, t('common:validation.devicePreset.bitnessRequired')),
		mobile: z.boolean(),
		formFactor: z.string().trim().min(1, t('common:validation.devicePreset.formFactorRequired')),
		userAgentTemplate: z
			.string()
			.trim()
			.min(1, t('common:validation.devicePreset.uaTemplateRequired'))
			.refine((value) => value.includes('{version}'), {
				message: t('common:validation.devicePreset.uaTemplateVersion'),
			}),
		customGlVendor: z.string().trim().min(1, t('common:validation.devicePreset.glVendorRequired')),
		customGlRenderer: z
			.string()
			.trim()
			.min(1, t('common:validation.devicePreset.glRendererRequired')),
		customCpuCores: z.number().int().min(1, t('common:validation.devicePreset.cpuCoresMin')),
		customRamGb: z
			.number()
			.int()
			.min(1, t('common:validation.devicePreset.memoryMin'))
			.max(8, t('common:validation.devicePreset.memoryMax')),
		browserVersion: z
			.string()
			.trim()
			.min(1, t('common:validation.devicePreset.browserVersionRequired')),
	});

export type DevicePresetFormValues = z.infer<ReturnType<typeof createDevicePresetSchema>>;

export const PLATFORM_OPTIONS = [
	{ value: 'macos', label: 'macOS' },
	{ value: 'windows', label: 'Windows' },
	{ value: 'linux', label: 'Linux' },
	{ value: 'android', label: 'Android' },
	{ value: 'ios', label: 'iOS' },
] as const;

export const FORM_FACTOR_OPTIONS = [
	{ value: 'Desktop', label: 'Desktop' },
	{ value: 'Mobile', label: 'Mobile' },
	{ value: 'Tablet', label: 'Tablet' },
] as const;

export const ARCH_OPTIONS = [
	{ value: 'arm', label: 'ARM' },
	{ value: 'x86', label: 'x86' },
] as const;

export const BITNESS_OPTIONS = [
	{ value: '64', label: '64-bit' },
	{ value: '32', label: '32-bit' },
] as const;

function getDefaultPresetValues(): DevicePresetFormValues {
	return {
		label: '',
		platform: 'macos',
		platformVersion: '10.15.7',
		viewportWidth: 1512,
		viewportHeight: 982,
		deviceScaleFactor: 2,
		touchPoints: 0,
		customPlatform: 'MacIntel',
		arch: 'arm',
		bitness: '64',
		mobile: false,
		formFactor: 'Desktop',
		userAgentTemplate:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36',
		customGlVendor: 'Apple',
		customGlRenderer: 'Apple M3',
		customCpuCores: 8,
		customRamGb: 8,
		browserVersion: '',
	};
}

function mapPresetToFormValues(preset: ProfileDevicePresetItem): DevicePresetFormValues {
	return {
		label: preset.label,
		platform: preset.platform,
		platformVersion: preset.platformVersion,
		viewportWidth: preset.viewportWidth,
		viewportHeight: preset.viewportHeight,
		deviceScaleFactor: preset.deviceScaleFactor,
		touchPoints: preset.touchPoints,
		customPlatform: preset.customPlatform,
		arch: preset.arch,
		bitness: preset.bitness,
		mobile: preset.mobile,
		formFactor: preset.formFactor,
		userAgentTemplate: preset.userAgentTemplate,
		customGlVendor: preset.customGlVendor,
		customGlRenderer: preset.customGlRenderer,
		customCpuCores: preset.customCpuCores,
		customRamGb: preset.customRamGb,
		browserVersion: preset.browserVersion,
	};
}

function toPayload(values: DevicePresetFormValues): SaveProfileDevicePresetPayload {
	return {
		label: values.label.trim(),
		platform: values.platform,
		platformVersion: values.platformVersion.trim(),
		viewportWidth: values.viewportWidth,
		viewportHeight: values.viewportHeight,
		deviceScaleFactor: values.deviceScaleFactor,
		touchPoints: values.touchPoints,
		customPlatform: values.customPlatform.trim(),
		arch: values.arch,
		bitness: values.bitness,
		mobile: values.mobile,
		formFactor: values.formFactor,
		userAgentTemplate: values.userAgentTemplate.trim(),
		customGlVendor: values.customGlVendor.trim(),
		customGlRenderer: values.customGlRenderer.trim(),
		customCpuCores: values.customCpuCores,
		customRamGb: values.customRamGb,
		browserVersion: values.browserVersion.trim(),
	};
}

type UseDevicePresetEditorOptions = {
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
		options?: { syncToProfiles?: boolean },
	) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
	t: (key: string) => string;
};

export function useDevicePresetEditor({
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onRefreshDevicePresets,
	t,
}: UseDevicePresetEditorOptions) {
	const [activePresetId, setActivePresetId] = useState<string | null>(null);
	const activePreset = useMemo(
		() => devicePresets.find((item) => item.id === activePresetId) ?? null,
		[activePresetId, devicePresets],
	);

	const devicePresetSchema = useMemo(() => createDevicePresetSchema(t), [t]);

	const form = useForm<DevicePresetFormValues>({
		resolver: zodResolver(devicePresetSchema),
		defaultValues: getDefaultPresetValues(),
	});

	useEffect(() => {
		if (!activePreset) {
			return;
		}

		form.reset(mapPresetToFormValues(activePreset));
	}, [activePreset, form]);

	const resetPresetEditor = () => {
		setActivePresetId(null);
		form.reset(getDefaultPresetValues());
	};

	const copyPreset = (preset: ProfileDevicePresetItem, copySuffix: string) => {
		setActivePresetId(null);
		form.reset({
			...mapPresetToFormValues(preset),
			label: `${preset.label} ${copySuffix}`.trim(),
		});
	};

	const handleSavePreset = (options?: { syncToProfiles?: boolean }) =>
		form.handleSubmit(async (values) => {
			const payload = toPayload(values);
			if (activePreset) {
				await onUpdateDevicePreset(activePreset.id, payload, options);
				return;
			}

			await onCreateDevicePreset(payload);
			await onRefreshDevicePresets();
			resetPresetEditor();
		});

	return {
		form,
		activePreset,
		activePresetId,
		setActivePresetId,
		copyPreset,
		resetPresetEditor,
		handleSavePreset,
	};
}
