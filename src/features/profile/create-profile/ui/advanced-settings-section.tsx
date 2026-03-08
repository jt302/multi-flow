import type { UseFormReturn } from 'react-hook-form';

import { Checkbox, Input, Textarea } from '@/components/ui';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type AdvancedSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	geoEnabled: boolean;
	headless: boolean;
	disableImages: boolean;
};

export function AdvancedSettingsSection({
	form,
	geoEnabled,
	headless,
	disableImages,
}: AdvancedSettingsSectionProps) {
	const { register, setValue } = form;

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title="高级设置" description="无头模式、启动参数与地理位置" />
			<div className="space-y-3">
				<label className="flex items-center gap-2 text-sm">
					<Checkbox
						checked={headless}
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
						checked={disableImages}
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
					<p className="mb-1 text-xs text-muted-foreground">自定义启动参数（每行一个）</p>
					<Textarea
						{...register('customLaunchArgsText')}
						placeholder={'--custom-main-language=zh-CN\n--custom-time-zone=Asia/Shanghai\n--disable-features=OptimizationHints'}
						className="min-h-[112px]"
					/>
				</div>
				{geoEnabled ? (
					<div className="grid gap-3 md:grid-cols-3">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">纬度</p>
							<Input {...register('latitude')} placeholder="31.2304" />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">经度</p>
							<Input {...register('longitude')} placeholder="121.4737" />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">精度(米)</p>
							<Input {...register('accuracy')} placeholder="20" />
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
