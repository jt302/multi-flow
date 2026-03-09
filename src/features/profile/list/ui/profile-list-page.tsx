import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Card, Checkbox } from '@/components/ui';
import { filterProfiles } from '@/entities/profile/lib/profile-list';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import { useProfileListStore } from '../model/profile-list-store';
import type { ProfileListPageProps } from '../model/types';
import { ProfileBatchOpenResultCard } from './profile-batch-open-result-card';
import { ProfileBatchClearGroupDialog } from './profile-batch-clear-group-dialog';
import { ProfileBatchGroupDialog } from './profile-batch-group-dialog';
import { ProfileListFilters } from './profile-list-filters';
import { ProfileListItem } from './profile-list-item';
import { ProfileListStats } from './profile-list-stats';

export function ProfileListPage({
	profiles,
	groups,
	proxies,
	resources,
	profileProxyBindings,
	profileActionStates,
	onCreateClick,
	onViewProfile,
	onEditProfile,
	onUpdateProfileVisual,
	onOpenProfile,
	onCloseProfile,
	onSetProfileGroup,
	onFocusProfileWindow,
	onBatchOpenProfiles,
	onBatchCloseProfiles,
	onBatchSetProfileGroup,
	onDeleteProfile,
	onRestoreProfile,
	onRefreshProfiles,
}: ProfileListPageProps) {
	const section = CONSOLE_NAV_SECTIONS.profiles;
	const [searchParams, setSearchParams] = useSearchParams();
	const error = useProfileListStore((state) => state.error);
	const filters = useProfileListStore((state) => state.filters);
	const quickEdit = useProfileListStore((state) => state.quickEdit);
	const batchGroupTarget = useProfileListStore((state) => state.batchGroupTarget);
	const batchGroupDialogOpen = useProfileListStore((state) => state.batchGroupDialogOpen);
	const batchClearGroupDialogOpen = useProfileListStore((state) => state.batchClearGroupDialogOpen);
	const selectedProfileIds = useProfileListStore((state) => state.selectedProfileIds);
	const lastBatchOpenResult = useProfileListStore((state) => state.lastBatchOpenResult);
	const reset = useProfileListStore((state) => state.reset);
	const setError = useProfileListStore((state) => state.setError);
	const patchFilters = useProfileListStore((state) => state.patchFilters);
	const setQuickEdit = useProfileListStore((state) => state.setQuickEdit);
	const setBatchGroupTarget = useProfileListStore((state) => state.setBatchGroupTarget);
	const setBatchGroupDialogOpen = useProfileListStore((state) => state.setBatchGroupDialogOpen);
	const setBatchClearGroupDialogOpen = useProfileListStore((state) => state.setBatchClearGroupDialogOpen);
	const toggleProfile = useProfileListStore((state) => state.toggleProfile);
	const setSelectedProfiles = useProfileListStore((state) => state.setSelectedProfiles);
	const clearSelection = useProfileListStore((state) => state.clearSelection);
	const setBatchOpenResult = useProfileListStore((state) => state.setBatchOpenResult);

	useEffect(() => {
		reset();
	}, [reset]);

	const groupFilterFromQuery = searchParams.get('group')?.trim() || '';

	useEffect(() => {
		patchFilters({ groupFilter: groupFilterFromQuery || 'all' });
	}, [groupFilterFromQuery, patchFilters]);

	const handleFilterChange = (patch: Parameters<typeof patchFilters>[0]) => {
		patchFilters(patch);
		if (!Object.prototype.hasOwnProperty.call(patch, 'groupFilter')) {
			return;
		}
		const next = new URLSearchParams(searchParams);
		const nextGroup = patch.groupFilter && patch.groupFilter !== 'all' ? patch.groupFilter : '';
		if (nextGroup) {
			next.set('group', nextGroup);
		} else {
			next.delete('group');
		}
		setSearchParams(next, { replace: true });
	};

	const proxyById = useMemo(() => {
		return proxies.reduce<Record<string, ProxyItem>>((acc, item: ProxyItem) => {
			acc[item.id] = item;
			return acc;
		}, {});
	}, [proxies]);

	const groupOptions = useMemo(() => {
		const values = groups.map((item) => item.name.trim()).filter(Boolean);
		return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
	}, [groups]);

	const filteredProfiles = useMemo(() => filterProfiles(profiles, filters), [profiles, filters]);
	const filteredActiveIds = useMemo(
		() => filteredProfiles.filter((item) => item.lifecycle === 'active').map((item) => item.id),
		[filteredProfiles],
	);
	const filteredStoppedIds = useMemo(
		() => filteredProfiles.filter((item) => item.lifecycle === 'active' && !item.running).map((item) => item.id),
		[filteredProfiles],
	);
	const filteredRunningIds = useMemo(
		() => filteredProfiles.filter((item) => item.lifecycle === 'active' && item.running).map((item) => item.id),
		[filteredProfiles],
	);
	const selectedStoppedIds = useMemo(() => {
		const allowed = new Set(filteredStoppedIds);
		return selectedProfileIds.filter((id) => allowed.has(id));
	}, [filteredStoppedIds, selectedProfileIds]);
	const selectedRunningIds = useMemo(() => {
		const allowed = new Set(filteredRunningIds);
		return selectedProfileIds.filter((id) => allowed.has(id));
	}, [filteredRunningIds, selectedProfileIds]);
	const selectedFilteredActiveIds = useMemo(() => {
		const allowed = new Set(filteredActiveIds);
		return selectedProfileIds.filter((id) => allowed.has(id));
	}, [filteredActiveIds, selectedProfileIds]);
	const allFilteredSelected =
		filteredActiveIds.length > 0 && selectedFilteredActiveIds.length === filteredActiveIds.length;
	const filteredSelectionIndeterminate =
		selectedFilteredActiveIds.length > 0 && selectedFilteredActiveIds.length < filteredActiveIds.length;

	const activeCount = filteredProfiles.filter((item) => item.lifecycle === 'active').length;
	const runningCount = filteredProfiles.filter((item) => item.running).length;

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : '环境操作失败');
		}
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="环境" title={section.title} description={section.desc} />

			<ProfileListStats
				filteredCount={filteredProfiles.length}
				totalCount={profiles.length}
				activeCount={activeCount}
				runningCount={runningCount}
			/>

			<Card className="p-3">
				<ProfileListFilters
					keyword={filters.keyword}
					groupFilter={filters.groupFilter}
					runningFilter={filters.runningFilter}
					lifecycleFilter={filters.lifecycleFilter}
					groupOptions={groupOptions}
					selectedCount={selectedFilteredActiveIds.length}
					selectableCount={filteredActiveIds.length}
					stoppedSelectedCount={selectedStoppedIds.length}
					runningSelectedCount={selectedRunningIds.length}
					onChange={handleFilterChange}
					onOpenBatchGroupDialog={() => {
						if (!batchGroupTarget && groupOptions[0]) {
							setBatchGroupTarget(groupOptions[0]);
						}
						setBatchGroupDialogOpen(true);
					}}
					onOpenBatchClearDialog={() => setBatchClearGroupDialogOpen(true)}
					onBatchOpen={() => {
						void runAction(async () => {
							const result = await onBatchOpenProfiles(selectedStoppedIds);
							setBatchOpenResult(result.failedCount > 0 ? result : null);
							clearSelection();
						});
					}}
					onBatchClose={() => {
						void runAction(async () => {
							await onBatchCloseProfiles(selectedRunningIds);
							setBatchOpenResult(null);
							clearSelection();
						});
					}}
					onRefresh={() => {
						void (async () => {
							setError(null);
							try {
								await onRefreshProfiles();
							} catch (err) {
								setError(err instanceof Error ? err.message : '刷新环境失败');
							}
						})();
					}}
					onCreateClick={onCreateClick}
				/>

				<ProfileBatchGroupDialog
					open={batchGroupDialogOpen}
					groupOptions={groupOptions}
					selectedCount={selectedFilteredActiveIds.length}
					value={batchGroupTarget}
					onOpenChange={setBatchGroupDialogOpen}
					onValueChange={setBatchGroupTarget}
					onConfirm={() => {
							void runAction(async () => {
								await onBatchSetProfileGroup(selectedFilteredActiveIds, batchGroupTarget);
								setBatchGroupDialogOpen(false);
								setBatchGroupTarget('');
								clearSelection();
							});
					}}
				/>

				<ProfileBatchClearGroupDialog
					open={batchClearGroupDialogOpen}
					selectedCount={selectedFilteredActiveIds.length}
					onOpenChange={setBatchClearGroupDialogOpen}
					onConfirm={() => {
							void runAction(async () => {
								await onBatchSetProfileGroup(selectedFilteredActiveIds);
								setBatchClearGroupDialogOpen(false);
								setBatchGroupTarget('');
								clearSelection();
							});
					}}
				/>

				{lastBatchOpenResult?.failedCount ? (
					<ProfileBatchOpenResultCard
						result={lastBatchOpenResult}
						profiles={profiles}
						onRetryFailed={(failedProfileIds) => {
							void runAction(async () => {
								const result = await onBatchOpenProfiles(failedProfileIds);
								setBatchOpenResult(result.failedCount > 0 ? result : null);
							});
						}}
						onClose={() => setBatchOpenResult(null)}
					/>
				) : null}

				<div className="overflow-hidden rounded-xl border border-border/70">
					{filteredProfiles.length === 0 ? (
						<div className="px-4 py-10 text-center text-sm text-muted-foreground">
							{profiles.length === 0 ? '暂无环境，先创建一个环境。' : '没有匹配当前筛选条件的环境。'}
						</div>
					) : (
						<>
							<div className="grid grid-cols-[64px_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_80px_120px_96px] items-center gap-3 border-b border-border/70 bg-muted/15 px-3 py-2 text-xs font-medium text-muted-foreground">
								<div className="flex items-center justify-center gap-2">
									<Checkbox
										checked={filteredSelectionIndeterminate ? 'indeterminate' : allFilteredSelected}
										disabled={filteredActiveIds.length === 0}
										className="cursor-pointer"
										onCheckedChange={(checked) => {
											if (checked === true) {
												setSelectedProfiles(filteredActiveIds);
												return;
											}
											clearSelection();
										}}
									/>
									<span className="h-9 w-9 shrink-0" aria-hidden="true" />
								</div>
								<div>环境</div>
								<div>备注 / 版本</div>
								<div>设备 / 代理</div>
								<div>生命周期</div>
								<div>运行状态</div>
								<div className="text-right">操作</div>
							</div>
							{filteredProfiles.map((item, index) => {
								const boundProxyId = profileProxyBindings[item.id];
								const boundProxy = boundProxyId ? proxyById[boundProxyId] : undefined;
								return (
									<ProfileListItem
										key={item.id}
										item={item}
										groups={groups}
										resources={resources}
										index={index}
										total={filteredProfiles.length}
										selected={selectedProfileIds.includes(item.id)}
										onSelectedChange={(checked) => toggleProfile(item.id, checked)}
										actionState={profileActionStates[item.id]}
										boundProxy={boundProxy}
										quickEdit={quickEdit}
										onQuickEditChange={(value) => {
											setQuickEdit(value);
											setError(null);
										}}
										onRunAction={runAction}
										onViewProfile={onViewProfile}
										onCreateClick={onEditProfile}
										onUpdateProfileVisual={onUpdateProfileVisual}
										onOpenProfile={onOpenProfile}
										onCloseProfile={onCloseProfile}
										onSetProfileGroup={onSetProfileGroup}
										onFocusProfileWindow={onFocusProfileWindow}
										onDeleteProfile={onDeleteProfile}
										onRestoreProfile={onRestoreProfile}
									/>
								);
							})}
						</>
					)}
				</div>
				{error ? <p className="mt-2 px-1 text-xs text-destructive">{error}</p> : null}
			</Card>
		</div>
	);
}
