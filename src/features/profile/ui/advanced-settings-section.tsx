import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import { mergeCookieStateJson, type ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type AdvancedSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	cookieStateJson: string;
	profileId?: string;
	cookieStateLoading?: boolean;
	cookieStateError?: string | null;
	geolocationMode: 'off' | 'ip' | 'custom';
	headless: boolean;
	portScanProtection: boolean;
	automationDetectionShield: boolean;
	imageLoadingMode: 'off' | 'block' | 'max-area';
	autoAllowGeolocation: boolean;
	geolocationSource: string;
	hasProxyGeolocation: boolean;
};

export function AdvancedSettingsSection({
	form,
	cookieStateJson,
	profileId,
	cookieStateLoading = false,
	cookieStateError = null,
	geolocationMode,
	headless,
	portScanProtection,
	automationDetectionShield,
	imageLoadingMode,
	autoAllowGeolocation,
	geolocationSource,
	hasProxyGeolocation,
}: AdvancedSettingsSectionProps) {
	const { register, setValue } = form;
	const { t } = useTranslation(['profile', 'common']);
	const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
	const [mergeCookieText, setMergeCookieText] = useState('');
	const [mergeError, setMergeError] = useState<string | null>(null);
	const headlessId = 'profile-headless';
	const disableImagesId = 'profile-disable-images';
	const portScanProtectionId = 'profile-port-scan-protection';
	const automationDetectionShieldId = 'profile-automation-detection-shield';
	const imageLoadingModeId = 'profile-image-loading-mode';
	const imageMaxAreaId = 'profile-image-max-area';
	const autoAllowGeolocationId = 'profile-auto-allow-geolocation';
	const geolocationModeId = 'profile-geolocation-mode';
	const launchArgsId = 'profile-custom-launch-args';
	const cookieStateJsonId = 'profile-cookie-state-json';
	const mergeCookieStateJsonId = 'profile-merge-cookie-state-json';
	const latitudeId = 'profile-latitude';
	const longitudeId = 'profile-longitude';
	const accuracyId = 'profile-accuracy';
	const geolocationSourceLabel =
		geolocationSource === 'proxy'
			? t('fingerprint:sourceProxyGeo')
			: geolocationSource === 'manual'
				? t('fingerprint.sourceManual')
				: t('common:notSet');

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title={t('advanced.title')} description={t('advanced.desc')} />
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
					{t('advanced.headless')}
				</label>
				<label htmlFor={disableImagesId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={disableImagesId}
						checked={imageLoadingMode === 'block'}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('imageLoadingMode', checked === true ? 'block' : 'off', {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					/>
					{t('advanced.disableImages')}
				</label>
				<label htmlFor={portScanProtectionId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={portScanProtectionId}
						checked={portScanProtection}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('portScanProtection', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					{t('advanced.portScanProtection')}
				</label>
				<label htmlFor={automationDetectionShieldId} className="flex items-center gap-2 text-sm">
					<Checkbox
						id={automationDetectionShieldId}
						checked={automationDetectionShield}
						className="cursor-pointer"
						onCheckedChange={(checked) =>
							setValue('automationDetectionShield', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					{t('advanced.automationDetectionShield')}
				</label>
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-2">
						<label htmlFor={imageLoadingModeId} className="block text-xs text-muted-foreground">
							{t('advanced.imageLoadingMode')}
						</label>
						<Select
							value={imageLoadingMode}
							onValueChange={(value) =>
								setValue('imageLoadingMode', value as 'off' | 'block' | 'max-area', {
									shouldDirty: true,
									shouldValidate: true,
								})
							}
						>
							<SelectTrigger id={imageLoadingModeId} className="w-full cursor-pointer">
								<SelectValue placeholder={t('advanced.selectImageLoadingMode')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="off">{t('common:disabled')}</SelectItem>
								<SelectItem value="block">{t('advanced.imageLoadingBlock')}</SelectItem>
								<SelectItem value="max-area">{t('advanced.imageLoadingMaxArea')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{imageLoadingMode === 'max-area' ? (
						<div>
							<label htmlFor={imageMaxAreaId} className="mb-1 block text-xs text-muted-foreground">
								{t('advanced.imageMaxArea')}
							</label>
							<Input
								id={imageMaxAreaId}
								type="number"
								min={1}
								{...register('imageMaxArea', {
									setValueAs: (value) => {
										const nextValue = Number(value);
										return value === '' || Number.isNaN(nextValue) ? null : nextValue;
									},
								})}
								placeholder="4096"
							/>
						</div>
					) : null}
				</div>
				<div className="space-y-2">
					<label htmlFor={geolocationModeId} className="block text-xs text-muted-foreground">
						{t('advanced.geoMode')}
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
							<SelectValue placeholder={t('advanced.selectGeoMode')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="off">{t('common:disabled')}</SelectItem>
							<SelectItem value="ip">{t('common:followIp')}</SelectItem>
							<SelectItem value="custom">{t('common:custom')}</SelectItem>
						</SelectContent>
					</Select>
					{geolocationMode === 'ip' ? (
						<p className="text-[11px] text-muted-foreground">
							{hasProxyGeolocation ? t('advanced.geoFollowIpHint') : t('advanced.geoCustomHint')}
						</p>
					) : (
						<p className="text-[11px] text-muted-foreground">
							{t('advanced.currentSource')} {geolocationSourceLabel}
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
					{t('advanced.geoPermissionAlwaysAllow')}
				</label>
				<div>
					<div className="mb-1 flex items-center justify-between gap-2">
						<label htmlFor={cookieStateJsonId} className="block text-xs text-muted-foreground">
							{t('advanced.cookieJson')}
						</label>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
							onClick={() => {
								setMergeCookieText('');
								setMergeError(null);
								setMergeDialogOpen(true);
							}}
						>
							{t('advanced.mergeCookie')}
						</Button>
					</div>
					<Textarea
						id={cookieStateJsonId}
						{...register('cookieStateJson')}
						placeholder={'{\n  "environment_id": "env_001",\n  "managed_cookies": []\n}'}
						className="min-h-[180px] font-mono text-[12px]"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">{t('advanced.cookieHelp')}</p>
					{cookieStateLoading ? (
						<p className="mt-1 text-[11px] text-muted-foreground">{t('advanced.readingCookie')}</p>
					) : null}
					{cookieStateError ? (
						<p className="mt-1 text-[11px] text-destructive">{cookieStateError}</p>
					) : null}
					{cookieStateJson.trim() ? (
						<p className="mt-1 text-[11px] text-muted-foreground">{t('advanced.cookieLoaded')}</p>
					) : null}
				</div>
				<div>
					<label htmlFor={launchArgsId} className="mb-1 block text-xs text-muted-foreground">
						{t('advanced.customLaunchArgs')}
					</label>
					<Textarea
						id={launchArgsId}
						{...register('customLaunchArgsText')}
						placeholder={
							'--custom-main-language=zh-CN\n--custom-time-zone=Asia/Shanghai\n--disable-features=OptimizationHints'
						}
						className="min-h-[112px]"
					/>
				</div>
				{geolocationMode === 'custom' ? (
					<div className="grid gap-3 md:grid-cols-3">
						<div>
							<label htmlFor={latitudeId} className="mb-1 block text-xs text-muted-foreground">
								{t('advanced.latitude')}
							</label>
							<Input id={latitudeId} {...register('latitude')} placeholder="31.2304" />
						</div>
						<div>
							<label htmlFor={longitudeId} className="mb-1 block text-xs text-muted-foreground">
								{t('advanced.longitude')}
							</label>
							<Input id={longitudeId} {...register('longitude')} placeholder="121.4737" />
						</div>
						<div>
							<label htmlFor={accuracyId} className="mb-1 block text-xs text-muted-foreground">
								{t('advanced.accuracy')}
							</label>
							<Input id={accuracyId} {...register('accuracy')} placeholder="20" />
						</div>
					</div>
				) : null}
			</div>
			<Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t('advanced.mergeCookie')}</DialogTitle>
						<DialogDescription>{t('advanced.mergeCookieDesc')}</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<label htmlFor={mergeCookieStateJsonId} className="block text-xs text-muted-foreground">
							{t('advanced.cookieToMerge')}
						</label>
						<Textarea
							id={mergeCookieStateJsonId}
							value={mergeCookieText}
							onChange={(event) => {
								setMergeCookieText(event.target.value);
								if (mergeError) {
									setMergeError(null);
								}
							}}
							placeholder={'{\n  "managed_cookies": []\n}'}
							className="min-h-[220px] font-mono text-[12px]"
						/>
						{mergeError ? <p className="text-xs text-destructive">{mergeError}</p> : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setMergeDialogOpen(false)}
						>
							{t('common:cancel')}
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							onClick={() => {
								try {
									const merged = mergeCookieStateJson(
										cookieStateJson.trim() ? cookieStateJson : '{\n  "managed_cookies": []\n}',
										mergeCookieText,
										profileId,
									);
									setValue('cookieStateJson', merged, {
										shouldDirty: true,
										shouldValidate: true,
									});
									setMergeDialogOpen(false);
									setMergeCookieText('');
									setMergeError(null);
								} catch (error) {
									setMergeError(
										error instanceof Error ? error.message : t('advanced.mergeCookieFailed'),
									);
								}
							}}
						>
							{t('advanced.mergeCookie')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
