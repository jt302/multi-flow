import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';
import type {
	CreateProfilePayload,
	ProfileItem,
} from '@/entities/profile/model/types';
import { FingerprintSummaryCard } from '@/entities/profile/ui/fingerprint-summary-card';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';

import { useProfileCreateForm } from '../model/use-profile-create-form';
import { AdvancedSettingsSection } from './advanced-settings-section';
import { BasicSettingsSection } from './basic-settings-section';
import { FingerprintSettingsSection } from './fingerprint-settings-section';
import { LocaleSettingsSection } from './locale-settings-section';
import { FormErrorList } from './form-error-list';
import { PluginsSettingsSection } from './plugins-settings-section';
import { ProxySettingsSection } from './proxy-settings-section';

type ProfileCreateFormProps = {
	groups: GroupItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	onSubmit: (payload: CreateProfilePayload) => Promise<void>;
	onBack: () => void;
	mode?: 'create' | 'edit';
	initialProfile?: ProfileItem;
	initialProxyId?: string;
};

export function ProfileCreateForm(props: ProfileCreateFormProps) {
	const { t } = useTranslation('profile');
	const {
		mode,
		form,
		submitError,
		hostPlatform,
		hostChromiumVersions,
		availableProxies,
		devicePresetsQuery,
		pluginPackagesQuery,
		fontFamiliesQuery,
		previewQuery,
		selectedResource,
		mergedPreviewSnapshot,
		resourceStatusLabel,
		regenerateFontList,
		regenerateFingerprintSeed,
		regenerateCustomDeviceName,
		regenerateCustomMacAddress,
		markProxyFieldManual,
		onFormSubmit,
		values,
	} = useProfileCreateForm(props);
	const {
		errors,
		isSubmitting,
	} = form.formState;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/65 px-3 py-2.5">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						profiles / create
					</p>
					<h2 className="text-base font-semibold">
						{mode === 'edit' ? t('create.editTitle') : t('create.pageTitle')}
					</h2>
				</div>
				<Button type="button" variant="outline" className="cursor-pointer" onClick={props.onBack}>
					<Icon icon={ArrowLeft} size={14} />
					{t('detail.backToList')}
				</Button>
			</div>

			<Card className="p-4">
				<CardHeader className="p-0 pb-2">
					<CardTitle className="text-sm">{t('create.fullConfigTitle')}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 p-0">
					<form onSubmit={onFormSubmit} className="space-y-4">
						<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
							<div className="space-y-4">
							<BasicSettingsSection
								form={form}
								groups={props.groups}
								hostPlatform={hostPlatform}
								hostChromiumVersions={hostChromiumVersions}
								selectedResource={selectedResource}
								devicePresets={devicePresetsQuery.data ?? []}
								devicePresetsLoading={devicePresetsQuery.isLoading}
								devicePresetsError={devicePresetsQuery.error instanceof Error ? devicePresetsQuery.error.message : null}
								browserKind={values.browserKind}
								browserVersion={values.browserVersion}
								groupValue={values.group}
								platform={values.platform}
								devicePresetId={values.devicePresetId}
								browserBgColor={values.browserBgColor}
								browserBgColorMode={values.browserBgColorMode}
								toolbarLabelMode={values.toolbarLabelMode}
								resourceStatusLabel={resourceStatusLabel}
							/>

								<LocaleSettingsSection
									form={form}
									localeMode={values.localeMode}
									languageSource={values.proxySuggestionSource.language}
									timezoneSource={values.proxySuggestionSource.timezoneId}
									onMarkManual={markProxyFieldManual}
								/>

								<FingerprintSettingsSection
									form={form}
									deviceNameMode={values.deviceNameMode}
									customDeviceName={values.customDeviceName}
									macAddressMode={values.macAddressMode}
									customMacAddress={values.customMacAddress}
									doNotTrackEnabled={values.doNotTrackEnabled}
									webRtcMode={values.webRtcMode}
									randomFingerprint={values.randomFingerprint}
									fingerprintSeed={values.fingerprintSeed}
									availableFontFamiliesCount={fontFamiliesQuery.data?.length ?? 0}
								onRegenerateFonts={() => {
									void regenerateFontList().catch((error) => {
											const message = error instanceof Error ? error.message : t('create.fontListRegenerateFailed');
										form.setError('customFontListText', { message });
									});
								}}
									onRegenerateFingerprintSeed={regenerateFingerprintSeed}
									onRegenerateCustomDeviceName={regenerateCustomDeviceName}
									onRegenerateCustomMacAddress={regenerateCustomMacAddress}
								/>

								<ProxySettingsSection
									form={form}
									availableProxies={availableProxies}
									proxyId={values.proxyId}
								/>

								<PluginsSettingsSection
									form={form}
									packages={pluginPackagesQuery.data ?? []}
									pluginSelections={values.pluginSelections}
									loading={pluginPackagesQuery.isLoading}
									error={
										pluginPackagesQuery.error instanceof Error
											? pluginPackagesQuery.error.message
											: null
									}
								/>

								<AdvancedSettingsSection
									form={form}
									cookieStateJson={values.cookieStateJson}
									profileId={props.initialProfile?.id}
									cookieStateLoading={values.runtimeCookieStateLoading}
									cookieStateError={values.runtimeCookieStateError}
									geolocationMode={values.geolocationMode}
									headless={values.headless}
									disableImages={values.disableImages}
									autoAllowGeolocation={values.autoAllowGeolocation}
									geolocationSource={values.proxySuggestionSource.geolocation}
									hasProxyGeolocation={Boolean(
										values.selectedProxy &&
											values.selectedProxy.latitude !== null &&
											values.selectedProxy.longitude !== null,
									)}
								/>

								<FormErrorList errors={errors} submitError={submitError} />
								<div className="flex items-center gap-2">
					<Button type="button" variant="outline" className="flex-1 cursor-pointer" onClick={props.onBack}>
						{t('create.cancel')}
					</Button>
									<Button
										type="submit"
										className="flex-1 cursor-pointer"
										disabled={!values.name.trim() || isSubmitting || !mergedPreviewSnapshot}
									>
										<Icon icon={Plus} size={14} />
										{isSubmitting ? (mode === 'edit' ? t('create.saving') : t('create.creating')) : mode === 'edit' ? t('create.saveChanges') : t('create.createProfile')}
									</Button>
								</div>
							</div>

							<div className="space-y-4 xl:sticky xl:top-3">
								<FingerprintSummaryCard
									hostPlatform={hostPlatform}
									browserVersion={values.browserVersion}
									selectedResource={selectedResource}
									randomFingerprint={values.randomFingerprint}
									previewLoading={previewQuery.isLoading}
									previewError={previewQuery.error instanceof Error ? previewQuery.error.message : null}
									mergedPreviewSnapshot={mergedPreviewSnapshot}
									resourceStatusLabel={resourceStatusLabel}
								/>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
