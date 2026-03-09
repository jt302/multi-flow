import type { UseFormReturn } from 'react-hook-form';

import { Checkbox, Input, Textarea } from '@/components/ui';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type AdvancedSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	geoEnabled: boolean;
	headless: boolean;
	disableImages: boolean;
	geolocationSource: string;
	onMarkGeolocationManual: () => void;
};

export function AdvancedSettingsSection({
	form,
	geoEnabled,
	headless,
	disableImages,
	geolocationSource,
	onMarkGeolocationManual,
}: AdvancedSettingsSectionProps) {
	const { register, setValue } = form;
	const headlessId = 'profile-headless';
	const disableImagesId = 'profile-disable-images';
	const geoEnabledId = 'profile-geo-enabled';
	const launchArgsId = 'profile-custom-launch-args';
	const latitudeId = 'profile-latitude';
	const longitudeId = 'profile-longitude';
	const accuracyId = 'profile-accuracy';

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title="高级设置" description="无头模式、启动参数与地理位置" />
			<div className="space-y-3">
					<label htmlFor={headlessId} className="flex items-center gap-2 text-sm">
						<Checkbox
							id={headlessId}
							checked={headless}
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
						onCheckedChange={(checked) =>
							setValue('disableImages', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					禁用图片加载
				</label>
					<label htmlFor={geoEnabledId} className="flex items-center gap-2 text-sm">
						<Checkbox
							id={geoEnabledId}
							checked={geoEnabled}
						onCheckedChange={(checked) =>
							(onMarkGeolocationManual(),
							setValue('geoEnabled', checked === true, {
								shouldDirty: true,
								shouldValidate: true,
							}))
						}
					/>
					启用地理位置覆盖
				</label>
				<p className="text-[11px] text-muted-foreground">地理位置来源: {geolocationSource === 'proxy' ? '代理建议' : geolocationSource === 'manual' ? '手动设置' : '未设置'}</p>
				<div>
						<label htmlFor={launchArgsId} className="mb-1 block text-xs text-muted-foreground">自定义启动参数（每行一个）</label>
						<Textarea
							id={launchArgsId}
							{...register('customLaunchArgsText')}
						placeholder={'--custom-main-language=zh-CN\n--custom-time-zone=Asia/Shanghai\n--disable-features=OptimizationHints'}
						className="min-h-[112px]"
					/>
				</div>
				{geoEnabled ? (
					<div className="grid gap-3 md:grid-cols-3">
						<div>
								<label htmlFor={latitudeId} className="mb-1 block text-xs text-muted-foreground">纬度</label>
								<Input id={latitudeId} {...register('latitude', { onChange: onMarkGeolocationManual })} placeholder="31.2304" />
						</div>
						<div>
								<label htmlFor={longitudeId} className="mb-1 block text-xs text-muted-foreground">经度</label>
								<Input id={longitudeId} {...register('longitude', { onChange: onMarkGeolocationManual })} placeholder="121.4737" />
						</div>
						<div>
								<label htmlFor={accuracyId} className="mb-1 block text-xs text-muted-foreground">精度(米)</label>
								<Input id={accuracyId} {...register('accuracy', { onChange: onMarkGeolocationManual })} placeholder="20" />
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
