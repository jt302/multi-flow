import {
	ArrowLeft,
	ChevronsUpDown,
	Download,
	RefreshCw,
	ScanSearch,
	SquareArrowOutUpRight,
	Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('log');
	return (
		<CardHeader className="gap-3 pb-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						backend / logs
					</p>
					<CardTitle className="mt-1 text-base">{t('toolbar.title')}</CardTitle>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{isStandalone ? null : (
						<Link
							to="/dashboard"
							className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
						>
							<Icon icon={ArrowLeft} size={13} />
							{t('toolbar.backToConsole')}
						</Link>
					)}
					{isStandalone ? null : (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={openingWindow}
							onClick={onOpenDetachedWindow}
						>
							<Icon icon={SquareArrowOutUpRight} size={13} />
							{t('toolbar.openWindow')}
						</Button>
					)}
					<Button
						type="button"
						variant={autoScroll ? 'default' : 'outline'}
						size="sm"
						onClick={onToggleAutoScroll}
					>
						<Icon icon={ScanSearch} size={13} />
						{t('toolbar.autoScroll')}
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={onClearLogs}>
						<Icon icon={Trash2} size={13} />
						{t('toolbar.clearView')}
					</Button>
					<Button
						type="button"
						variant={groupByProfile ? 'default' : 'outline'}
						size="sm"
						onClick={onToggleGroupByProfile}
					>
						<Icon icon={ChevronsUpDown} size={13} />
						{t('toolbar.groupByProfile')}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={exporting}
						onClick={onExportCurrent}
					>
						<Icon icon={Download} size={13} />
						{t('toolbar.exportFiltered')}
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
					placeholder={t('toolbar.componentFilter')}
					className="bg-background/75"
				/>
				<Input
					value={profileFilter}
					onChange={(event) => onProfileFilterChange(event.currentTarget.value)}
					placeholder={t('toolbar.profileFilter')}
					className="bg-background/75"
				/>
				<Input
					value={keyword}
					onChange={(event) => onKeywordChange(event.currentTarget.value)}
					placeholder={t('toolbar.searchContent')}
					className="bg-background/75"
				/>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Badge variant="secondary">{t('toolbar.total', { count: logCount })}</Badge>
				<Badge variant="secondary">{t('toolbar.filtered', { count: filteredCount })}</Badge>
				<Badge variant="secondary">{t('toolbar.level', { level: levelFilter })}</Badge>
				{groupByProfile ? <Badge variant="secondary">{t('toolbar.groupView')}</Badge> : null}
				{loading ? (
					<span className="inline-flex items-center gap-1">
						<Icon icon={RefreshCw} size={12} className="animate-spin" />
						{t('toolbar.loadingHistory')}
					</span>
				) : null}
			</div>
		</CardHeader>
	);
}
