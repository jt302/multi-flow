import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import type {
	ProfileDevicePresetItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';

import { ActiveSectionCard, ThemeCustomizerCard } from '../components';
import { NAV_SECTIONS } from '../constants';
import type { SettingsPageProps } from '../types';

const devicePresetSchema = z.object({
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

type DevicePresetFormValues = z.infer<typeof devicePresetSchema>;

const PLATFORM_OPTIONS = [
	{ value: 'macos', label: 'macOS' },
	{ value: 'windows', label: 'Windows' },
	{ value: 'linux', label: 'Linux' },
	{ value: 'android', label: 'Android' },
	{ value: 'ios', label: 'iOS' },
] as const;

const FORM_FACTOR_OPTIONS = [
	{ value: 'Desktop', label: 'Desktop' },
	{ value: 'Mobile', label: 'Mobile' },
	{ value: 'Tablet', label: 'Tablet' },
] as const;

const ARCH_OPTIONS = [
	{ value: 'arm', label: 'ARM' },
	{ value: 'x86', label: 'x86' },
] as const;

const BITNESS_OPTIONS = [
	{ value: '64', label: '64-bit' },
	{ value: '32', label: '32-bit' },
] as const;

function formatBytes(input: number | null): string {
	if (input === null || input <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = input;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

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

function PresetListItem({
	item,
	selected,
	onClick,
}: {
	item: ProfileDevicePresetItem;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
				selected
					? 'border-primary/40 bg-primary/10'
					: 'border-border/70 bg-background/75 hover:border-primary/25 hover:bg-accent/40'
			}`}
			onClick={onClick}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{item.label}</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{item.platform} · {item.viewportWidth}x{item.viewportHeight} · DPR {item.deviceScaleFactor}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Badge variant="outline">{item.formFactor}</Badge>
					{item.mobile ? <Badge variant="secondary">移动</Badge> : null}
				</div>
			</div>
		</button>
	);
}

export function SettingsPage({
	useCustomColor,
	preset,
	customColor,
	onPresetChange,
	onCustomColorChange,
	onToggleCustomColor,
	resources,
	onRefreshResources,
	onInstallChromium,
	onActivateChromium,
	resourceProgress,
	devicePresets,
	onCreateDevicePreset,
	onUpdateDevicePreset,
	onRefreshDevicePresets,
	onOpenRecycleBin,
}: SettingsPageProps) {
	const section = NAV_SECTIONS.settings;
	const [pendingKey, setPendingKey] = useState('');
	const [activePresetId, setActivePresetId] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<DevicePresetFormValues>({
		resolver: zodResolver(devicePresetSchema),
		defaultValues: getDefaultPresetValues(),
	});

	const chromiumItems = useMemo(
		() => resources.filter((item) => item.kind === 'chromium'),
		[resources],
	);
	const activePreset = useMemo(
		() => devicePresets.find((item) => item.id === activePresetId) ?? null,
		[activePresetId, devicePresets],
	);

	useEffect(() => {
		if (!activePreset) {
			return;
		}
		reset(mapPresetToFormValues(activePreset));
	}, [activePreset, reset]);

	const runAction = async (key: string, action: () => Promise<void>) => {
		if (pendingKey) {
			return;
		}
		setPendingKey(key);
		try {
			await action();
		} finally {
			setPendingKey('');
		}
	};

	const resetPresetEditor = () => {
		setActivePresetId(null);
		reset(getDefaultPresetValues());
	};

	const handleSavePreset = async (values: DevicePresetFormValues) => {
		const payload = toPayload(values);
		if (activePreset) {
			await onUpdateDevicePreset(activePreset.id, payload);
			return;
		}
		await onCreateDevicePreset(payload);
		await onRefreshDevicePresets();
		resetPresetEditor();
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="设置" title={section.title} description={section.desc} />

			<div className="space-y-3">
				<ThemeCustomizerCard
					useCustomColor={useCustomColor}
					preset={preset}
					customColor={customColor}
					onPresetChange={onPresetChange}
					onCustomColorChange={onCustomColorChange}
					onToggleCustomColor={onToggleCustomColor}
				/>

				<Card className="p-4">
					<div className="mb-2 flex items-center justify-between gap-3">
						<div>
							<CardTitle className="text-sm">Chromium 版本</CardTitle>
							<p className="mt-1 text-xs text-muted-foreground">资源下载、安装和激活仍然集中在设置页处理。</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								void runAction('refresh-resources', onRefreshResources);
							}}
							disabled={Boolean(pendingKey)}
						>
							<Icon icon={RefreshCw} size={12} />
							刷新
						</Button>
					</div>
					<div className="space-y-2">
						{chromiumItems.length === 0 ? (
							<p className="rounded-xl border border-border/70 bg-background/70 px-3 py-6 text-center text-sm text-muted-foreground">
								未发现可用 Chromium 资源
							</p>
						) : (
							chromiumItems.map((item) => (
								<div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">Chromium {item.version}</p>
											<p className="truncate text-xs text-muted-foreground">{item.platform}</p>
										</div>
										<div className="flex items-center gap-1">
											{item.active ? <Badge>当前</Badge> : null}
											{item.installed ? <Badge variant="outline">已安装</Badge> : <Badge variant="secondary">未安装</Badge>}
										</div>
									</div>
									<div className="mt-2 flex items-center gap-2">
										{item.installed ? (
											<Button
												type="button"
												size="sm"
												variant={item.active ? 'secondary' : 'outline'}
												disabled={Boolean(pendingKey) || item.active}
												onClick={() => {
													void runAction(`activate-${item.version}`, () => onActivateChromium(item.version));
												}}
											>
												切换到此版本
											</Button>
										) : (
											<Button
												type="button"
												size="sm"
												disabled={Boolean(pendingKey)}
												onClick={() => {
													void runAction(`install-${item.id}`, () => onInstallChromium(item.id));
												}}
											>
												<Icon icon={Download} size={12} />
												下载并激活
											</Button>
										)}
									</div>
									{resourceProgress?.resourceId === item.id ? (
										<div className="mt-2 space-y-1">
											<div className="flex items-center justify-between text-[11px] text-muted-foreground">
												<span>
													{resourceProgress.stage === 'download'
														? '下载中'
														: resourceProgress.stage === 'install'
															? '安装中'
															: resourceProgress.stage === 'done'
																? '已完成'
																: resourceProgress.stage === 'error'
																	? '失败'
																	: '处理中'}
												</span>
												<span>{resourceProgress.percent === null ? '--' : `${Math.floor(resourceProgress.percent)}%`}</span>
											</div>
											<div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
												<div
													className={`h-full transition-all ${resourceProgress.stage === 'error' ? 'bg-destructive' : 'bg-primary'}`}
													style={{ width: `${Math.max(3, Math.min(100, resourceProgress.percent ?? 0))}%` }}
												/>
											</div>
											<p className="text-[11px] text-muted-foreground">
												{formatBytes(resourceProgress.downloadedBytes)} / {formatBytes(resourceProgress.totalBytes)}
											</p>
										</div>
									) : null}
								</div>
							))
						)}
					</div>
				</Card>

				<Card className="p-4">
					<div className="mb-3 flex items-start justify-between gap-3">
						<div>
							<CardTitle className="text-sm">机型映射</CardTitle>
							<p className="mt-1 text-xs text-muted-foreground">
								设置页统一管理环境可用设备预设。所有预设均来自数据库，点击列表可编辑，点击新建只会重置表单，只有保存后才会写入数据库。
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge>{devicePresets.length} 个预设</Badge>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									void runAction('refresh-device-presets', onRefreshDevicePresets);
								}}
								disabled={Boolean(pendingKey)}
							>
								<Icon icon={RefreshCw} size={12} />
								刷新
							</Button>
						</div>
					</div>

					<div className="grid gap-3 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
						<div className="space-y-2">
							<Button type="button" variant="outline" className="w-full justify-center" onClick={resetPresetEditor}>
								<Icon icon={Plus} size={14} />
								新建机型
							</Button>
							<div className="space-y-2 rounded-xl border border-border/70 bg-background/55 p-2">
								{devicePresets.map((item) => (
									<PresetListItem
										key={item.id}
										item={item}
										selected={activePresetId === item.id}
										onClick={() => setActivePresetId(item.id)}
									/>
								))}
							</div>
						</div>

						<Card className="border-border/70 bg-background/55 p-4">
							<CardHeader className="p-0">
								<div className="flex items-center justify-between gap-3">
									<div>
										<CardTitle className="text-sm">{activePreset ? '编辑机型映射' : '新增机型映射'}</CardTitle>
										<p className="mt-1 text-xs text-muted-foreground">
											这里维护环境创建、环境列表展示和启动链路共用的机型映射参数。
										</p>
									</div>
									{activePreset ? <Badge variant="outline">编辑中</Badge> : <Badge variant="secondary">待保存新项</Badge>}
								</div>
							</CardHeader>
							<CardContent className="p-0 pt-4">
								<form className="space-y-4" onSubmit={handleSubmit(handleSavePreset)}>
									<div className="grid gap-3 md:grid-cols-2">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">机型名称</p>
											<Input {...register('label')} placeholder="例如 Pixel 8 Lab" />
											{errors.label ? <p className="mt-1 text-xs text-destructive">{errors.label.message}</p> : null}
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">平台</p>
											<Controller
												control={control}
												name="platform"
												render={({ field }) => (
													<Select value={field.value} onValueChange={field.onChange}>
														<SelectTrigger className="w-full"><SelectValue placeholder="选择平台" /></SelectTrigger>
														<SelectContent>
															{PLATFORM_OPTIONS.map((option) => (
																<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">平台版本</p>
											<Input {...register('platformVersion')} placeholder="例如 14.0.0" />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">平台参数</p>
											<Input {...register('customPlatform')} placeholder="例如 Win32 / MacIntel / Linux armv81" />
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-4">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">宽度</p>
											<Input type="number" {...register('viewportWidth', { valueAsNumber: true })} />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">高度</p>
											<Input type="number" {...register('viewportHeight', { valueAsNumber: true })} />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">DPR</p>
											<Input type="number" step="0.125" {...register('deviceScaleFactor', { valueAsNumber: true })} />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">触点</p>
											<Input type="number" {...register('touchPoints', { valueAsNumber: true })} />
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-4">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">架构</p>
											<Controller
												control={control}
												name="arch"
												render={({ field }) => (
													<Select value={field.value} onValueChange={field.onChange}>
														<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
														<SelectContent>
															{ARCH_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">位数</p>
											<Controller
												control={control}
												name="bitness"
												render={({ field }) => (
													<Select value={field.value} onValueChange={field.onChange}>
														<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
														<SelectContent>
															{BITNESS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">形态</p>
											<Controller
												control={control}
												name="formFactor"
												render={({ field }) => (
													<Select value={field.value} onValueChange={field.onChange}>
														<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
														<SelectContent>
															{FORM_FACTOR_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<div className="flex items-end">
											<label className="flex h-9 items-center gap-2 text-sm text-foreground">
												<Controller
													control={control}
													name="mobile"
													render={({ field }) => (
														<Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
													)}
												/>
												移动设备
											</label>
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-2">
										<div>
											<p className="mb-1 text-xs text-muted-foreground">GL Vendor</p>
											<Input {...register('customGlVendor')} placeholder="例如 Apple / Qualcomm / Google Inc. (Intel)" />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">GL Renderer</p>
											<Input {...register('customGlRenderer')} placeholder="例如 Apple M3 / Adreno 750" />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">CPU 核心数</p>
											<Input type="number" {...register('customCpuCores', { valueAsNumber: true })} />
										</div>
										<div>
											<p className="mb-1 text-xs text-muted-foreground">内存 (GB)</p>
											<Input type="number" {...register('customRamGb', { valueAsNumber: true })} />
											{errors.customRamGb ? <p className="mt-1 text-xs text-destructive">{errors.customRamGb.message}</p> : null}
										</div>
									</div>

									<div>
										<p className="mb-1 text-xs text-muted-foreground">UA 模板</p>
										<Textarea rows={4} {...register('userAgentTemplate')} placeholder="Mozilla/5.0 (...) Chrome/{version} Safari/537.36" />
										{errors.userAgentTemplate ? <p className="mt-1 text-xs text-destructive">{errors.userAgentTemplate.message}</p> : null}
									</div>

									<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
										<Button type="button" variant="ghost" onClick={resetPresetEditor}>清空并新建</Button>
										<Button type="submit" disabled={isSubmitting}>
											<Icon icon={activePreset ? Save : Plus} size={14} />
											{activePreset ? '保存修改' : '保存新机型'}
										</Button>
									</div>
								</form>
							</CardContent>
						</Card>
					</div>
				</Card>

				<Card className="p-4">
					<CardHeader className="p-0">
						<CardTitle className="text-sm">维护</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-3">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer text-muted-foreground hover:text-foreground"
							onClick={onOpenRecycleBin}
							disabled={!onOpenRecycleBin}
						>
							<Icon icon={Trash2} size={12} />
							打开回收站
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
