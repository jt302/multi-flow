import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';
import { PlatformGlyph } from '@/entities/profile/ui/platform-mark';
import type { ResourceItem } from '@/entities/resource/model/types';
import { PLATFORM_OPTIONS } from '@/entities/profile/lib/platform-meta';
import { cn } from '@/lib/utils';
import type { UseFormReturn } from 'react-hook-form';

import type { ProfileFormValues } from '../model/profile-form';
import { DEFAULT_STARTUP_URL } from '../model/profile-form';
import { SectionTitle } from './section-title';

type BasicSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	groupSuggestions: string[];
	hostPlatform: string;
	hostChromiumVersions: ResourceItem[];
	selectedResource?: ResourceItem;
	devicePresets: ProfileDevicePresetItem[];
	devicePresetsLoading: boolean;
	devicePresetsError: string | null;
	browserKind: string;
	browserVersion: string;
	platform: string;
	devicePresetId: string;
	browserBgColor: string;
	resourceStatusLabel: (item: ResourceItem | undefined) => string;
};

function PlatformOptionCard({
	value,
	selected,
	onSelect,
}: {
	value: (typeof PLATFORM_OPTIONS)[number];
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			type="button"
			variant="outline"
			className={cn(
				'h-auto cursor-pointer justify-start rounded-xl border px-3 py-3 text-left whitespace-normal shadow-none transition-colors',
				selected
					? 'border-primary/35 bg-primary/65 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-primary/18 hover:text-slate-50 dark:border-primary/30 dark:bg-primary/12 dark:hover:bg-primary/16 dark:hover:text-slate-50'
					: 'bg-background text-foreground hover:border-primary/25 hover:bg-accent/40 hover:text-foreground',
			)}
			onClick={onSelect}
		>
			<div className="flex w-full min-w-0 items-start gap-3">
				<div
					className={cn(
						'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
						selected ? 'border-white/15 bg-white/10 text-slate-50' : `${value.badgeClass} border-border/60`,
					)}
				>
					<PlatformGlyph meta={value} size="lg" forceLight={selected} />
				</div>
				<div className="min-w-0 space-y-1">
					<p className="min-w-0 break-words text-base font-semibold leading-none">{value.label}</p>
					<p className={cn('text-xs leading-5', selected ? 'text-slate-50/75' : 'text-muted-foreground')}>
						{value.hint}
					</p>
				</div>
			</div>
		</Button>
	);
}

export function BasicSettingsSection({
	form,
	groupSuggestions,
	hostPlatform,
	hostChromiumVersions,
	selectedResource,
	devicePresets,
	devicePresetsLoading,
	devicePresetsError,
	browserKind,
	browserVersion,
	platform,
	devicePresetId,
	browserBgColor,
	resourceStatusLabel,
}: BasicSettingsSectionProps) {
	const { register, setValue } = form;

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title="基础设置"
				description="环境名称、浏览器版本、模拟平台、设备预设与分组"
			/>
			<div className="grid gap-3 md:grid-cols-2">
				<div>
					<p className="mb-1 text-xs text-muted-foreground">环境名称</p>
					<Input {...register('name')} placeholder="例如 AirDrop-001" autoFocus />
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">分组</p>
					<Input {...register('group')} placeholder="例如 AirDrop" />
					{groupSuggestions.length > 0 ? (
						<div className="mt-1 flex flex-wrap gap-1">
							{groupSuggestions.map((value) => (
								<Button
									key={value}
									type="button"
									size="sm"
									variant="ghost"
									className="h-7 cursor-pointer rounded-md px-2 text-[11px]"
									onClick={() => setValue('group', value, { shouldDirty: true })}
								>
									{value}
								</Button>
							))}
						</div>
					) : null}
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">浏览器内核</p>
					<Select
						value={browserKind}
						onValueChange={(value) => setValue('browserKind', value, { shouldDirty: true })}
					>
						<SelectTrigger>
							<SelectValue placeholder="选择内核" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="chromium">Chromium</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div>
					<div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<span>浏览器版本</span>
						<Badge variant={selectedResource?.installed ? 'secondary' : 'outline'}>
							{resourceStatusLabel(selectedResource)}
						</Badge>
					</div>
					<Select
						value={browserVersion}
						onValueChange={(value) =>
							setValue('browserVersion', value, {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="选择浏览器版本" />
						</SelectTrigger>
						<SelectContent>
							{hostChromiumVersions.map((item) => (
								<SelectItem key={item.id} value={item.version}>
									{item.version} · {item.installed ? '已安装' : '未下载'}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						仅展示当前宿主系统 {hostPlatform} 可运行的 Chromium 版本。
					</p>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">模拟平台</p>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{PLATFORM_OPTIONS.map((item) => (
							<PlatformOptionCard
								key={item.value}
								value={item}
								selected={platform === item.value}
								onSelect={() =>
									setValue('platform', item.value, {
										shouldDirty: true,
										shouldValidate: true,
									})
								}
							/>
						))}
					</div>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">设备预设</p>
					<Select
						value={devicePresetId}
						onValueChange={(value) =>
							setValue('devicePresetId', value, {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="选择设备预设" />
						</SelectTrigger>
						<SelectContent>
							{devicePresets.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{item.label} · {item.viewportWidth}x{item.viewportHeight} · DPR {item.deviceScaleFactor}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{devicePresetsLoading
							? '设备预设加载中...'
							: devicePresetsError
								? `设备预设加载失败：${devicePresetsError}`
								: '预设会决定 UA、UA metadata、窗口尺寸、DPR、GL、字体、CPU、RAM 等整套指纹参数'}
					</p>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">备注</p>
					<Input {...register('note')} placeholder="业务描述、批次等" />
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">默认打开 URL</p>
					<Input {...register('startupUrl')} placeholder={DEFAULT_STARTUP_URL} />
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">浏览器背景色</p>
					<div className="flex items-center gap-2">
						<Input
							type="color"
							value={browserBgColor}
							onChange={(event) =>
								setValue('browserBgColor', event.target.value, {
									shouldDirty: true,
									shouldValidate: true,
								})
							}
							className="h-10 w-12 cursor-pointer rounded-lg p-1"
						/>
						<Input {...register('browserBgColor')} placeholder="#0F8A73" />
					</div>
				</div>
			</div>
		</div>
	);
}
