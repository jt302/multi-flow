import { ArrowLeft, PencilLine, Shield, Sparkles } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';

import { PlatformMark } from '../components/platform-mark';
import type { ProfileItem, ProxyItem, ResourceItem } from '../types';
import { formatProfileTime, resolveBrowserVersionMeta, resolvePlatformMeta } from '../utils';

type ProfileDetailPageProps = {
	profile: ProfileItem;
	resources: ResourceItem[];
	boundProxy?: ProxyItem;
	onBack: () => void;
	onEditProfile: (profileId: string) => void;
};

function DetailMetric({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
			<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
			<p className="mt-1 break-words text-sm">{value}</p>
		</div>
	);
}

export function ProfileDetailPage({
	profile,
	resources,
	boundProxy,
	onBack,
	onEditProfile,
}: ProfileDetailPageProps) {
	const basic = profile.settings?.basic;
	const fingerprint = profile.settings?.fingerprint;
	const source = fingerprint?.fingerprintSource;
	const snapshot = fingerprint?.fingerprintSnapshot;
	const browserVersionMeta = resolveBrowserVersionMeta(profile, resources);
	const platformMeta = resolvePlatformMeta(profile);
	const statusLabel = profile.running ? '运行中' : '未运行';
	const toolbarText = basic?.toolbarText?.trim();
	const startupUrl = basic?.startupUrl?.trim() || '未设置';
	const proxyLabel = boundProxy
		? `${boundProxy.name} · ${boundProxy.protocol.toUpperCase()}://${boundProxy.host}:${boundProxy.port}`
		: '未绑定代理';

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/65 px-3 py-2.5">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
						profiles / detail
					</p>
					<h2 className="text-base font-semibold">环境详情</h2>
				</div>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" className="cursor-pointer" onClick={onBack}>
						<Icon icon={ArrowLeft} size={14} />
						返回列表
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						onClick={() => onEditProfile(profile.id)}
					>
						<Icon icon={PencilLine} size={14} />
						修改配置
					</Button>
				</div>
			</div>

			<Card className="p-4">
				<CardHeader className="flex flex-row items-start justify-between gap-3 p-0 pb-3">
					<div className="flex items-start gap-3">
						<PlatformMark meta={platformMeta} size="lg" />
						<div>
							<CardTitle className="text-lg">{profile.name}</CardTitle>
							<p className="mt-1 text-sm text-muted-foreground">
								{profile.group} · {statusLabel}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{platformMeta.code} · {platformMeta.hint}
							</p>
							{toolbarText && toolbarText !== profile.name ? (
								<p className="mt-1 text-xs text-muted-foreground">工具栏文本 {toolbarText}</p>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Badge variant="secondary">{platformMeta.label}</Badge>
						<Badge variant={profile.running ? 'default' : 'outline'}>{statusLabel}</Badge>
						<Badge
							variant={
								browserVersionMeta.resourceLabel === '已安装' ? 'secondary' : 'outline'
							}
						>
							{browserVersionMeta.versionLabel}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 p-0 md:grid-cols-2 xl:grid-cols-4">
					<DetailMetric label="浏览器资源" value={browserVersionMeta.resourceLabel} />
					<DetailMetric label="默认打开 URL" value={startupUrl} />
					<DetailMetric label="代理" value={proxyLabel} />
					<DetailMetric label="最近启动" value={formatProfileTime(profile.lastOpenedAt)} />
				</CardContent>
			</Card>

			<div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Shield} size={16} />
						<CardTitle className="text-sm">指纹来源</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 p-0 md:grid-cols-2">
						<DetailMetric label="模拟平台" value={source?.platform || basic?.platform || '未设置'} />
						<DetailMetric label="设备预设" value={source?.devicePresetId || '未设置'} />
						<DetailMetric label="浏览器版本" value={source?.browserVersion || basic?.browserVersion || '未设置'} />
						<DetailMetric label="策略 / Seed Policy" value={`${source?.strategy || 'template'} / ${source?.seedPolicy || 'fixed'}`} />
						<DetailMetric label="Catalog" value={source?.catalogVersion || '未设置'} />
						<DetailMetric label="WebRTC" value={fingerprint?.webRtcMode || 'real'} />
					</CardContent>
				</Card>

				<Card className="p-4">
					<CardHeader className="flex flex-row items-center gap-2 p-0 pb-3">
						<Icon icon={Sparkles} size={16} />
						<CardTitle className="text-sm">指纹摘要</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 p-0">
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">UserAgent</p>
							<p className="mt-1 break-words text-sm">{snapshot?.userAgent || '未生成'}</p>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">UA Metadata</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customUaMetadata || '未生成'}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<DetailMetric
								label="平台参数"
								value={snapshot?.customPlatform || '未设置'}
							/>
							<DetailMetric
								label="窗口 / DPR"
								value={
									snapshot?.windowWidth && snapshot?.windowHeight
										? `${snapshot.windowWidth}x${snapshot.windowHeight} · ${snapshot.deviceScaleFactor ?? '-'}x`
										: '未设置'
								}
							/>
							<DetailMetric
								label="CPU / RAM"
								value={
									snapshot?.customCpuCores && snapshot?.customRamGb
										? `${snapshot.customCpuCores} 核 / ${snapshot.customRamGb} GB`
										: '未设置'
								}
							/>
							<DetailMetric
								label="触点 / 形态"
								value={`${snapshot?.customTouchPoints ?? 0} / ${snapshot?.formFactor || '未设置'}`}
							/>
							<DetailMetric
								label="GL Vendor"
								value={snapshot?.customGlVendor || '未设置'}
							/>
							<DetailMetric
								label="GL Renderer"
								value={snapshot?.customGlRenderer || '未设置'}
							/>
							<DetailMetric label="语言" value={snapshot?.language || '未设置'} />
							<DetailMetric label="时区" value={snapshot?.timeZone || '未设置'} />
							<DetailMetric
								label="Accept-Language"
								value={snapshot?.acceptLanguages || '未设置'}
							/>
							<DetailMetric
								label="Seed"
								value={snapshot?.fingerprintSeed?.toString() || '启动时生成'}
							/>
						</div>
						<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">字体集合</p>
							<p className="mt-1 text-sm">
								{snapshot?.customFontList?.length
									? `${snapshot.customFontList.length} 个字体`
									: '未设置'}
							</p>
							<p className="mt-1 break-words text-xs text-muted-foreground">
								{snapshot?.customFontList?.slice(0, 10).join(' / ') || '未设置'}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
