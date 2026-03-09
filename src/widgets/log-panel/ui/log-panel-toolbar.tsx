import {
	ArrowLeft,
	ChevronsUpDown,
	Download,
	RefreshCw,
	ScanSearch,
	SquareArrowOutUpRight,
	Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Button, CardHeader, CardTitle, Icon, Input } from '@/components/ui';
import { LEVEL_OPTIONS } from '../model/use-log-panel-state';

type LogPanelToolbarProps = {
	isStandalone: boolean;
	openingWindow: boolean;
	exporting: boolean;
	autoScroll: boolean;
	groupByProfile: boolean;
	componentFilter: string;
	profileFilter: string;
	keyword: string;
	levelFilter: (typeof LEVEL_OPTIONS)[number];
	logCount: number;
	filteredCount: number;
	loading: boolean;
	onOpenDetachedWindow: () => void;
	onToggleAutoScroll: () => void;
	onClearLogs: () => void;
	onToggleGroupByProfile: () => void;
	onExportCurrent: () => void;
	onComponentFilterChange: (value: string) => void;
	onProfileFilterChange: (value: string) => void;
	onKeywordChange: (value: string) => void;
	onLevelFilterChange: (value: (typeof LEVEL_OPTIONS)[number]) => void;
};

export function LogPanelToolbar({
	isStandalone,
	openingWindow,
	exporting,
	autoScroll,
	groupByProfile,
	componentFilter,
	profileFilter,
	keyword,
	levelFilter,
	logCount,
	filteredCount,
	loading,
	onOpenDetachedWindow,
	onToggleAutoScroll,
	onClearLogs,
	onToggleGroupByProfile,
	onExportCurrent,
	onComponentFilterChange,
	onProfileFilterChange,
	onKeywordChange,
	onLevelFilterChange,
}: LogPanelToolbarProps) {
	return (
		<CardHeader className="gap-3 pb-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">backend / logs</p>
					<CardTitle className="mt-1 text-base">后端日志面板</CardTitle>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{isStandalone ? null : (
						<Link
							to="/dashboard"
							className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
						>
							<Icon icon={ArrowLeft} size={13} />
							返回控制台
						</Link>
					)}
					{isStandalone ? null : (
						<Button type="button" variant="secondary" size="sm" disabled={openingWindow} onClick={onOpenDetachedWindow}>
							<Icon icon={SquareArrowOutUpRight} size={13} />
							打开独立窗口
						</Button>
					)}
					<Button type="button" variant={autoScroll ? 'default' : 'outline'} size="sm" onClick={onToggleAutoScroll}>
						<Icon icon={ScanSearch} size={13} />
						自动滚动
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={onClearLogs}>
						<Icon icon={Trash2} size={13} />
						清空视图
					</Button>
					<Button type="button" variant={groupByProfile ? 'default' : 'outline'} size="sm" onClick={onToggleGroupByProfile}>
						<Icon icon={ChevronsUpDown} size={13} />
						按 Profile 分组
					</Button>
					<Button type="button" variant="outline" size="sm" disabled={exporting} onClick={onExportCurrent}>
						<Icon icon={Download} size={13} />
						导出过滤结果
					</Button>
				</div>
			</div>

			<div className="grid gap-2 md:grid-cols-4">
				<div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/75 p-1">
					{LEVEL_OPTIONS.map((level) => (
						<Button
							key={level}
							type="button"
							size="sm"
							variant={levelFilter === level ? 'default' : 'ghost'}
							className="h-8 flex-1"
							onClick={() => onLevelFilterChange(level)}
						>
							{level}
						</Button>
					))}
				</div>
				<Input
					value={componentFilter}
					onChange={(event) => onComponentFilterChange(event.currentTarget.value)}
					placeholder="按 component 过滤，例如 engine_manager"
					className="bg-background/75"
				/>
				<Input
					value={profileFilter}
					onChange={(event) => onProfileFilterChange(event.currentTarget.value)}
					placeholder="按 profile_id 过滤，例如 pf_000001"
					className="bg-background/75"
				/>
				<Input
					value={keyword}
					onChange={(event) => onKeywordChange(event.currentTarget.value)}
					placeholder="搜索日志内容"
					className="bg-background/75"
				/>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Badge variant="secondary">总计 {logCount}</Badge>
				<Badge variant="secondary">过滤后 {filteredCount}</Badge>
				<Badge variant="secondary">级别 {levelFilter}</Badge>
				{groupByProfile ? <Badge variant="secondary">分组视图</Badge> : null}
				{loading ? (
					<span className="inline-flex items-center gap-1">
						<Icon icon={RefreshCw} size={12} className="animate-spin" />
						加载历史日志中...
					</span>
				) : null}
			</div>
		</CardHeader>
	);
}
