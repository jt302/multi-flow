import { Sparkles } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button, Checkbox, Icon, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/ui';
import type { WebRtcMode } from '@/entities/profile/model/types';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type FingerprintSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	deviceNameMode: 'real' | 'custom';
	customDeviceName: string;
	macAddressMode: 'real' | 'custom';
	customMacAddress: string;
	doNotTrackEnabled: boolean;
	webRtcMode: WebRtcMode;
	randomFingerprint: boolean;
	fingerprintSeed: number | null;
	availableFontFamiliesCount: number;
	onRegenerateFonts: () => void;
	onRegenerateFingerprintSeed: () => void;
	onRegenerateCustomDeviceName: () => void;
	onRegenerateCustomMacAddress: () => void;
	languageSource: string;
	timezoneSource: string;
	onMarkManual: (field: 'language' | 'timezoneId') => void;
	onRestoreProxySuggestions: () => void;
	hasProxySuggestions: boolean;
};

export function FingerprintSettingsSection({
	form,
	deviceNameMode,
	customDeviceName,
	macAddressMode,
	customMacAddress,
	doNotTrackEnabled,
	webRtcMode,
	randomFingerprint,
	fingerprintSeed,
	availableFontFamiliesCount,
	onRegenerateFonts,
	onRegenerateFingerprintSeed,
	onRegenerateCustomDeviceName,
	onRegenerateCustomMacAddress,
	languageSource,
	timezoneSource,
	onMarkManual,
	onRestoreProxySuggestions,
	hasProxySuggestions,
}: FingerprintSettingsSectionProps) {
	const { register, setValue } = form;
	const languageId = 'profile-language';
	const timezoneId = 'profile-timezone';
	const customFontListId = 'profile-custom-font-list';
	const deviceNameModeId = 'profile-device-name-mode';
	const customDeviceNameId = 'profile-custom-device-name';
	const macAddressModeId = 'profile-mac-address-mode';
	const customMacAddressId = 'profile-custom-mac-address';
	const doNotTrackEnabledId = 'profile-do-not-track-enabled';
	const webrtcIpOverrideId = 'profile-webrtc-ip-override';
	const viewportWidthId = 'profile-viewport-width';
	const viewportHeightId = 'profile-viewport-height';
	const deviceScaleFactorId = 'profile-device-scale-factor';
	const randomFingerprintId = 'profile-random-fingerprint';

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title="指纹策略"
				description="只配置上层意图，系统按平台/设备/版本自动解析整套指纹"
			/>
			{hasProxySuggestions ? (
				<div className="mb-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
					<p>已接入代理默认值，语言/时区可自动填充，也可以手动覆盖。</p>
					<Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onRestoreProxySuggestions}>
						恢复代理默认
					</Button>
				</div>
			) : null}
			<div className="grid gap-3 md:grid-cols-2">
				<div>
						<label htmlFor={languageId} className="mb-1 block text-xs text-muted-foreground">语言</label>
						<Input
							id={languageId}
							{...register('language', {
								onChange: () => onMarkManual('language'),
							})}
							placeholder="如 zh-CN / en-US"
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">来源: {languageSource === 'proxy' ? '代理默认' : languageSource === 'manual' ? '手动设置' : '未设置'}</p>
				</div>
				<div>
						<label htmlFor={timezoneId} className="mb-1 block text-xs text-muted-foreground">时区</label>
						<Input
							id={timezoneId}
							{...register('timezoneId', {
								onChange: () => onMarkManual('timezoneId'),
							})}
							placeholder="如 Asia/Shanghai"
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">来源: {timezoneSource === 'proxy' ? '代理默认' : timezoneSource === 'manual' ? '手动设置' : '未设置'}</p>
				</div>
				<div className="md:col-span-2">
					<div className="mb-1 flex items-center justify-between gap-2">
							<label htmlFor={customFontListId} className="text-xs text-muted-foreground">字体列表</label>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
							onClick={onRegenerateFonts}
						>
							<Icon icon={Sparkles} size={12} />
							随机生成
						</Button>
					</div>
						<Textarea
							id={customFontListId}
							{...register('customFontListText')}
						placeholder={'Arial\nHelvetica Neue\nSegoe UI'}
						className="min-h-[140px]"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						当前平台字体池 {availableFontFamiliesCount} 项。进入页面会先随机生成一套，可继续手动修改。
					</p>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">设备名称</p>
					<Select
						value={deviceNameMode}
						onValueChange={(value) =>
							setValue('deviceNameMode', value as 'real' | 'custom', {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger id={deviceNameModeId}>
							<SelectValue placeholder="选择设备名称模式" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="real">真实</SelectItem>
							<SelectItem value="custom">自定义</SelectItem>
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						覆盖 Chromium 进程内可见的主机名，不影响系统真实设备名。
					</p>
				</div>
				{deviceNameMode === 'custom' ? (
					<div className="md:col-span-2">
						<div className="mb-1 flex items-center justify-between gap-2">
							<label htmlFor={customDeviceNameId} className="text-xs text-muted-foreground">自定义设备名称</label>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
								onClick={onRegenerateCustomDeviceName}
							>
								<Icon icon={Sparkles} size={12} />
								随机生成
							</Button>
						</div>
						<Input
							id={customDeviceNameId}
							{...register('customDeviceName')}
							placeholder="例如 device-a1b2c3d4"
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">
							当前值：{customDeviceName}
						</p>
					</div>
				) : null}
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">MAC 地址</p>
					<Select
						value={macAddressMode}
						onValueChange={(value) =>
							setValue('macAddressMode', value as 'real' | 'custom', {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger id={macAddressModeId}>
							<SelectValue placeholder="选择 MAC 地址模式" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="real">真实</SelectItem>
							<SelectItem value="custom">自定义</SelectItem>
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						覆盖 Chromium 导出的网络接口 MAC，不修改系统真实网卡地址。
					</p>
				</div>
				{macAddressMode === 'custom' ? (
					<div className="md:col-span-2">
						<div className="mb-1 flex items-center justify-between gap-2">
							<label htmlFor={customMacAddressId} className="text-xs text-muted-foreground">自定义 MAC 地址</label>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
								onClick={onRegenerateCustomMacAddress}
							>
								<Icon icon={Sparkles} size={12} />
								随机生成
							</Button>
						</div>
						<Input
							id={customMacAddressId}
							{...register('customMacAddress')}
							placeholder="例如 A2:11:22:33:44:55"
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">
							当前值：{customMacAddress}
						</p>
					</div>
				) : null}
				<div className="md:col-span-2">
					<label
						htmlFor={doNotTrackEnabledId}
						className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
					>
						<Checkbox
							id={doNotTrackEnabledId}
							checked={doNotTrackEnabled}
							onCheckedChange={(checked) =>
								setValue('doNotTrackEnabled', checked === true, {
									shouldDirty: true,
								})
							}
						/>
						<div>
							<p className="font-medium text-foreground">Do Not Track</p>
							<p className="mt-1 text-xs text-muted-foreground">
								发送“Do Not Track”请求给网站，要求网站不收集或不跟踪您的浏览数据。
							</p>
						</div>
					</label>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">WebRTC</p>
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
							<SelectItem value="follow_ip">跟随 IP</SelectItem>
							<SelectItem value="replace">替换（指定 IP）</SelectItem>
							<SelectItem value="disable">禁用</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{webRtcMode === 'replace' ? (
					<div className="md:col-span-2">
							<label htmlFor={webrtcIpOverrideId} className="mb-1 block text-xs text-muted-foreground">WebRTC 替换 IP</label>
							<Input id={webrtcIpOverrideId} {...register('webrtcIpOverride')} placeholder="例如 8.8.8.8" />
					</div>
				) : null}
				<div>
					<label htmlFor={viewportWidthId} className="mb-1 block text-xs text-muted-foreground">分辨率宽度</label>
					<Input
						id={viewportWidthId}
						type="number"
						{...register('viewportWidth', { valueAsNumber: true })}
					/>
				</div>
				<div>
					<label htmlFor={viewportHeightId} className="mb-1 block text-xs text-muted-foreground">分辨率高度</label>
					<Input
						id={viewportHeightId}
						type="number"
						{...register('viewportHeight', { valueAsNumber: true })}
					/>
				</div>
				<div className="md:col-span-2">
					<label htmlFor={deviceScaleFactorId} className="mb-1 block text-xs text-muted-foreground">DPR</label>
					<Input
						id={deviceScaleFactorId}
						type="number"
						step="0.125"
						{...register('deviceScaleFactor', { valueAsNumber: true })}
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						初始值来自当前机型预设；如果切换机型预设，这里的分辨率会重置成新预设默认值。
					</p>
				</div>
				<div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<div>
						<p className="text-xs text-muted-foreground">Fingerprint Seed</p>
						<p className="mt-1 text-sm">{fingerprintSeed ?? '未生成'}</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						onClick={onRegenerateFingerprintSeed}
					>
						<Icon icon={Sparkles} size={12} />
						随机 Seed
					</Button>
				</div>
					<label htmlFor={randomFingerprintId} className="flex items-center gap-2 text-sm md:col-span-2">
						<Checkbox
							id={randomFingerprintId}
							checked={randomFingerprint}
						onCheckedChange={(checked) =>
							setValue('randomFingerprint', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					启动时随机 fingerprint-seed（不随机整套指纹）
				</label>
			</div>
		</div>
	);
}
