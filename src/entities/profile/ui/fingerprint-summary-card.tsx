import { CircleAlert, Loader2 } from 'lucide-react';

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
	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title="指纹摘要"
				description="右侧固定展示当前配置最终会注入给 Chromium 的关键参数"
			/>
			<div className="rounded-xl border border-dashed border-border/70 bg-muted/25 p-3">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<Badge variant="secondary">宿主资源 {hostPlatform}</Badge>
					<Badge
						variant={selectedResource?.installed ? 'secondary' : 'outline'}
					>
						{browserVersion || '未选择版本'} · {resourceStatusLabel(selectedResource)}
					</Badge>
					{mergedPreviewSnapshot?.presetLabel ? (
						<Badge variant="outline">{mergedPreviewSnapshot.presetLabel}</Badge>
					) : null}
					{randomFingerprint ? (
						<Badge variant="outline">启动时随机 Seed</Badge>
					) : (
						<Badge variant="secondary">固定 Seed</Badge>
					)}
				</div>
				{previewLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Icon icon={Loader2} size={14} className="animate-spin" />
						正在解析指纹摘要...
					</div>
				) : mergedPreviewSnapshot ? (
					<div className="space-y-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								UserAgent
							</p>
							<p className="mt-1 break-words text-xs">
								{mergedPreviewSnapshot.userAgent || '未生成'}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								UA Metadata
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customUaMetadata || '未生成'}
							</p>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<SummaryMetric
								label="平台参数"
								value={mergedPreviewSnapshot.customPlatform || '未设置'}
							/>
							<SummaryMetric
								label="窗口 / DPR"
								value={
									mergedPreviewSnapshot.windowWidth &&
									mergedPreviewSnapshot.windowHeight
										? `${mergedPreviewSnapshot.windowWidth}x${mergedPreviewSnapshot.windowHeight} · ${mergedPreviewSnapshot.deviceScaleFactor ?? '-'}x`
										: '未设置'
								}
							/>
							<SummaryMetric
								label="CPU / RAM"
								value={
									mergedPreviewSnapshot.customCpuCores &&
									mergedPreviewSnapshot.customRamGb
										? `${mergedPreviewSnapshot.customCpuCores} 核 / ${mergedPreviewSnapshot.customRamGb} GB`
										: '未设置'
								}
							/>
							<SummaryMetric
								label="触点"
								value={mergedPreviewSnapshot.customTouchPoints?.toString() || '桌面模式'}
							/>
							<SummaryMetric
								label="语言"
								value={mergedPreviewSnapshot.language || '跟随代理或系统'}
							/>
							<SummaryMetric
								label="时区"
								value={mergedPreviewSnapshot.timeZone || '跟随代理或系统'}
							/>
							<SummaryMetric
								label="Accept-Language"
								value={mergedPreviewSnapshot.acceptLanguages || '未覆盖'}
							/>
							<SummaryMetric
								label="Seed"
								value={mergedPreviewSnapshot.fingerprintSeed?.toString() || '启动时生成'}
							/>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								GL / GPU
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customGlVendor || '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customGlRenderer || '未设置'}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								字体集合
							</p>
							<p className="mt-1 text-xs">
								{mergedPreviewSnapshot.customFontList?.length
									? `${mergedPreviewSnapshot.customFontList.length} 个字体`
									: '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{mergedPreviewSnapshot.customFontList?.slice(0, 6).join(' / ') || '未设置'}
							</p>
						</div>
					</div>
				) : (
					<div className="flex items-center gap-2 text-sm text-destructive">
						<Icon icon={CircleAlert} size={14} />
						{previewError || '指纹摘要暂不可用'}
					</div>
				)}
			</div>
			{previewError ? <p className="mt-2 text-xs text-destructive">{previewError}</p> : null}
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
