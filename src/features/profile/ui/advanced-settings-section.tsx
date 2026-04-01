import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

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

import {
	mergeCookieStateJson,
	type ProfileFormValues,
} from '../model/profile-form';
import { SectionTitle } from './section-title';

type AdvancedSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	cookieStateJson: string;
	profileId?: string;
	cookieStateLoading?: boolean;
	cookieStateError?: string | null;
	geolocationMode: 'off' | 'ip' | 'custom';
	headless: boolean;
	disableImages: boolean;
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
	disableImages,
	autoAllowGeolocation,
	geolocationSource,
	hasProxyGeolocation,
}: AdvancedSettingsSectionProps) {
	const { register, setValue } = form;
	const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
	const [mergeCookieText, setMergeCookieText] = useState('');
	const [mergeError, setMergeError] = useState<string | null>(null);
	const headlessId = 'profile-headless';
	const disableImagesId = 'profile-disable-images';
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
					<div className="mb-1 flex items-center justify-between gap-2">
						<label htmlFor={cookieStateJsonId} className="block text-xs text-muted-foreground">
							Cookie JSON
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
							合并 Cookie
						</Button>
					</div>
					<Textarea
						id={cookieStateJsonId}
						{...register('cookieStateJson')}
						placeholder={'{\n  "environment_id": "env_001",\n  "managed_cookies": []\n}'}
						className="min-h-[180px] font-mono text-[12px]"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						仅支持 Chromium `cookie-state-file` 兼容 JSON。保存环境后会写入环境本地 Cookie 文件，启动时会注入到当前 profile。
					</p>
					{cookieStateLoading ? (
						<p className="mt-1 text-[11px] text-muted-foreground">
							正在读取环境本地 Cookie 文件...
						</p>
					) : null}
					{cookieStateError ? (
						<p className="mt-1 text-[11px] text-destructive">{cookieStateError}</p>
					) : null}
					{cookieStateJson.trim() ? (
						<p className="mt-1 text-[11px] text-muted-foreground">
							当前已填写环境本地 Cookie 文件内容。
						</p>
					) : null}
				</div>
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
			<Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>合并 Cookie</DialogTitle>
						<DialogDescription>
							输入另一段 Cookie JSON，确认后会按 name + domain + path 合并，后输入覆盖先输入。
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<label htmlFor={mergeCookieStateJsonId} className="block text-xs text-muted-foreground">
							待合并 Cookie JSON
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
						{mergeError ? (
							<p className="text-xs text-destructive">{mergeError}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							onClick={() => setMergeDialogOpen(false)}
						>
							取消
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							onClick={() => {
								try {
									const merged = mergeCookieStateJson(
										cookieStateJson.trim()
											? cookieStateJson
											: '{\n  "managed_cookies": []\n}',
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
										error instanceof Error
											? error.message
											: '合并 Cookie 失败',
									);
								}
							}}
						>
							确认合并
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
