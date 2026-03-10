import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';

export const devicePresetSchema = z.object({
	label: z.string().trim().min(1, '机型名称不能为空'),
	platform: z.string().trim().min(1, '平台不能为空'),
	platformVersion: z.string().trim().min(1, '平台版本不能为空'),
	viewportWidth: z.number().int().min(1, '宽度必须大于 0'),
	viewportHeight: z.number().int().min(1, '高度必须大于 0'),
	deviceScaleFactor: z.number().positive('DPR 必须大于 0'),
	touchPoints: z.number().int().min(0, '触点不能小于 0'),
	customPlatform: z.string().trim().min(1, '平台参数不能为空'),
	arch: z.string().trim().min(1, '架构不能为空'),
	bitness: z.string().trim().min(1, '位数不能为空'),
	mobile: z.boolean(),
	formFactor: z.string().trim().min(1, '形态不能为空'),
	userAgentTemplate: z
		.string()
		.trim()
		.min(1, 'UA 模板不能为空')
		.refine((value) => value.includes('{version}'), {
			message: 'UA 模板必须包含 {version}',
		}),
	customGlVendor: z.string().trim().min(1, 'GL Vendor 不能为空'),
	customGlRenderer: z.string().trim().min(1, 'GL Renderer 不能为空'),
	customCpuCores: z.number().int().min(1, 'CPU 核心数必须大于 0'),
	customRamGb: z.number().int().min(1, '内存必须大于 0').max(8, '内存最大为 8 GB'),
});

export type DevicePresetFormValues = z.infer<typeof devicePresetSchema>;

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
		platformVersion: '14.0.0',
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
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36',
		customGlVendor: 'Apple',
		customGlRenderer: 'Apple M3',
		customCpuCores: 8,
		customRamGb: 8,
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
	};
}

type UseDevicePresetEditorOptions = {
	devicePresets: ProfileDevicePresetItem[];
	onCreateDevicePreset: (payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onUpdateDevicePreset: (presetId: string, payload: SaveProfileDevicePresetPayload) => Promise<void>;
	onRefreshDevicePresets: () => Promise<void>;
};

export function useDevicePresetEditor({
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onRefreshDevicePresets,
}: UseDevicePresetEditorOptions) {
	const [activePresetId, setActivePresetId] = useState<string | null>(null);
	const activePreset = useMemo(
		() => devicePresets.find((item) => item.id === activePresetId) ?? null,
		[activePresetId, devicePresets],
	);
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

	const handleSavePreset = form.handleSubmit(async (values) => {
		const payload = toPayload(values);
		if (activePreset) {
			await onUpdateDevicePreset(activePreset.id, payload);
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
		resetPresetEditor,
		handleSavePreset,
	};
}
