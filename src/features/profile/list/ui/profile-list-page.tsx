import { useEffect, useMemo } from 'react';

import { Card } from '@/components/ui';
import { filterProfiles } from '@/entities/profile/lib/profile-list';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { useProfileListStore } from '../model/profile-list-store';
import { ProfileBatchOpenResultCard } from './profile-batch-open-result-card';
import { ProfileListFilters } from './profile-list-filters';
import { ProfileListItem } from './profile-list-item';
import { ProfileListStats } from './profile-list-stats';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { ProxyItem } from '@/entities/proxy/model/types';

import type { ProfileListPageProps } from '../model/types';

export function ProfileListPage({
	profiles,
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
	onFocusProfileWindow,
	onBatchOpenProfiles,
	onBatchCloseProfiles,
	onDeleteProfile,
	onRestoreProfile,
	onRefreshProfiles,
}: ProfileListPageProps) {
	const section = CONSOLE_NAV_SECTIONS.profiles;
	const error = useProfileListStore((state) => state.error);
	const filters = useProfileListStore((state) => state.filters);
	const quickEdit = useProfileListStore((state) => state.quickEdit);
	const selectedProfileIds = useProfileListStore((state) => state.selectedProfileIds);
	const lastBatchOpenResult = useProfileListStore((state) => state.lastBatchOpenResult);
	const reset = useProfileListStore((state) => state.reset);
	const setError = useProfileListStore((state) => state.setError);
	const patchFilters = useProfileListStore((state) => state.patchFilters);
	const setQuickEdit = useProfileListStore((state) => state.setQuickEdit);
	const toggleProfile = useProfileListStore((state) => state.toggleProfile);
	const setSelectedProfiles = useProfileListStore((state) => state.setSelectedProfiles);
	const clearSelection = useProfileListStore((state) => state.clearSelection);
	const setBatchOpenResult = useProfileListStore((state) => state.setBatchOpenResult);

	useEffect(() => {
		reset();
	}, [reset]);

	const proxyById = useMemo(() => {
		return proxies.reduce<Record<string, ProxyItem>>((acc, item: ProxyItem) => {
			acc[item.id] = item;
			return acc;
		}, {});
	}, [proxies]);

	const groupOptions = useMemo(() => {
		const values = profiles.map((item) => item.group.trim()).filter(Boolean);
		return Array.from(new Set(values)).sort((a, b) =>
			a.localeCompare(b, 'zh-Hans-CN'),
		);
	}, [profiles]);

	const filteredProfiles = useMemo(() => {
		return filterProfiles(profiles, filters);
	}, [profiles, filters]);
	const filteredActiveIds = useMemo(
		() =>
			filteredProfiles
				.filter((item) => item.lifecycle === 'active')
				.map((item) => item.id),
		[filteredProfiles],
	);
	const filteredStoppedIds = useMemo(
		() =>
			filteredProfiles
				.filter((item) => item.lifecycle === 'active' && !item.running)
				.map((item) => item.id),
		[filteredProfiles],
	);
	const filteredRunningIds = useMemo(
		() =>
			filteredProfiles
				.filter((item) => item.lifecycle === 'active' && item.running)
				.map((item) => item.id),
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

	const handleSelectProfile = (profileId: string, checked: boolean) => {
		toggleProfile(profileId, checked);
	};

	const handleSelectAllFiltered = () => {
		setSelectedProfiles(filteredActiveIds);
	};

	const handleClearSelection = () => {
		clearSelection();
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard
				label="环境"
				title={section.title}
				description={section.desc}
			/>

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
					onChange={patchFilters}
					onSelectAll={handleSelectAllFiltered}
					onClearSelection={handleClearSelection}
					onBatchOpen={() => {
						void runAction(async () => {
								const result = await onBatchOpenProfiles(selectedStoppedIds);
								setBatchOpenResult(result.failedCount > 0 ? result : null);
								handleClearSelection();
							});
					}}
					onBatchClose={() => {
						void runAction(async () => {
								await onBatchCloseProfiles(selectedRunningIds);
								setBatchOpenResult(null);
								handleClearSelection();
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
							{profiles.length === 0
								? '暂无环境，先创建一个环境。'
								: '没有匹配当前筛选条件的环境。'}
						</div>
					) : (
						filteredProfiles.map((item, index) => {
							const boundProxyId = profileProxyBindings[item.id];
							const boundProxy = boundProxyId
								? proxyById[boundProxyId]
								: undefined;
							return (
								<ProfileListItem
									key={item.id}
									item={item}
									resources={resources}
									index={index}
									total={filteredProfiles.length}
									selected={selectedProfileIds.includes(item.id)}
									onSelectedChange={(checked) =>
										handleSelectProfile(item.id, checked)
									}
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
									onFocusProfileWindow={onFocusProfileWindow}
									onDeleteProfile={onDeleteProfile}
									onRestoreProfile={onRestoreProfile}
								/>
							);
						})
					)}
				</div>
				{error ? (
					<p className="mt-2 px-1 text-xs text-destructive">{error}</p>
				) : null}
			</Card>
		</div>
	);
}
