import { Plus, Save } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
import { useChromiumVersionsQuery } from '@/entities/chromium-version/model/use-chromium-versions-query';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';
import {
	ARCH_OPTIONS,
	BITNESS_OPTIONS,
	type DevicePresetFormValues,
	FORM_FACTOR_OPTIONS,
	PLATFORM_OPTIONS,
} from '@/features/device-presets/model/use-device-preset-editor';

type DevicePresetFormProps = {
	form: UseFormReturn<DevicePresetFormValues>;
	activePreset: ProfileDevicePresetItem | null;
	onReset: () => void;
	onSubmit: () => void;
};

export function DevicePresetForm({
	form,
	activePreset,
	onReset,
	onSubmit,
}: DevicePresetFormProps) {
	const mobileCheckboxId = 'device-preset-mobile';
	const { t } = useTranslation(['device', 'common']);
	const {
		register,
		control,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = form;

	const platform = watch('platform');
	const browserVersion = watch('browserVersion');
	const userAgentTemplate = watch('userAgentTemplate');
	const { data: chromiumVersions = [] } = useChromiumVersionsQuery(platform);

	const uaPreview = (() => {
		const major = (browserVersion ?? '').split('.')[0] || '0';
		return (userAgentTemplate ?? '').replace(/\{version\}/g, `${major}.0.0.0`);
	})();

	// When platform changes or catalog first loads, auto-set version if current is not in catalog
	useEffect(() => {
		if (chromiumVersions.length === 0) return;
		const inCatalog = chromiumVersions.some((v) => v.version === browserVersion);
		if (!inCatalog) {
			setValue('browserVersion', chromiumVersions[0].version, { shouldDirty: true });
		}
	}, [platform, chromiumVersions, browserVersion, setValue]);

	return (
		<Card className="border-border/70 bg-background/55 p-4">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle className="text-sm">
							{activePreset ? t('form.editTitle') : t('form.createTitle')}
						</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							{t('form.cardDesc')}
						</p>
					</div>
					{activePreset ? (
						<Badge variant="outline">{t('form.editing')}</Badge>
					) : (
						<Badge variant="secondary">{t('form.pendingSave')}</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="p-0 pt-4">
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.name')}
							</p>
							<Input
								{...register('label')}
								placeholder={t('form.namePlaceholder')}
							/>
							{errors.label ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.label.message}
								</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.platform')}
							</p>
							<Controller
								control={control}
								name="platform"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t('form.selectPlatform')} />
										</SelectTrigger>
										<SelectContent>
											{PLATFORM_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.browserVersion')}
							</p>
							<Controller
								control={control}
								name="browserVersion"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t('form.selectBrowserVersion')} />
										</SelectTrigger>
										<SelectContent>
											{chromiumVersions.map((v) => (
												<SelectItem key={v.version} value={v.version}>
													Chrome {v.major} · {v.version}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
							<p className="mt-1 text-[11px] text-muted-foreground">
								{t('form.browserVersionHint')}
							</p>
							{errors.browserVersion ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.browserVersion.message}
								</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.platformVersion')}
							</p>
							<Input
								{...register('platformVersion')}
								placeholder={t('form.platformVersionPlaceholder')}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.platformParams')}
							</p>
							<Input
								{...register('customPlatform')}
								placeholder={t('form.platformParamsPlaceholder')}
							/>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-4">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.width')}
							</p>
							<Input
								type="number"
								{...register('viewportWidth', { valueAsNumber: true })}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.height')}
							</p>
							<Input
								type="number"
								{...register('viewportHeight', { valueAsNumber: true })}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.dpr')}
							</p>
							<Input
								type="number"
								step="0.125"
								{...register('deviceScaleFactor', { valueAsNumber: true })}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.touchPoints')}
							</p>
							<Input
								type="number"
								{...register('touchPoints', { valueAsNumber: true })}
							/>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-4">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.arch')}
							</p>
							<Controller
								control={control}
								name="arch"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ARCH_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.bitness')}
							</p>
							<Controller
								control={control}
								name="bitness"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{BITNESS_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.formFactor')}
							</p>
							<Controller
								control={control}
								name="formFactor"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FORM_FACTOR_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div className="flex items-end">
							<label
								htmlFor={mobileCheckboxId}
								className="flex h-9 items-center gap-2 text-sm text-foreground"
							>
								<Controller
									control={control}
									name="mobile"
									render={({ field }) => (
										<Checkbox
											id={mobileCheckboxId}
											checked={field.value}
											onCheckedChange={(checked) =>
												field.onChange(Boolean(checked))
											}
										/>
									)}
								/>
								{t('form.mobileDevice')}
							</label>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.glVendor')}
							</p>
							<Input
								{...register('customGlVendor')}
								placeholder={t('form.glVendorPlaceholder')}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.glRenderer')}
							</p>
							<Input
								{...register('customGlRenderer')}
								placeholder={t('form.glRendererPlaceholder')}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.cpuCores')}
							</p>
							<Input
								type="number"
								{...register('customCpuCores', { valueAsNumber: true })}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">
								{t('form.memory')}
							</p>
							<Input
								type="number"
								{...register('customRamGb', { valueAsNumber: true })}
							/>
							{errors.customRamGb ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.customRamGb.message}
								</p>
							) : null}
						</div>
					</div>

					<div>
						<p className="mb-1 text-xs text-muted-foreground">
							{t('form.uaTemplate')}
						</p>
						<Textarea
							rows={4}
							{...register('userAgentTemplate')}
							placeholder="Mozilla/5.0 (...) Chrome/{version} Safari/537.36"
						/>
						{errors.userAgentTemplate ? (
							<p className="mt-1 text-xs text-destructive">
								{errors.userAgentTemplate.message}
							</p>
						) : null}
						<p className="mt-3 mb-1 text-xs text-muted-foreground">
							{t('form.uaPreview')}
						</p>
						<div className="rounded-md border border-border/50 bg-muted/40 p-2 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
							{uaPreview}
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('form.uaPreviewHint')}
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
						<Button type="button" variant="ghost" onClick={onReset}>
							{t('form.clearAndNew')}
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Icon icon={activePreset ? Save : Plus} size={14} />
							{activePreset ? t('form.saveChanges') : t('form.saveNewPreset')}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
