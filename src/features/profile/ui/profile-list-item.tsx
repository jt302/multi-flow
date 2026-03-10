import {
	Eye,
	Loader2,
	Monitor,
	MoreHorizontal,
	FolderTree,
	Palette,
	Play,
	RotateCcw,
	Square,
	Trash2,
	Type,
	Wrench,
} from 'lucide-react';

import {
	Badge,
	Button,
	Checkbox,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Icon,
	TableCell,
	TableRow,
} from '@/components/ui';
import {
	formatProfileTime,
	resolveBrowserVersionMeta,
	resolvePlatformMeta,
} from '@/entities/profile/lib/profile-list';
import type {
	ProfileActionState,
	ProfileItem,
} from '@/entities/profile/model/types';
import type { GroupItem } from '@/entities/group/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import { cn } from '@/lib/utils';

import { PlatformMark } from '@/entities/profile/ui/platform-mark';
import { BackgroundQuickEditForm, ToolbarQuickEditForm } from './profile-list-quick-edit-forms';

type QuickEditField = 'background' | 'toolbar';

type ProfileListItemProps = {
	item: ProfileItem;
	groups: GroupItem[];
	resources: ResourceItem[];
	index: number;
	total: number;
	selected: boolean;
	onSelectedChange: (checked: boolean) => void;
	actionState?: ProfileActionState;
	boundProxy?: ProxyItem;
	quickEdit: { profileId: string; field: QuickEditField } | null;
	onQuickEditChange: (value: { profileId: string; field: QuickEditField } | null) => void;
	onRunAction: (action: () => Promise<void>) => Promise<void>;
	onViewProfile: (profileId: string) => void;
	onCreateClick: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
};

function resolveRunningLabel(running: boolean, actionState?: ProfileActionState) {
	if (actionState === 'opening') {
		return '启动中';
	}
	if (actionState === 'closing') {
		return '关闭中';
	}
	if (actionState === 'recovering') {
		return '异常回收中';
	}
	return running ? '运行中' : '未运行';
}

