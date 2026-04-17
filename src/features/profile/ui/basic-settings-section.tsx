import {
	Badge,
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';
import { PlatformGlyph } from '@/entities/profile/ui/platform-mark';
import type { ResourceItem } from '@/entities/resource/model/types';
import { PLATFORM_OPTIONS } from '@/entities/profile/lib/platform-meta';
import { cn } from '@/lib/utils';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { ProfileFormValues } from '../model/profile-form';
import { DEFAULT_STARTUP_URL } from '../model/profile-form';
import { SectionTitle } from './section-title';

type BasicSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	groups: GroupItem[];
	hostPlatform: string;
	hostChromiumVersions: ResourceItem[];
	selectedResource?: ResourceItem;
	devicePresets: ProfileDevicePresetItem[];
	devicePresetsLoading: boolean;
	devicePresetsError: string | null;
	browserKind: string;
	browserVersion: string;
	groupValue: string;
	platform: string;
	devicePresetId: string;
	browserBgColor: string;
	browserBgColorMode: 'inherit' | 'custom' | 'none';
	toolbarLabelMode: 'inherit' | 'id_only' | 'group_name_and_id';
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
						selected
							? 'border-white/15 bg-white/10 text-slate-50'
							: `${value.badgeClass} border-border/60`,
					)}
				>
					<PlatformGlyph meta={value} size="lg" forceLight={selected} />
				</div>
				<div className="min-w-0 space-y-1">
					<p className="min-w-0 break-words text-base font-semibold leading-none">
						{value.label}
					</p>
					<p
						className={cn(
							'text-xs leading-5',
							selected ? 'text-slate-50/75' : 'text-muted-foreground',
						)}
					>
						{value.hint}
					</p>
				</div>
			</div>
		</Button>
	);
}

export function BasicSettingsSection({
	form,
	groups,
	hostPlatform: _hostPlatform,
	hostChromiumVersions,
	selectedResource,
	devicePresets,
	devicePresetsLoading,
	devicePresetsError,
	browserKind,
	browserVersion,
	groupValue,
	platform,
	devicePresetId,
	browserBgColor,
	browserBgColorMode,
	toolbarLabelMode,
	resourceStatusLabel,
}: BasicSettingsSectionProps) {
	const { register, setValue } = form;
	const { t } = useTranslation(['profile', 'common']);

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle title={t('basic.title')} description={t('basic.desc')} />
			<div className="grid gap-3 md:grid-cols-2">
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.name')}
					</p>
					<Input
						{...register('name')}
						placeholder={t('basic.namePlaceholder')}
					/>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.group')}
					</p>
					<Select
						value={groupValue || '__none__'}
						onValueChange={(value) =>
							setValue('group', value === '__none__' ? '' : value, {
								shouldDirty: true,
							})
						}
					>
						<SelectTrigger>
							<SelectValue placeholder={t('basic.selectGroup')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__none__">{t('basic.ungrouped')}</SelectItem>
							{groups.map((group) => (
								<SelectItem key={group.id} value={group.name}>
									{group.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.browserEngine')}
					</p>
					<Select
						value={browserKind}
						onValueChange={(value) =>
							setValue('browserKind', value, { shouldDirty: true })
						}
					>
						<SelectTrigger>
							<SelectValue placeholder={t('basic.selectEngine')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="chromium">Chromium</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div>
					<div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<span>{t('basic.browserVersion')}</span>
						<Badge
							variant={selectedResource?.installed ? 'secondary' : 'outline'}
						>
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
							<SelectValue placeholder={t('basic.selectVersion')} />
						</SelectTrigger>
						<SelectContent>
							{hostChromiumVersions.map((item) => (
								<SelectItem key={item.id} value={item.version}>
									{item.version} ·{' '}
									{item.installed
										? t('common:installed')
										: t('common:notDownloaded')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('basic.onlyHostVersions')}
					</p>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.simulatedPlatform')}
					</p>
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
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.devicePreset')}
					</p>
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
							<SelectValue placeholder={t('basic.selectDevicePreset')} />
						</SelectTrigger>
						<SelectContent>
							{devicePresets.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{item.label} · 分辨率 {item.viewportWidth}x
									{item.viewportHeight} · DPR {item.deviceScaleFactor}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{devicePresetsLoading
							? t('basic.devicePresetLoading')
							: devicePresetsError
								? t('basic.devicePresetLoadFailed', {
										error: devicePresetsError,
									})
								: t('basic.devicePresetHelp')}
					</p>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.note')}
					</p>
					<Input
						{...register('note')}
						placeholder={t('basic.notePlaceholder')}
					/>
				</div>
				<div className="md:col-span-2">
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.startupUrls')}
					</p>
					<Textarea
						{...register('startupUrls')}
						placeholder={`${DEFAULT_STARTUP_URL}\nhttps://example.com`}
						className="min-h-24"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{t('basic.startupUrlsHelp')}
					</p>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('basic.browserBgColor')}
					</p>
					<div className="grid gap-2">
						<Select
							value={browserBgColorMode}
							onValueChange={(value) =>
								setValue('browserBgColorMode', value as 'inherit' | 'custom' | 'none', {
									shouldDirty: true,
									shouldValidate: true,
								})
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="inherit">{t('visual.inheritGroup')}</SelectItem>
								<SelectItem value="none">{t('visual.noBackgroundColor')}</SelectItem>
								<SelectItem value="custom">{t('visual.customColor')}</SelectItem>
							</SelectContent>
						</Select>
						{browserBgColorMode === 'custom' ? (
							<div className="flex items-center gap-2">
								<Input
									type="color"
									value={browserBgColor || '#0F8A73'}
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
						) : null}
					</div>
				</div>
				<div>
					<p className="mb-1 text-xs text-muted-foreground">
						{t('visual.toolbarLabel')}
					</p>
					<Select
						value={toolbarLabelMode}
						onValueChange={(value) =>
							setValue('toolbarLabelMode', value as 'inherit' | 'id_only' | 'group_name_and_id', {
								shouldDirty: true,
							})
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{groupValue ? (
								<SelectItem value="inherit">{t('visual.inheritGroup')}</SelectItem>
							) : null}
							<SelectItem value="id_only">{t('visual.idOnly')}</SelectItem>
							<SelectItem value="group_name_and_id">
								{t('visual.groupNameAndId')}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
