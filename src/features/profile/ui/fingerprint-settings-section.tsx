import { Sparkles } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import {
	Button,
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
import type { WebRtcMode } from '@/entities/profile/model/types';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';
import { useTranslation } from 'react-i18next';

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
}: FingerprintSettingsSectionProps) {
	const { register, setValue } = form;
	const { t } = useTranslation(['profile', 'common']);
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
				title={t('fingerprint.title')}
				description={t('fingerprint.desc')}
			/>
			<div className="grid gap-3 md:grid-cols-2">
				<div className="md:col-span-2">
					<div className="mb-1 flex items-center justify-between gap-2">
						<label
							htmlFor={customFontListId}
							className="text-xs text-muted-foreground"
						>
							{t('fingerprint.fontList')}
						</label>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
							onClick={onRegenerateFonts}
						>
							<Icon icon={Sparkles} size={12} />
							{t('fingerprint.randomGenerate')}
						</Button>
					</div>
					<Textarea
						id={customFontListId}
						{...register('customFontListText')}
						placeholder={'Arial\nHelvetica Neue\nSegoe UI'}
						className="min-h-[140px]"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('fingerprint.fontPoolHelp', {
							count: availableFontFamiliesCount,
						})}
					</p>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">
						{t('fingerprint.deviceName')}
					</p>
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
							<SelectValue
								placeholder={t('fingerprint.selectDeviceNameMode')}
							/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="real">{t('common:real')}</SelectItem>
							<SelectItem value="custom">{t('common:custom')}</SelectItem>
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('fingerprint.deviceNameOverrideHelp')}
					</p>
				</div>
				{deviceNameMode === 'custom' ? (
					<div className="md:col-span-2">
						<div className="mb-1 flex items-center justify-between gap-2">
							<label
								htmlFor={customDeviceNameId}
								className="text-xs text-muted-foreground"
							>
								{t('fingerprint.customDeviceName')}
							</label>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
								onClick={onRegenerateCustomDeviceName}
							>
								<Icon icon={Sparkles} size={12} />
								{t('fingerprint.randomGenerate')}
							</Button>
						</div>
						<Input
							id={customDeviceNameId}
							{...register('customDeviceName')}
							placeholder={t('fingerprint.customDeviceNamePlaceholder')}
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('fingerprint.currentValue')}
							{customDeviceName}
						</p>
					</div>
				) : null}
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">
						{t('fingerprint.macAddress')}
					</p>
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
							<SelectValue placeholder={t('fingerprint.selectMacMode')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="real">{t('common:real')}</SelectItem>
							<SelectItem value="custom">{t('common:custom')}</SelectItem>
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('fingerprint.macOverrideHelp')}
					</p>
				</div>
				{macAddressMode === 'custom' ? (
					<div className="md:col-span-2">
						<div className="mb-1 flex items-center justify-between gap-2">
							<label
								htmlFor={customMacAddressId}
								className="text-xs text-muted-foreground"
							>
								{t('fingerprint.customMac')}
							</label>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
								onClick={onRegenerateCustomMacAddress}
							>
								<Icon icon={Sparkles} size={12} />
								{t('fingerprint.randomGenerate')}
							</Button>
						</div>
						<Input
							id={customMacAddressId}
							{...register('customMacAddress')}
							placeholder={t('fingerprint.customMacPlaceholder')}
						/>
						<p className="mt-1 text-[11px] text-muted-foreground">
							{t('fingerprint.currentValue')}
							{customMacAddress}
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
							<p className="font-medium text-foreground">
								{t('fingerprint.doNotTrack')}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{t('fingerprint.doNotTrackDesc')}
							</p>
						</div>
					</label>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">
						{t('fingerprint.webrtc')}
					</p>
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
							<SelectValue placeholder={t('fingerprint.selectWebrtcPolicy')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="real">{t('common:realNoOverride')}</SelectItem>
							<SelectItem value="follow_ip">{t('common:followIp')}</SelectItem>
							<SelectItem value="replace">{t('common:replace')}</SelectItem>
							<SelectItem value="disable">{t('common:disable')}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{webRtcMode === 'replace' ? (
					<div className="md:col-span-2">
						<label
							htmlFor={webrtcIpOverrideId}
							className="mb-1 block text-xs text-muted-foreground"
						>
							{t('fingerprint.webrtcReplaceIp')}
						</label>
						<Input
							id={webrtcIpOverrideId}
							{...register('webrtcIpOverride')}
							placeholder={t('fingerprint.webrtcReplaceIpPlaceholder')}
						/>
					</div>
				) : null}
				<div>
					<label
						htmlFor={viewportWidthId}
						className="mb-1 block text-xs text-muted-foreground"
					>
						{t('fingerprint.resolutionWidth')}
					</label>
					<Input
						id={viewportWidthId}
						type="number"
						{...register('viewportWidth', { valueAsNumber: true })}
					/>
				</div>
				<div>
					<label
						htmlFor={viewportHeightId}
						className="mb-1 block text-xs text-muted-foreground"
					>
						{t('fingerprint.resolutionHeight')}
					</label>
					<Input
						id={viewportHeightId}
						type="number"
						{...register('viewportHeight', { valueAsNumber: true })}
					/>
				</div>
				<div className="md:col-span-2">
					<label
						htmlFor={deviceScaleFactorId}
						className="mb-1 block text-xs text-muted-foreground"
					>
						{t('fingerprint.dpr')}
					</label>
					<Input
						id={deviceScaleFactorId}
						type="number"
						step="0.125"
						{...register('deviceScaleFactor', { valueAsNumber: true })}
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('fingerprint.resolutionHelp')}
					</p>
				</div>
				<div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
					<div>
						<p className="text-xs text-muted-foreground">
							{t('fingerprint.fingerprintSeed')}
						</p>
						<p className="mt-1 text-sm">
							{fingerprintSeed ?? t('common:notGenerated')}
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						onClick={onRegenerateFingerprintSeed}
					>
						<Icon icon={Sparkles} size={12} />
						{t('fingerprint.randomSeed')}
					</Button>
				</div>
				<label
					htmlFor={randomFingerprintId}
					className="flex items-center gap-2 text-sm md:col-span-2"
				>
					<Checkbox
						id={randomFingerprintId}
						checked={randomFingerprint}
						onCheckedChange={(checked) =>
							setValue('randomFingerprint', checked === true, {
								shouldDirty: true,
							})
						}
					/>
					{t('fingerprint.randomSeedOnStart')}
				</label>
			</div>
		</div>
	);
}
