import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ConfirmActionDialog, DataSection, EmptyState } from '@/components/common';
import { filterProfiles } from '@/entities/profile/lib/profile-list';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
import { useProfileListStore } from '@/store/profile-list-store';
import type { ProfileListPageProps } from '../model/profile-list-types';
import { ProfileListStats } from './profile-list-stats';
import { ProfileListTable } from './profile-list-table';
import { ProfileListToolbar } from './profile-list-toolbar';

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
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
}: ProfileListPageProps) {
	const section = WORKSPACE_SECTIONS.profiles;
	const [searchParams, setSearchParams] = useSearchParams();
	const [stopAllRunningDialogOpen, setStopAllRunningDialogOpen] = useState(false);
	const [stopAllRunningPending, setStopAllRunningPending] = useState(false);
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

	const isEmpty = filteredProfiles.length === 0;
	const emptyText = profiles.length === 0 ? '暂无环境，先创建一个环境。' : '没有匹配当前筛选条件的环境。';

	return (
		<div className="flex flex-col gap-3">
			<ActiveSectionCard label="环境" title={section.title} description={section.desc} />

			<ProfileListStats
				filteredCount={filteredProfiles.length}
				totalCount={profiles.length}
				activeCount={activeCount}
				runningCount={runningCount}
			/>

			<DataSection title="环境列表" contentClassName="p-1 pt-0">
				<ProfileListToolbar
					keyword={filters.keyword}
					groupFilter={filters.groupFilter}
					runningFilter={filters.runningFilter}
					lifecycleFilter={filters.lifecycleFilter}
					groupOptions={groupOptions}
					selectedCount={selectedFilteredActiveIds.length}
					selectableCount={filteredActiveIds.length}
					stoppedSelectedCount={selectedStoppedIds.length}
					runningSelectedCount={selectedRunningIds.length}
					stopAllRunningCount={filteredRunningIds.length}
					batchGroupDialogOpen={batchGroupDialogOpen}
					batchClearGroupDialogOpen={batchClearGroupDialogOpen}
					batchGroupTarget={batchGroupTarget}
					stopAllRunningPending={stopAllRunningPending}
					lastBatchOpenResult={lastBatchOpenResult}
					profiles={profiles}
					onChange={handleFilterChange}
					onCreateClick={onCreateClick}
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
					onStopAllRunning={() => setStopAllRunningDialogOpen(true)}
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
					onBatchGroupDialogOpenChange={setBatchGroupDialogOpen}
					onBatchClearDialogOpenChange={setBatchClearGroupDialogOpen}
					onBatchGroupTargetChange={setBatchGroupTarget}
					onConfirmBatchGroup={() => {
						void runAction(async () => {
							await onBatchSetProfileGroup(selectedFilteredActiveIds, batchGroupTarget);
							setBatchGroupDialogOpen(false);
							setBatchGroupTarget('');
							clearSelection();
						});
					}}
					onConfirmBatchClearGroup={() => {
						void runAction(async () => {
							await onBatchSetProfileGroup(selectedFilteredActiveIds);
							setBatchClearGroupDialogOpen(false);
							setBatchGroupTarget('');
							clearSelection();
						});
					}}
					onRetryFailed={(failedProfileIds) => {
						void runAction(async () => {
							const result = await onBatchOpenProfiles(failedProfileIds);
							setBatchOpenResult(result.failedCount > 0 ? result : null);
						});
					}}
					onCloseBatchResult={() => setBatchOpenResult(null)}
				/>
				<ConfirmActionDialog
					open={stopAllRunningDialogOpen}
					title="确认一键停止运行中环境"
					description={`确认停止当前筛选结果中的 ${filteredRunningIds.length} 个运行中环境？`}
					confirmText={stopAllRunningPending ? '停止中...' : '确认停止'}
					pending={stopAllRunningPending}
					onOpenChange={setStopAllRunningDialogOpen}
					onConfirm={() => {
						void (async () => {
							setStopAllRunningPending(true);
							try {
								await runAction(async () => {
									await onBatchCloseProfiles(filteredRunningIds);
									setBatchOpenResult(null);
								});
								setStopAllRunningDialogOpen(false);
							} finally {
								setStopAllRunningPending(false);
							}
						})();
					}}
				/>

				{isEmpty ? (
					<EmptyState title={emptyText} />
				) : (
					<ProfileListTable
						profiles={filteredProfiles}
						groups={groups}
						resources={resources}
						profileActionStates={profileActionStates}
						profileProxyBindings={profileProxyBindings}
						proxyById={proxyById}
						selectedProfileIds={selectedProfileIds}
						filteredActiveIds={filteredActiveIds}
						filteredSelectionIndeterminate={filteredSelectionIndeterminate}
						allFilteredSelected={allFilteredSelected}
						quickEdit={quickEdit}
						onSetSelectedProfiles={setSelectedProfiles}
						onClearSelection={clearSelection}
						onToggleProfile={toggleProfile}
						onQuickEditChange={setQuickEdit}
						onViewProfile={onViewProfile}
						onEditProfile={onEditProfile}
						onUpdateProfileVisual={onUpdateProfileVisual}
						onOpenProfile={onOpenProfile}
						onCloseProfile={onCloseProfile}
						onSetProfileGroup={onSetProfileGroup}
						onFocusProfileWindow={onFocusProfileWindow}
						onDeleteProfile={onDeleteProfile}
						onRestoreProfile={onRestoreProfile}
						onReadProfileCookies={onReadProfileCookies}
						onExportProfileCookies={onExportProfileCookies}
						onRefreshProfiles={onRefreshProfiles}
						onRunAction={runAction}
						onErrorReset={() => setError(null)}
					/>
				)}
				{error ? <p className="mt-2 px-1 text-xs text-destructive">{error}</p> : null}
			</DataSection>
		</div>
	);
}
