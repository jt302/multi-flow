import { useMemo, useState } from 'react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

import { ActiveSectionCard, ProfileListFilters, ProfileListItem } from '../components';
import { NAV_SECTIONS } from '../constants';
import type {
	BatchProfileActionResponse,
	ProfileActionState,
	ProfileItem,
	ProfileProxyBindingMap,
	ProxyItem,
	ResourceItem,
} from '../types';
import type { ProfileListFiltersState } from '../utils';
import { filterProfiles } from '../utils';

type ProfileListPageProps = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	profileActionStates: Record<string, ProfileActionState>;
	onCreateClick: () => void;
	onViewProfile: (profileId: string) => void;
	onEditProfile: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onBatchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onRefreshProfiles: () => Promise<void>;
};

type QuickEditField = 'background' | 'toolbar';

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
	onBatchOpenProfiles,
	onBatchCloseProfiles,
	onDeleteProfile,
	onRestoreProfile,
	onRefreshProfiles,
}: ProfileListPageProps) {
	const section = NAV_SECTIONS.profiles;
	const [error, setError] = useState<string | null>(null);
	const [filters, setFilters] = useState<ProfileListFiltersState>({
		keyword: '',
		groupFilter: 'all',
		runningFilter: 'all',
		lifecycleFilter: 'active',
	});
	const [quickEdit, setQuickEdit] = useState<{
		profileId: string;
		field: QuickEditField;
	} | null>(null);
	const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
	const [lastBatchOpenResult, setLastBatchOpenResult] = useState<BatchProfileActionResponse | null>(
		null,
	);

	const proxyById = useMemo(() => {
		return proxies.reduce<Record<string, ProxyItem>>((acc, item) => {
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

	const activeCount = useMemo(
		() => filteredProfiles.filter((item) => item.lifecycle === 'active').length,
		[filteredProfiles],
	);
	const runningCount = useMemo(
		() => filteredProfiles.filter((item) => item.running).length,
		[filteredProfiles],
	);

	const runAction = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : '环境操作失败');
		}
	};

	const handleSelectProfile = (profileId: string, checked: boolean) => {
		setSelectedProfileIds((prev) => {
			if (checked) {
				if (prev.includes(profileId)) {
					return prev;
				}
				return [...prev, profileId];
			}
			return prev.filter((id) => id !== profileId);
		});
	};

	const handleSelectAllFiltered = () => {
		setSelectedProfileIds(filteredActiveIds);
	};

	const handleClearSelection = () => {
		setSelectedProfileIds([]);
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard
				label="环境"
				title={section.title}
				description={section.desc}
			/>

			<div className="grid gap-3 md:grid-cols-3">
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">
							环境总数
						</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{filteredProfiles.length}</p>
						<p className="text-xs text-muted-foreground">
							总计 {profiles.length}
						</p>
					</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">
							活跃环境
						</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{activeCount}</p>
					</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="px-1 pb-1">
						<CardTitle className="text-xs text-muted-foreground">
							运行中
						</CardTitle>
					</CardHeader>
					<CardContent className="px-1 pt-0">
						<p className="text-2xl font-semibold">{runningCount}</p>
					</CardContent>
				</Card>
			</div>

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
					onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
					onSelectAll={handleSelectAllFiltered}
					onClearSelection={handleClearSelection}
					onBatchOpen={() => {
						void runAction(async () => {
							const result = await onBatchOpenProfiles(selectedStoppedIds);
							setLastBatchOpenResult(result.failedCount > 0 ? result : null);
							handleClearSelection();
						});
					}}
					onBatchClose={() => {
						void runAction(async () => {
							await onBatchCloseProfiles(selectedRunningIds);
							setLastBatchOpenResult(null);
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
					<div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-medium">批量启动失败详情</p>
								<p className="mt-1 text-xs text-muted-foreground">
									成功 {lastBatchOpenResult.successCount}，失败 {lastBatchOpenResult.failedCount}。
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="cursor-pointer"
									onClick={() => {
										const failedProfileIds = lastBatchOpenResult.items
											.filter((item) => !item.ok)
											.map((item) => item.profileId);
										void runAction(async () => {
											const result = await onBatchOpenProfiles(failedProfileIds);
											setLastBatchOpenResult(result.failedCount > 0 ? result : null);
										});
									}}
								>
									重试失败项
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="cursor-pointer"
									onClick={() => setLastBatchOpenResult(null)}
								>
									关闭
								</Button>
							</div>
						</div>
						<div className="mt-3 space-y-2">
							{lastBatchOpenResult.items
								.filter((item) => !item.ok)
								.map((item) => {
									const profile = profiles.find((profileItem) => profileItem.id === item.profileId);
									return (
										<div
											key={item.profileId}
											className="rounded-lg border border-border/70 bg-background/80 px-3 py-2"
										>
											<p className="text-sm font-medium">
												{profile?.name || item.profileId}
											</p>
											<p className="mt-1 break-words text-xs text-muted-foreground">
												{item.message}
											</p>
										</div>
									);
								})}
						</div>
					</div>
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
