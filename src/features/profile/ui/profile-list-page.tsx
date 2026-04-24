import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw } from 'lucide-react';

import {
	ConfirmActionDialog,
	DataSection,
	EmptyState,
} from '@/components/common';
import { Button, Icon } from '@/components/ui';
import { filterProfiles } from '@/entities/profile/lib/profile-list';
import type { ProxyItem } from '@/entities/proxy/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import { useProfileListStore } from '@/store/profile-list-store';
import type { ProfileListPageProps } from '../model/profile-list-types';
import { ProfileListStats } from './profile-list-stats';
import { ProfileListTable } from './profile-list-table';
import { ProfileListToolbar } from './profile-list-toolbar';

type ProfileBatchAction = 'refresh' | 'open' | 'close' | 'stopAll' | 'setGroup' | 'clearGroup' | 'retryOpen';

export function ProfileListPage({
	profiles,
	groups,
	proxies,
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
	onDuplicateProfile,
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
}: ProfileListPageProps) {
	const { t } = useTranslation('profile');
	const { t: tNav } = useTranslation('nav');
	const { t: tCommon } = useTranslation('common');
	const section = getWorkspaceSections().profiles;
	const [searchParams, setSearchParams] = useSearchParams();
	const [stopAllRunningDialogOpen, setStopAllRunningDialogOpen] =
		useState(false);
	const [batchAction, setBatchAction] = useState<ProfileBatchAction | null>(null);
	const batchActionRef = useRef<ProfileBatchAction | null>(null);
	const error = useProfileListStore((state) => state.error);
	const filters = useProfileListStore((state) => state.filters);
	const quickEdit = useProfileListStore((state) => state.quickEdit);
	const batchGroupTarget = useProfileListStore(
		(state) => state.batchGroupTarget,
	);
	const batchGroupDialogOpen = useProfileListStore(
		(state) => state.batchGroupDialogOpen,
	);
	const batchClearGroupDialogOpen = useProfileListStore(
		(state) => state.batchClearGroupDialogOpen,
	);
	const selectedProfileIds = useProfileListStore(
		(state) => state.selectedProfileIds,
	);
	const lastBatchOpenResult = useProfileListStore(
		(state) => state.lastBatchOpenResult,
	);
	const reset = useProfileListStore((state) => state.reset);
	const setError = useProfileListStore((state) => state.setError);
	const patchFilters = useProfileListStore((state) => state.patchFilters);
	const setQuickEdit = useProfileListStore((state) => state.setQuickEdit);
	const setBatchGroupTarget = useProfileListStore(
		(state) => state.setBatchGroupTarget,
	);
	const setBatchGroupDialogOpen = useProfileListStore(
		(state) => state.setBatchGroupDialogOpen,
	);
	const setBatchClearGroupDialogOpen = useProfileListStore(
		(state) => state.setBatchClearGroupDialogOpen,
	);
	const toggleProfile = useProfileListStore((state) => state.toggleProfile);
	const setSelectedProfiles = useProfileListStore(
		(state) => state.setSelectedProfiles,
	);
	const clearSelection = useProfileListStore((state) => state.clearSelection);
	const setBatchOpenResult = useProfileListStore(
		(state) => state.setBatchOpenResult,
	);

	const onErrorReset = useCallback(() => setError(null), [setError]);

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
		const nextGroup =
			patch.groupFilter && patch.groupFilter !== 'all' ? patch.groupFilter : '';
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
		return Array.from(new Set(values)).sort((a, b) =>
			a.localeCompare(b, 'zh-Hans-CN'),
		);
	}, [groups]);

	const filteredProfiles = useMemo(
		() => filterProfiles(profiles, filters),
		[profiles, filters],
	);
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
	const allFilteredSelected =
		filteredActiveIds.length > 0 &&
		selectedFilteredActiveIds.length === filteredActiveIds.length;
	const filteredSelectionIndeterminate =
		selectedFilteredActiveIds.length > 0 &&
		selectedFilteredActiveIds.length < filteredActiveIds.length;

	const activeCount = filteredProfiles.filter(
		(item) => item.lifecycle === 'active',
	).length;
	const runningCount = filteredProfiles.filter((item) => item.running).length;

	const runAction = useCallback(async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('errors.operationFailed'),
			);
		}
	}, [setError, t]);

	const runBatchAction = async <T,>(
		actionName: ProfileBatchAction,
		action: () => Promise<T>,
	) => {
		if (batchActionRef.current) {
			return null;
		}
		batchActionRef.current = actionName;
		setBatchAction(actionName);
		setError(null);
		try {
			return await action();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('errors.operationFailed'),
			);
			return null;
		} finally {
			batchActionRef.current = null;
			setBatchAction(null);
		}
	};

	const isEmpty = filteredProfiles.length === 0;
	const emptyText =
		profiles.length === 0 ? t('list.emptyNoProfiles') : t('list.emptyNoMatch');

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label={tNav('labels.profile')}
				title={section.title}
				description={section.desc}
			/>

			<ProfileListStats
				filteredCount={filteredProfiles.length}
				totalCount={profiles.length}
				activeCount={activeCount}
				runningCount={runningCount}
			/>

			<DataSection
				title={t('list.title')}
				actions={
					<>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer"
							disabled={Boolean(batchAction)}
							onClick={() => {
								void runBatchAction('refresh', async () => {
									await onRefreshProfiles();
								});
							}}
						>
							<Icon icon={RefreshCw} size={12} />
							{tCommon('refresh')}
						</Button>
						<Button
							type="button"
							size="sm"
							className="cursor-pointer"
							onClick={onCreateClick}
						>
							<Icon icon={Plus} size={14} />
							{tCommon('createItem', { item: tCommon('profile') })}
						</Button>
					</>
				}
				contentClassName="p-1 pt-0"
				className="flex-1 min-h-0 overflow-hidden flex flex-col"
			>
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
					busyAction={batchAction}
					lastBatchOpenResult={lastBatchOpenResult}
					profiles={profiles}
					onChange={handleFilterChange}
					onOpenBatchGroupDialog={() => {
						if (!batchGroupTarget && groupOptions[0]) {
							setBatchGroupTarget(groupOptions[0]);
						}
						setBatchGroupDialogOpen(true);
					}}
					onOpenBatchClearDialog={() => setBatchClearGroupDialogOpen(true)}
					onBatchOpen={() => {
						void runBatchAction('open', async () => {
							const result = await onBatchOpenProfiles(selectedStoppedIds);
							setBatchOpenResult(result.failedCount > 0 ? result : null);
							clearSelection();
						});
					}}
					onBatchClose={() => {
						void runBatchAction('close', async () => {
							await onBatchCloseProfiles(selectedRunningIds);
							setBatchOpenResult(null);
							clearSelection();
						});
					}}
					onStopAllRunning={() => setStopAllRunningDialogOpen(true)}
					onBatchGroupDialogOpenChange={setBatchGroupDialogOpen}
					onBatchClearDialogOpenChange={setBatchClearGroupDialogOpen}
					onBatchGroupTargetChange={setBatchGroupTarget}
					onConfirmBatchGroup={() => {
						void runBatchAction('setGroup', async () => {
							await onBatchSetProfileGroup(
								selectedFilteredActiveIds,
								batchGroupTarget,
							);
							setBatchGroupDialogOpen(false);
							setBatchGroupTarget('');
							clearSelection();
						});
					}}
					onConfirmBatchClearGroup={() => {
						void runBatchAction('clearGroup', async () => {
							await onBatchSetProfileGroup(selectedFilteredActiveIds);
							setBatchClearGroupDialogOpen(false);
							setBatchGroupTarget('');
							clearSelection();
						});
					}}
					onRetryFailed={(failedProfileIds) => {
						void runBatchAction('retryOpen', async () => {
							const result = await onBatchOpenProfiles(failedProfileIds);
							setBatchOpenResult(result.failedCount > 0 ? result : null);
						});
					}}
					onCloseBatchResult={() => setBatchOpenResult(null)}
				/>
				<ConfirmActionDialog
					open={stopAllRunningDialogOpen}
					title={t('list.stopAllConfirmTitle')}
					description={t('list.stopAllConfirmDesc', {
						count: filteredRunningIds.length,
					})}
					confirmText={batchAction === 'stopAll' ? t('list.stopping') : t('list.confirmStop')}
					pending={batchAction === 'stopAll'}
					onOpenChange={setStopAllRunningDialogOpen}
					onConfirm={() => {
						void runBatchAction('stopAll', async () => {
							await onBatchCloseProfiles(filteredRunningIds);
							setBatchOpenResult(null);
							setStopAllRunningDialogOpen(false);
						});
					}}
				/>

				{isEmpty ? (
					<EmptyState title={emptyText} />
				) : (
					<ProfileListTable
						profiles={filteredProfiles}
						groups={groups}
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
						onDuplicateProfile={onDuplicateProfile}
						onDeleteProfile={onDeleteProfile}
						onRestoreProfile={onRestoreProfile}
						onReadProfileCookies={onReadProfileCookies}
						onExportProfileCookies={onExportProfileCookies}
						onRefreshProfiles={onRefreshProfiles}
						onRunAction={runAction}
						onErrorReset={onErrorReset}
					/>
				)}
				{error ? (
					<p className="mt-2 px-1 text-xs text-destructive">{error}</p>
				) : null}
			</DataSection>
		</div>
	);
}
