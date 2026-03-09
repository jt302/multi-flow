import { CheckCheck, Play, Plus, RefreshCw, Square, X } from 'lucide-react';

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
	onChange: (patch: Partial<ProfileListFiltersState>) => void;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onBatchOpen: () => void;
	onBatchClose: () => void;
	onRefresh: () => void;
	onCreateClick: () => void;
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
	onChange,
	onSelectAll,
	onClearSelection,
	onBatchOpen,
	onBatchClose,
	onRefresh,
	onCreateClick,
}: ProfileListFiltersProps) {
	return (
		<>
			<div className="mb-2 flex items-center justify-between px-1">
				<h2 className="text-sm font-semibold">环境列表</h2>
				<div className="flex items-center gap-2">
					<Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={onRefresh}>
						<Icon icon={RefreshCw} size={12} />
						刷新
					</Button>
					<Button type="button" size="sm" className="cursor-pointer" onClick={onCreateClick}>
						<Icon icon={Plus} size={14} />
						创建环境
					</Button>
				</div>
			</div>

			<div className="mb-3 grid gap-2 px-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
				<Input
					value={keyword}
					onChange={(event) => onChange({ keyword: event.target.value })}
					placeholder="搜索名称/分组/备注"
				/>
				<Select value={groupFilter} onValueChange={(value) => onChange({ groupFilter: value })}>
					<SelectTrigger>
						<SelectValue placeholder="全部分组" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">全部分组</SelectItem>
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
					<SelectTrigger>
						<SelectValue placeholder="全部运行态" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">全部运行态</SelectItem>
						<SelectItem value="running">仅运行中</SelectItem>
						<SelectItem value="stopped">仅未运行</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={lifecycleFilter}
					onValueChange={(value) =>
						onChange({ lifecycleFilter: value as ProfileListLifecycleFilter })
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="可用环境" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="active">可用环境</SelectItem>
						<SelectItem value="deleted">已归档</SelectItem>
						<SelectItem value="all">全部生命周期</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
				<p>
					已选择 {selectedCount} / {selectableCount} 个当前筛选环境
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="cursor-pointer"
						onClick={onSelectAll}
						disabled={selectableCount === 0}
					>
						<Icon icon={CheckCheck} size={12} />
						全选当前筛选
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="cursor-pointer"
						onClick={onClearSelection}
						disabled={selectedCount === 0}
					>
						<Icon icon={X} size={12} />
						清空选择
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						onClick={onBatchOpen}
						disabled={stoppedSelectedCount === 0}
					>
						<Icon icon={Play} size={12} />
						批量启动 {stoppedSelectedCount > 0 ? `(${stoppedSelectedCount})` : ''}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="cursor-pointer"
						onClick={onBatchClose}
						disabled={runningSelectedCount === 0}
					>
						<Icon icon={Square} size={12} />
						批量关闭 {runningSelectedCount > 0 ? `(${runningSelectedCount})` : ''}
					</Button>
				</div>
			</div>
		</>
	);
}
