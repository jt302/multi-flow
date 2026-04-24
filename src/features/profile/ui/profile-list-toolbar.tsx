import type { BatchProfileActionResponse } from '@/entities/profile/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { ProfileBatchClearGroupDialog } from './profile-batch-clear-group-dialog';
import { ProfileBatchGroupDialog } from './profile-batch-group-dialog';
import { ProfileBatchOpenResultCard } from './profile-batch-open-result-card';
import { ProfileListFilters } from './profile-list-filters';

type ProfileBatchAction = 'refresh' | 'open' | 'close' | 'stopAll' | 'setGroup' | 'clearGroup' | 'retryOpen';

type ProfileListToolbarProps = {
	keyword: string;
	groupFilter: string;
	runningFilter: 'all' | 'running' | 'stopped';
	lifecycleFilter: 'active' | 'deleted' | 'all';
	groupOptions: string[];
	selectedCount: number;
	selectableCount: number;
	stoppedSelectedCount: number;
	runningSelectedCount: number;
	stopAllRunningCount: number;
	batchGroupDialogOpen: boolean;
	batchClearGroupDialogOpen: boolean;
	batchGroupTarget: string;
	busyAction: ProfileBatchAction | null;
	lastBatchOpenResult: BatchProfileActionResponse | null;
	profiles: ProfileItem[];
	onChange: (patch: {
		keyword?: string;
		groupFilter?: string;
		runningFilter?: 'all' | 'running' | 'stopped';
		lifecycleFilter?: 'active' | 'deleted' | 'all';
	}) => void;
	onOpenBatchGroupDialog: () => void;
	onOpenBatchClearDialog: () => void;
	onBatchOpen: () => void;
	onBatchClose: () => void;
	onStopAllRunning: () => void;
	onBatchGroupDialogOpenChange: (open: boolean) => void;
	onBatchClearDialogOpenChange: (open: boolean) => void;
	onBatchGroupTargetChange: (value: string) => void;
	onConfirmBatchGroup: () => void;
	onConfirmBatchClearGroup: () => void;
	onRetryFailed: (failedProfileIds: string[]) => void;
	onCloseBatchResult: () => void;
};

export function ProfileListToolbar({
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
	batchGroupDialogOpen,
	batchClearGroupDialogOpen,
	batchGroupTarget,
	busyAction,
	lastBatchOpenResult,
	profiles,
	onChange,
	onOpenBatchGroupDialog,
	onOpenBatchClearDialog,
	onBatchOpen,
	onBatchClose,
	onStopAllRunning,
	onBatchGroupDialogOpenChange,
	onBatchClearDialogOpenChange,
	onBatchGroupTargetChange,
	onConfirmBatchGroup,
	onConfirmBatchClearGroup,
	onRetryFailed,
	onCloseBatchResult,
}: ProfileListToolbarProps) {
	return (
		<>
			<ProfileListFilters
				keyword={keyword}
				groupFilter={groupFilter}
				runningFilter={runningFilter}
				lifecycleFilter={lifecycleFilter}
				groupOptions={groupOptions}
				selectedCount={selectedCount}
				selectableCount={selectableCount}
				stoppedSelectedCount={stoppedSelectedCount}
				runningSelectedCount={runningSelectedCount}
				stopAllRunningCount={stopAllRunningCount}
				pending={Boolean(busyAction)}
				busyAction={busyAction}
				onChange={onChange}
				onOpenBatchGroupDialog={onOpenBatchGroupDialog}
				onOpenBatchClearDialog={onOpenBatchClearDialog}
				onBatchOpen={onBatchOpen}
				onBatchClose={onBatchClose}
				onStopAllRunning={onStopAllRunning}
			/>

			<ProfileBatchGroupDialog
				open={batchGroupDialogOpen}
				groupOptions={groupOptions}
				selectedCount={selectedCount}
				value={batchGroupTarget}
				pending={Boolean(busyAction)}
				onOpenChange={onBatchGroupDialogOpenChange}
				onValueChange={onBatchGroupTargetChange}
				onConfirm={onConfirmBatchGroup}
			/>

			<ProfileBatchClearGroupDialog
				open={batchClearGroupDialogOpen}
				selectedCount={selectedCount}
				pending={Boolean(busyAction)}
				onOpenChange={onBatchClearDialogOpenChange}
				onConfirm={onConfirmBatchClearGroup}
			/>

			{lastBatchOpenResult?.failedCount ? (
				<ProfileBatchOpenResultCard
					result={lastBatchOpenResult}
					profiles={profiles}
					onRetryFailed={onRetryFailed}
					onClose={onCloseBatchResult}
				/>
			) : null}
		</>
	);
}
