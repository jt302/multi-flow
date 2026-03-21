import type { UseFormReturn } from 'react-hook-form';

import {
	Checkbox,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type AdvancedSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	geolocationMode: 'off' | 'ip' | 'custom';
	headless: boolean;
	disableImages: boolean;
	autoAllowGeolocation: boolean;
	geolocationSource: string;
	hasProxyGeolocation: boolean;
};

export function AdvancedSettingsSection({
	form,
	geolocationMode,
	headless,
	disableImages,
	autoAllowGeolocation,
	geolocationSource,
	hasProxyGeolocation,
}: AdvancedSettingsSectionProps) {
	const { register, setValue } = form;
	const headlessId = 'profile-headless';
	const disableImagesId = 'profile-disable-images';
	const autoAllowGeolocationId = 'profile-auto-allow-geolocation';
	const geolocationModeId = 'profile-geolocation-mode';
	const launchArgsId = 'profile-custom-launch-args';
	const latitudeId = 'profile-latitude';
	const longitudeId = 'profile-longitude';
	const accuracyId = 'profile-accuracy';
	const geolocationSourceLabel =
		geolocationSource === 'proxy'
			? '代理 GEO'
			: geolocationSource === 'manual'
				? '手动设置'
				: '未设置';

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title="高级设置" description="无头模式、启动参数与地理位置" />
			<div className="space-y-3">
				<label htmlFor={headlessId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={headlessId}
						checked={headless}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('headless', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					无头模式 (Headless)
				</label>
				<label htmlFor={disableImagesId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={disableImagesId}
						checked={disableImages}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('disableImages', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					禁用图片加载
				</label>
				<div className="space-y-2">
					<label htmlFor={geolocationModeId} className="block text-xs text-muted-foreground">
						地理位置模式
					</label>
					<Select
						value={geolocationMode}
						onValueChange={(value) =>
							setValue('geolocationMode', value as 'off' | 'ip' | 'custom', {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger id={geolocationModeId} className="w-full cursor-pointer">
							<SelectValue placeholder="选择地理位置模式" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="off">关闭</SelectItem>
							<SelectItem value="ip">跟随 IP</SelectItem>
							<SelectItem value="custom">自定义</SelectItem>
						</SelectContent>
					</Select>
					{geolocationMode === 'ip' ? (
						<p className="text-[11px] text-muted-foreground">
							{hasProxyGeolocation
								? '启动时优先使用代理最近一次 GEO 结果；若代理无 GEO，再回退本机公网 IP。'
								: '启动时会查询本机公网 IP 并使用本地 GEO 库解析结果。'}
						</p>
					) : (
						<p className="text-[11px] text-muted-foreground">
							当前来源: {geolocationSourceLabel}
						</p>
					)}
				</div>
				<label htmlFor={autoAllowGeolocationId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={autoAllowGeolocationId}
						checked={autoAllowGeolocation}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('autoAllowGeolocation', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					地理位置权限始终允许
				</label>
				<div>
					<label htmlFor={launchArgsId} className="mb-1 block text-xs text-muted-foreground">
						自定义启动参数（每行一个）
					</label>
					<Textarea
						id={launchArgsId}
						{...register('customLaunchArgsText')}
						placeholder={'--custom-main-language=zh-CN\n--custom-time-zone=Asia/Shanghai\n--disable-features=OptimizationHints'}
						className="min-h-[112px]"
					/>
				</div>
				{geolocationMode === 'custom' ? (
					<div className="grid gap-3 md:grid-cols-3">
						<div>
							<label htmlFor={latitudeId} className="mb-1 block text-xs text-muted-foreground">
								纬度
							</label>
							<Input id={latitudeId} {...register('latitude')} placeholder="31.2304" />
						</div>
						<div>
							<label htmlFor={longitudeId} className="mb-1 block text-xs text-muted-foreground">
								经度
							</label>
							<Input id={longitudeId} {...register('longitude')} placeholder="121.4737" />
						</div>
						<div>
							<label htmlFor={accuracyId} className="mb-1 block text-xs text-muted-foreground">
								精度(米)
							</label>
							<Input id={accuracyId} {...register('accuracy')} placeholder="20" />
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
