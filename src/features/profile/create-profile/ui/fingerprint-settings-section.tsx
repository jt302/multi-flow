import { Sparkles } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button, Checkbox, Icon, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/ui';
import type { WebRtcMode } from '@/entities/profile/model/types';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type FingerprintSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	webRtcMode: WebRtcMode;
	randomFingerprint: boolean;
	availableFontFamiliesCount: number;
	onRegenerateFonts: () => void;
};

export function FingerprintSettingsSection({
	form,
	webRtcMode,
	randomFingerprint,
	availableFontFamiliesCount,
	onRegenerateFonts,
}: FingerprintSettingsSectionProps) {
	const { register, setValue } = form;
	const languageId = 'profile-language';
	const timezoneId = 'profile-timezone';
	const customFontListId = 'profile-custom-font-list';
	const webrtcIpOverrideId = 'profile-webrtc-ip-override';
	const randomFingerprintId = 'profile-random-fingerprint';

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title="指纹策略"
				description="只配置上层意图，系统按平台/设备/版本自动解析整套指纹"
			/>
			<div className="grid gap-3 md:grid-cols-2">
				<div>
						<label htmlFor={languageId} className="mb-1 block text-xs text-muted-foreground">语言</label>
						<Input id={languageId} {...register('language')} placeholder="如 zh-CN / en-US" />
				</div>
				<div>
						<label htmlFor={timezoneId} className="mb-1 block text-xs text-muted-foreground">时区</label>
						<Input id={timezoneId} {...register('timezoneId')} placeholder="如 Asia/Shanghai" />
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
					随机整套指纹（每次启动使用新的 bundle / fingerprint-seed）
				</label>
			</div>
		</div>
	);
}
