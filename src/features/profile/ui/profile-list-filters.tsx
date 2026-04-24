import { LoaderCircle, Play, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	Button,
	Icon,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';

import type {
	ProfileListFiltersState,
	ProfileListLifecycleFilter,
	ProfileListRunningFilter,
} from '@/entities/profile/lib/profile-list';

type ProfileBatchAction = 'refresh' | 'open' | 'close' | 'stopAll' | 'setGroup' | 'clearGroup' | 'retryOpen';

type ProfileListFiltersProps = {
	keyword: string;
	groupFilter: string;
	runningFilter: ProfileListRunningFilter;
	lifecycleFilter: ProfileListLifecycleFilter;
	groupOptions: string[];
	selectedCount: number;
	selectableCount: number;
	stoppedSelectedCount: number;
	runningSelectedCount: number;
	stopAllRunningCount: number;
	pending: boolean;
	busyAction: ProfileBatchAction | null;
	onChange: (patch: Partial<ProfileListFiltersState>) => void;
	onBatchOpen: () => void;
	onBatchClose: () => void;
	onStopAllRunning: () => void;
	onOpenBatchGroupDialog: () => void;
	onOpenBatchClearDialog: () => void;
};

export function ProfileListFilters({
	keyword,
	groupFilter,
	runningFilter,
	lifecycleFilter,
	groupOptions,
	selectedCount,
	selectableCount,
	stoppedSelectedCount,
	runningSelectedCount,
	stopAllRunningCount,
	pending,
	busyAction,
	onChange,
	onBatchOpen,
	onBatchClose,
	onStopAllRunning,
	onOpenBatchGroupDialog,
	onOpenBatchClearDialog,
}: ProfileListFiltersProps) {
	const { t } = useTranslation(['common']);
	return (
		<>
			<div className="mb-3 grid gap-2 px-1 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
				<Input
					value={keyword}
					onChange={(event) => onChange({ keyword: event.target.value })}
					placeholder={t('common:searchProfile')}
				/>
				<Select value={groupFilter} onValueChange={(value) => onChange({ groupFilter: value })}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t('common:allGroups')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('common:allGroups')}</SelectItem>
						{groupOptions.map((groupName) => (
							<SelectItem key={groupName} value={groupName}>
								{groupName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={runningFilter}
					onValueChange={(value) =>
						onChange({ runningFilter: value as ProfileListRunningFilter })
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t('common:allRunningStates')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('common:allRunningStates')}</SelectItem>
						<SelectItem value="running">{t('common:onlyRunning')}</SelectItem>
						<SelectItem value="stopped">{t('common:onlyStopped')}</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={lifecycleFilter}
					onValueChange={(value) =>
						onChange({ lifecycleFilter: value as ProfileListLifecycleFilter })
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t('common:availableProfiles')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="active">{t('common:availableProfiles')}</SelectItem>
						<SelectItem value="deleted">{t('common:archived')}</SelectItem>
						<SelectItem value="all">{t('common:allLifecycles')}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
				<p>
					{t('common:selectedCountOfFiltered', { selected: selectedCount, total: selectableCount })}
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						onClick={onOpenBatchGroupDialog}
						disabled={pending || selectedCount === 0 || groupOptions.length === 0}
					>
						{t('common:batchSetGroup')}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="cursor-pointer"
						onClick={onOpenBatchClearDialog}
						disabled={pending || selectedCount === 0}
					>
						{t('common:clearGroup')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						onClick={onBatchOpen}
						disabled={pending || stoppedSelectedCount === 0}
					>
						<Icon icon={busyAction === 'open' ? LoaderCircle : Play} size={12} className={busyAction === 'open' ? 'animate-spin' : undefined} />
						{t('common:batchOpen')} {stoppedSelectedCount > 0 ? `(${stoppedSelectedCount})` : ''}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						onClick={onBatchClose}
						disabled={pending || runningSelectedCount === 0}
					>
						<Icon icon={busyAction === 'close' ? LoaderCircle : Square} size={12} className={busyAction === 'close' ? 'animate-spin' : undefined} />
						{t('common:batchClose')} {runningSelectedCount > 0 ? `(${runningSelectedCount})` : ''}
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						className="cursor-pointer"
						onClick={onStopAllRunning}
						disabled={pending || stopAllRunningCount === 0}
					>
						<Icon icon={busyAction === 'stopAll' ? LoaderCircle : Square} size={12} className={busyAction === 'stopAll' ? 'animate-spin' : undefined} />
						{t('common:stopAllRunning')} {stopAllRunningCount > 0 ? `(${stopAllRunningCount})` : ''}
					</Button>
				</div>
			</div>
		</>
	);
}