export function ProfileListItem({
	item,
	groups,
	resources,
	index,
	total,
	selected,
	onSelectedChange,
	actionState,
	boundProxy,
	quickEdit,
	onQuickEditChange,
	onRunAction,
	onViewProfile,
	onCreateClick,
	onUpdateProfileVisual,
	onOpenProfile,
	onCloseProfile,
	onSetProfileGroup,
	onFocusProfileWindow,
	onDeleteProfile,
	onRestoreProfile,
}: ProfileListItemProps) {
	const actionPending = Boolean(actionState);
	const runLabel = resolveRunningLabel(item.running, actionState);
	const proxyCountry = boundProxy?.country?.trim() || '未绑定';
	const platformMeta = resolvePlatformMeta(item);
	const currentBg = item.settings?.basic?.browserBgColor ?? '#0F8A73';
	const currentToolbarText = item.settings?.basic?.toolbarText ?? item.name;
	const normalizedNote =
		item.note?.trim() && item.note.trim() !== '未填写备注' ? item.note.trim() : '无备注';
	const groupLabel = item.group?.trim() || '未分组';
	const presetLabel =
		item.settings?.fingerprint?.fingerprintSnapshot?.presetLabel?.trim() ||
		item.settings?.basic?.devicePresetId?.trim() ||
		'未设置预设';
	const browserVersionMeta = resolveBrowserVersionMeta(item, resources);
	const toolbarTextTrimmed = currentToolbarText.trim();
	const showToolbarText = Boolean(toolbarTextTrimmed) && toolbarTextTrimmed !== item.name.trim();
	const proxyPrimary = boundProxy?.name?.trim() || '未绑定代理';
	const proxySecondary = boundProxy
		? `${boundProxy.protocol.toUpperCase()} · ${proxyCountry}`
		: '未绑定';
	const editConfigDisabled = actionPending || item.running;
	const isBgEditing = quickEdit?.profileId === item.id && quickEdit.field === 'background';
	const isToolbarEditing = quickEdit?.profileId === item.id && quickEdit.field === 'toolbar';

	return (
		<>
			<TableRow className={cn(index === total - 1 && 'border-b-0')}>
				<TableCell className="w-[86px] align-top">
					<div className="grid grid-cols-[1rem_2.25rem] items-center justify-center gap-2 pt-1">
						<Checkbox
							checked={selected}
							disabled={item.lifecycle !== 'active'}
							onCheckedChange={(checked) => onSelectedChange(checked === true)}
						/>
						<PlatformMark meta={platformMeta} size="sm" />
					</div>
				</TableCell>

				<TableCell className="align-top">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-medium">{item.name}</p>
							<Badge variant="outline" className="max-w-[140px] truncate text-[10px]">
								{groupLabel}
							</Badge>
							{showToolbarText ? (
								<Badge variant="secondary" className="max-w-[160px] truncate text-[10px]">
									{toolbarTextTrimmed}
								</Badge>
							) : null}
						</div>
						<p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
							<span
								className="inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium"
								style={{
									backgroundColor: `color-mix(in oklab, ${currentBg} 18%, transparent)`,
									borderColor: `color-mix(in oklab, ${currentBg} 36%, var(--border))`,
									color: `color-mix(in oklab, ${currentBg} 62%, var(--foreground))`,
								}}
							>
								{currentBg}
							</span>
							<span className="truncate">备注 {normalizedNote}</span>
						</p>
					</div>
				</TableCell>

				<TableCell className="align-top">
					<p className="truncate text-xs text-muted-foreground">{normalizedNote}</p>
					<p className="mt-1 truncate text-[11px] text-muted-foreground">
						{browserVersionMeta.versionLabel} · {browserVersionMeta.resourceLabel}
					</p>
				</TableCell>

				<TableCell className="align-top">
					<p className="truncate text-xs">{presetLabel}</p>
					<p className="truncate text-[11px] text-muted-foreground">
						{proxyPrimary} · {proxySecondary}
					</p>
				</TableCell>

				<TableCell className="w-[90px] align-top">
					<Badge variant={item.lifecycle === 'active' ? 'outline' : 'secondary'}>
						{item.lifecycle === 'active' ? '可用' : '已归档'}
					</Badge>
				</TableCell>

				<TableCell className="w-[140px] align-top">
					<Badge variant={item.running || actionPending ? 'default' : 'secondary'}>
						{runLabel}
					</Badge>
					<p className="mt-1 text-[11px] text-muted-foreground">最近: {formatProfileTime(item.lastOpenedAt)}</p>
				</TableCell>

				<TableCell className="w-[130px] align-top text-right">
					<div className="flex justify-end gap-1">
						{item.lifecycle === 'active' ? (
							<>
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									className={cn(
										item.running
											? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
											: 'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300',
									)}
									disabled={actionPending}
									onClick={() => {
										void onRunAction(item.running ? () => onCloseProfile(item.id) : () => onOpenProfile(item.id));
									}}
								>
									{actionPending ? (
										<Icon icon={Loader2} size={13} className="animate-spin" />
									) : (
										<Icon icon={item.running ? Square : Play} size={13} />
									)}
								</Button>

								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									className={cn(
										item.running
											? 'text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300'
											: 'text-muted-foreground/60',
									)}
									title={item.running ? '显示浏览器窗口' : '环境未运行'}
									disabled={actionPending || !item.running}
									onClick={() => {
										void onRunAction(() => onFocusProfileWindow(item.id));
									}}
								>
									<Icon icon={Monitor} size={13} />
								</Button>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											size="icon-sm"
											variant="ghost"
											disabled={actionPending}
										>
											<Icon icon={MoreHorizontal} size={13} />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuItem className="cursor-pointer" onClick={() => onViewProfile(item.id)}>
											<Icon icon={Eye} size={13} />
											查看详情
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer"
											disabled={!item.running}
											onClick={() => {
												if (!item.running) {
													return;
												}
												onQuickEditChange({ profileId: item.id, field: 'background' });
											}}
										>
											<Icon icon={Palette} size={13} />
											修改背景色
										</DropdownMenuItem>
										<DropdownMenuSub>
											<DropdownMenuSubTrigger className="cursor-pointer">
												<Icon icon={FolderTree} size={13} />
												设置分组
											</DropdownMenuSubTrigger>
											<DropdownMenuSubContent className="w-48">
												{groups.map((group) => (
													<DropdownMenuItem
														key={`group-${group.id}`}
														className="cursor-pointer"
														onClick={() => {
															void onRunAction(() => onSetProfileGroup(item.id, group.name));
														}}
													>
														{group.name}
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="cursor-pointer"
													onClick={() => {
														void onRunAction(() => onSetProfileGroup(item.id));
													}}
												>
													清空分组
												</DropdownMenuItem>
											</DropdownMenuSubContent>
										</DropdownMenuSub>
										<DropdownMenuItem
											className="cursor-pointer"
											onClick={() => {
												onQuickEditChange({ profileId: item.id, field: 'toolbar' });
											}}
										>
											<Icon icon={Type} size={13} />
											修改工具栏文本
										</DropdownMenuItem>
										<DropdownMenuItem
											className="cursor-pointer"
											disabled={editConfigDisabled}
											onClick={() => {
												if (editConfigDisabled) {
													return;
												}
												onCreateClick(item.id);
											}}
										>
											<Icon icon={Wrench} size={13} />
											修改环境配置
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer text-destructive focus:text-destructive"
											disabled={actionPending}
											onClick={() => {
												void onRunAction(() => onDeleteProfile(item.id));
											}}
										>
											<Icon icon={Trash2} size={13} />
											删除环境
										</DropdownMenuItem>
										<p className="px-2 py-1 text-[11px] text-muted-foreground">背景色仅支持运行中修改</p>
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						) : (
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={actionPending}
								onClick={() => {
									void onRunAction(() => onRestoreProfile(item.id));
								}}
							>
								{actionState === 'restoring' ? (
									<Icon icon={Loader2} size={12} className="animate-spin" />
								) : (
									<Icon icon={RotateCcw} size={12} />
								)}
								{actionState === 'restoring' ? '恢复中' : '恢复'}
							</Button>
						)}
					</div>
				</TableCell>
			</TableRow>

			{isBgEditing ? (
				<TableRow className="bg-muted/15">
					<TableCell colSpan={7}>
						<div className="rounded-lg border border-border/70 bg-background/70 p-2">
							<p className="mb-2 text-xs text-muted-foreground">修改浏览器背景色</p>
							<BackgroundQuickEditForm
								initialColor={currentBg}
								disabled={actionPending}
								onCancel={() => onQuickEditChange(null)}
								onSubmit={async (color) => {
									await onRunAction(async () => {
										if (!item.running) {
											throw new Error('仅运行中的环境支持修改背景色');
										}
										await onUpdateProfileVisual(item.id, {
											browserBgColor: color,
										});
										onQuickEditChange(null);
									});
								}}
							/>
						</div>
					</TableCell>
				</TableRow>
			) : null}

			{isToolbarEditing ? (
				<TableRow className="bg-muted/15">
					<TableCell colSpan={7}>
						<div className="rounded-lg border border-border/70 bg-background/70 p-2">
							<p className="mb-2 text-xs text-muted-foreground">修改工具栏文本（留空将回退为环境名称）</p>
							<ToolbarQuickEditForm
								initialToolbarText={currentToolbarText}
								disabled={actionPending}
								onCancel={() => onQuickEditChange(null)}
								onSubmit={async (toolbarText) => {
									await onRunAction(async () => {
										await onUpdateProfileVisual(item.id, {
											toolbarText: toolbarText.trim() ? toolbarText.trim() : undefined,
										});
										onQuickEditChange(null);
									});
								}}
							/>
						</div>
					</TableCell>
				</TableRow>
			) : null}
		</>
	);
}
