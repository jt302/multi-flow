import { CircleAlert, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge, Icon } from '@/components/ui';

import type { ProfileFingerprintSnapshot } from '@/entities/profile/model/types';

import { SectionTitle } from '@/features/profile/ui/section-title';
import type { ResourceItem } from '@/entities/resource/model/types';

type FingerprintSummaryCardProps = {
	hostPlatform: string;
	browserVersion: string;
	selectedResource?: ResourceItem;
	randomFingerprint: boolean;
	previewLoading: boolean;
	previewError: string | null;
	mergedPreviewSnapshot: ProfileFingerprintSnapshot | null;
	resourceStatusLabel: (item: ResourceItem | undefined) => string;
};

type SummaryMetricProps = {
	label: string;
	value: string;
};

export function FingerprintSummaryCard({
	hostPlatform,
	browserVersion,
	selectedResource,
	randomFingerprint,
	previewLoading,
	previewError,
	mergedPreviewSnapshot,
	resourceStatusLabel,
}: FingerprintSummaryCardProps) {
	const { t } = useTranslation(['profile', 'common']);
	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title={t('detail.fingerprintSummary')}
				description={t('detail.fingerprintSummaryDesc')}
			/>
			<div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-3">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<Badge variant="secondary">
						{t('detail.hostResource', { platform: hostPlatform })}
					</Badge>
					<Badge
						variant={selectedResource?.installed ? 'secondary' : 'outline'}
					>
						{browserVersion || t('detail.noVersionSelected')} ·{' '}
						{resourceStatusLabel(selectedResource)}
					</Badge>
					{mergedPreviewSnapshot?.presetLabel ? (
						<Badge variant="outline">{mergedPreviewSnapshot.presetLabel}</Badge>
					) : null}
					{randomFingerprint ? (
						<Badge variant="outline">{t('detail.randomSeedOnStart')}</Badge>
					) : (
						<Badge variant="secondary">{t('detail.fixedSeed')}</Badge>
					)}
				</div>
				{previewLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Icon icon={Loader2} size={14} className="animate-spin" />
						{t('detail.parsingFingerprint')}
					</div>
				) : mergedPreviewSnapshot ? (
					<div className="space-y-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								{t('detail.userAgent')}
							</p>
							<p className="mt-1 break-words text-xs">
								{mergedPreviewSnapshot.userAgent || t('common:notGenerated')}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								{t('detail.uaMetadata')}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customUaMetadata ||
									t('common:notGenerated')}
							</p>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<SummaryMetric
								label={t('detail.platformParams')}
								value={
									mergedPreviewSnapshot.customPlatform || t('common:notSet')
								}
							/>
							<SummaryMetric
								label={t('detail.resolutionDpr')}
								value={
									mergedPreviewSnapshot.windowWidth &&
									mergedPreviewSnapshot.windowHeight
										? `${mergedPreviewSnapshot.windowWidth}x${mergedPreviewSnapshot.windowHeight} · ${mergedPreviewSnapshot.deviceScaleFactor ?? '-'}x`
										: t('common:notSet')
								}
							/>
							<SummaryMetric
								label={t('detail.cpuRam')}
								value={
									mergedPreviewSnapshot.customCpuCores &&
									mergedPreviewSnapshot.customRamGb
										? `${mergedPreviewSnapshot.customCpuCores} ${t('common:coreUnit')} / ${mergedPreviewSnapshot.customRamGb} GB`
										: t('common:notSet')
								}
							/>
							<SummaryMetric
								label={t('detail.touchFormFactor')}
								value={
									mergedPreviewSnapshot.customTouchPoints?.toString() ||
									t('common:desktopMode')
								}
							/>
							<SummaryMetric
								label={t('detail.language')}
								value={
									mergedPreviewSnapshot.language ||
									t('common:followProxyOrSystem')
								}
							/>
							<SummaryMetric
								label={t('detail.timezone')}
								value={
									mergedPreviewSnapshot.timeZone ||
									t('common:followProxyOrSystem')
								}
							/>
							<SummaryMetric
								label={t('detail.acceptLanguage')}
								value={
									mergedPreviewSnapshot.acceptLanguages || t('common:notSet')
								}
							/>
							<SummaryMetric
								label={t('detail.seed')}
								value={
									mergedPreviewSnapshot.fingerprintSeed?.toString() ||
									t('common:generatedOnStartup')
								}
							/>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								{t('detail.glGpu')}
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customGlVendor || t('common:notSet')}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customGlRenderer || t('common:notSet')}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								{t('detail.fontCollection')}
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customFontList?.length
									? t('common:fontsCount', {
											count: mergedPreviewSnapshot.customFontList.length,
										})
									: t('common:notSet')}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customFontList
									?.slice(0, 6)
									.join(' / ') || t('common:notSet')}
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2 text-sm text-destructive">
						<Icon icon={CircleAlert} size={14} />
						{previewError || t('detail.fingerprintUnavailable')}
					</div>
				)}
			</div>
			{previewError ? (
				<p className="mt-2 text-xs text-destructive">{previewError}</p>
			) : null}
		</div>
	);
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/70 p-2">
			<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 break-words text-xs">{value}</p>
		</div>
	);
}
