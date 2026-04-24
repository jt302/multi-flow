import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import type { ProfileItem } from '@/entities/profile/model/types';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { cn } from '@/lib/utils';

export type ProfileGroupSelectorProps = {
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	mode?: 'single' | 'multi';
	className?: string;
	disabled?: boolean;
	filterRunning?: boolean;
	profiles?: ProfileItem[];
};

export function ProfileGroupSelector({
	selectedIds,
	onChange,
	mode = 'multi',
	className,
	disabled = false,
	filterRunning = false,
	profiles,
}: ProfileGroupSelectorProps) {
	const { t } = useTranslation('common');
	const [search, setSearch] = useState('');
	const [activeTab, setActiveTab] = useState<'profiles' | 'groups'>('profiles');

	const profilesQuery = useProfilesQuery({ enabled: profiles == null });
	const groupsQuery = useGroupsQuery();

	const allProfiles = useMemo(() => {
		const list = profiles ?? profilesQuery.data ?? [];
		if (filterRunning) return list.filter((p) => p.running);
		return list;
	}, [profiles, profilesQuery.data, filterRunning]);

	const allGroups = useMemo(() => {
		return (groupsQuery.data ?? []).filter((g) => g.lifecycle === 'active');
	}, [groupsQuery.data]);

	const lowerSearch = search.toLowerCase();

	// 按搜索词过滤环境
	const filteredProfiles = useMemo(
		() =>
			allProfiles.filter(
				(p) =>
					p.lifecycle === 'active' &&
					(p.name.toLowerCase().includes(lowerSearch) ||
						p.group.toLowerCase().includes(lowerSearch)),
			),
		[allProfiles, lowerSearch],
	);

	// 按搜索词过滤分组
	const filteredGroups = useMemo(
		() => allGroups.filter((g) => g.name.toLowerCase().includes(lowerSearch)),
		[allGroups, lowerSearch],
	);

	// 分组下的环境 ID 映射
	const groupProfileMap = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const g of allGroups) {
			const ids = allProfiles
				.filter((p) => p.group === g.name && p.lifecycle === 'active')
				.map((p) => p.id);
			map.set(g.name, ids);
		}
		return map;
	}, [allProfiles, allGroups]);

	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

	// 切换单个环境的选中状态
	const toggleProfile = useCallback(
		(id: string) => {
			if (disabled) return;
			if (mode === 'single') {
				onChange(selectedSet.has(id) ? [] : [id]);
				return;
			}
			onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
		},
		[disabled, mode, selectedSet, selectedIds, onChange],
	);

	// 切换分组：选中时添加所有该组环境 ID，取消时移除
	const toggleGroup = useCallback(
		(groupName: string) => {
			if (disabled) return;
			const groupIds = groupProfileMap.get(groupName) ?? [];
			if (groupIds.length === 0) return;
			const allSelected = groupIds.every((id) => selectedSet.has(id));
			if (allSelected) {
				// 取消该组全部
				const removeSet = new Set(groupIds);
				onChange(selectedIds.filter((id) => !removeSet.has(id)));
			} else {
				// 选中该组缺少的
				const newIds = [...selectedIds];
				for (const id of groupIds) {
					if (!selectedSet.has(id)) newIds.push(id);
				}
				onChange(newIds);
			}
		},
		[disabled, groupProfileMap, selectedSet, selectedIds, onChange],
	);

	// 全选 / 取消全选（仅当前 tab 中可见的项目）
	const toggleAllProfiles = useCallback(() => {
		if (disabled) return;
		const visibleIds = filteredProfiles.map((p) => p.id);
		const allSelected = visibleIds.every((id) => selectedSet.has(id));
		if (allSelected) {
			const removeSet = new Set(visibleIds);
			onChange(selectedIds.filter((id) => !removeSet.has(id)));
		} else {
			const newIds = [...selectedIds];
			for (const id of visibleIds) {
				if (!selectedSet.has(id)) newIds.push(id);
			}
			onChange(newIds);
		}
	}, [disabled, filteredProfiles, selectedSet, selectedIds, onChange]);

	// 计算分组的选中状态
	const getGroupCheckedState = useCallback(
		(groupName: string): boolean | 'indeterminate' => {
			const groupIds = groupProfileMap.get(groupName) ?? [];
			if (groupIds.length === 0) return false;
			const selectedCount = groupIds.filter((id) => selectedSet.has(id)).length;
			if (selectedCount === 0) return false;
			if (selectedCount === groupIds.length) return true;
			return 'indeterminate';
		},
		[groupProfileMap, selectedSet],
	);

	const allProfilesSelected =
		filteredProfiles.length > 0 && filteredProfiles.every((p) => selectedSet.has(p.id));

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			{/* 搜索框 */}
			<div className="relative">
				<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('profileGroupSelector.search')}
					className="h-8 pl-8 text-xs"
					disabled={disabled}
				/>
			</div>

			<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profiles' | 'groups')}>
				<TabsList className="grid w-full grid-cols-2 h-8">
					<TabsTrigger value="profiles" className="text-xs cursor-pointer">
						{t('profileGroupSelector.profiles')}
					</TabsTrigger>
					<TabsTrigger value="groups" className="text-xs cursor-pointer">
						{t('profileGroupSelector.groups')}
					</TabsTrigger>
				</TabsList>

				{/* 环境列表 */}
				<TabsContent value="profiles" className="mt-2">
					{mode === 'multi' && filteredProfiles.length > 0 && (
						<button
							type="button"
							onClick={toggleAllProfiles}
							disabled={disabled}
							className="mb-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
						>
							{allProfilesSelected
								? t('profileGroupSelector.deselectAll')
								: t('profileGroupSelector.selectAll')}
						</button>
					)}
					<ScrollArea className="max-h-52">
						{filteredProfiles.length === 0 ? (
							<p className="py-4 text-center text-xs text-muted-foreground">
								{t('profileGroupSelector.noProfiles')}
							</p>
						) : (
							<div className="space-y-0.5 pr-1">
								{filteredProfiles.map((p) => (
									<label
										key={p.id}
										className={cn(
											'flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer',
											disabled && 'opacity-50 pointer-events-none',
										)}
									>
										<Checkbox
											checked={selectedSet.has(p.id)}
											onCheckedChange={() => toggleProfile(p.id)}
											disabled={disabled}
											className="cursor-pointer"
										/>
										<span className="text-xs truncate flex-1">{p.name}</span>
										{p.group && (
											<span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
												{p.group}
											</span>
										)}
										{p.running && (
											<span className="inline-block size-1.5 rounded-full bg-green-500 shrink-0" />
										)}
									</label>
								))}
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				{/* 分组列表 */}
				<TabsContent value="groups" className="mt-2">
					<ScrollArea className="max-h-52">
						{filteredGroups.length === 0 ? (
							<p className="py-4 text-center text-xs text-muted-foreground">
								{t('profileGroupSelector.noGroups')}
							</p>
						) : (
							<div className="space-y-0.5 pr-1">
								{filteredGroups.map((g) => {
									const state = getGroupCheckedState(g.name);
									const count = groupProfileMap.get(g.name)?.length ?? 0;
									return (
										<label
											key={g.id}
											className={cn(
												'flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer',
												disabled && 'opacity-50 pointer-events-none',
											)}
										>
											<Checkbox
												checked={state === 'indeterminate' ? 'indeterminate' : state}
												onCheckedChange={() => toggleGroup(g.name)}
												disabled={disabled}
												className="cursor-pointer"
											/>
											<span className="text-xs truncate flex-1">{g.name}</span>
											<Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
												{count}
											</Badge>
										</label>
									);
								})}
							</div>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>

			{/* 已选数量 */}
			<div className="text-xs text-muted-foreground px-1">
				{t('profileGroupSelector.selected', { count: selectedIds.length })}
			</div>
		</div>
	);
}
