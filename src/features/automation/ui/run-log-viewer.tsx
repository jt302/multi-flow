import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RunLogEntry } from '@/entities/automation/model/types';

type Props = {
	logs: RunLogEntry[];
	/** Sheet 全屏模式下传 true，内部细节区域更大 */
	expanded?: boolean;
};

const LOG_LEVELS: RunLogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
const LOG_CATEGORIES: RunLogEntry['category'][] = ['flow', 'step', 'ai', 'cdp', 'magic', 'error'];

const LEVEL_TEXT_CLASS: Record<RunLogEntry['level'], string> = {
	info: 'text-foreground',
	warn: 'text-amber-500',
	error: 'text-red-500',
	debug: 'text-muted-foreground/60',
};

const CATEGORY_BADGE_CLASS: Record<RunLogEntry['category'], string> = {
	flow: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
	step: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent',
	ai: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
	cdp: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent',
	magic: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-transparent',
	error: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
};

function ToggleChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				'h-6 px-2 rounded border text-[10px] uppercase tracking-wide cursor-pointer transition-colors',
				active
					? 'bg-primary/15 border-primary/40 text-primary'
					: 'bg-transparent border-border/70 text-muted-foreground hover:text-foreground opacity-70',
			].join(' ')}
		>
			{label}
		</button>
	);
}

function formatLogTime(timestampMs: number) {
	const ms = timestampMs > 1_000_000_000_000 ? timestampMs : timestampMs * 1000;
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function RunLogViewer({ logs, expanded = false }: Props) {
	const { t } = useTranslation(['automation', 'common']);
	const [enabledLevels, setEnabledLevels] = useState<Set<RunLogEntry['level']>>(
		() => new Set(LOG_LEVELS),
	);
	const [enabledCategories, setEnabledCategories] = useState<Set<RunLogEntry['category']>>(
		() => new Set(LOG_CATEGORIES),
	);
	const [expandedDetails, setExpandedDetails] = useState<Set<number>>(() => new Set());
	// 筛选栏默认折叠，节省垂直空间
	const [filtersCollapsed, setFiltersCollapsed] = useState(true);

	const filteredLogs = useMemo(
		() =>
			logs.filter(
				(entry) => enabledLevels.has(entry.level) && enabledCategories.has(entry.category),
			),
		[enabledCategories, enabledLevels, logs],
	);

	// 是否有任何过滤器处于非全选状态
	const hasActiveFilter =
		enabledLevels.size < LOG_LEVELS.length || enabledCategories.size < LOG_CATEGORIES.length;

	function toggleLevel(level: RunLogEntry['level']) {
		setEnabledLevels((prev) => {
			const next = new Set(prev);
			if (next.has(level)) {
				next.delete(level);
			} else {
				next.add(level);
			}
			return next.size === 0 ? new Set(LOG_LEVELS) : next;
		});
	}

	function toggleCategory(category: RunLogEntry['category']) {
		setEnabledCategories((prev) => {
			const next = new Set(prev);
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next.size === 0 ? new Set(LOG_CATEGORIES) : next;
		});
	}

	function toggleDetails(index: number) {
		setExpandedDetails((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}

	if (logs.length === 0) {
		return (
			<div className="px-5 py-4">
				<p className="text-xs text-muted-foreground">{t('common:noLogs')}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 min-h-0 border-t border-border/50">
			{/* 筛选栏 */}
			<div className="shrink-0 border-b bg-muted/20">
				{filtersCollapsed ? (
					/* 折叠态：仅显示一个 Filter 图标按钮 */
					<div className="flex items-center gap-2 px-3 py-1.5">
						<button
							type="button"
							className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
							onClick={() => setFiltersCollapsed(false)}
							title={t('common:expandFilters')}
						>
							<Filter className="h-3 w-3" />
							<span>{t('common:filter')}</span>
							{hasActiveFilter && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
						</button>
						<span className="text-[10px] text-muted-foreground">
							{t('common:countTotal', { filtered: filteredLogs.length, total: logs.length })}
						</span>
					</div>
				) : (
					/* 展开态：完整筛选 chips */
					<div className="flex gap-1 flex-wrap px-3 py-2">
						<div className="flex items-center gap-1 mr-2">
							<Filter className="h-3 w-3 text-muted-foreground" />
							<span className="text-[10px] text-muted-foreground">{t('common:level')}</span>
						</div>
						{LOG_LEVELS.map((level) => (
							<ToggleChip
								key={level}
								active={enabledLevels.has(level)}
								label={level}
								onClick={() => toggleLevel(level)}
							/>
						))}
						<div className="w-full" />
						<div className="flex items-center gap-1 mr-2">
							<span className="text-[10px] text-muted-foreground">{t('common:category')}</span>
						</div>
						{LOG_CATEGORIES.map((category) => (
							<ToggleChip
								key={category}
								active={enabledCategories.has(category)}
								label={category}
								onClick={() => toggleCategory(category)}
							/>
						))}
						<button
							type="button"
							className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
							onClick={() => setFiltersCollapsed(true)}
							title={t('common:collapseFilters')}
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				)}
			</div>

			{/* 日志列表（自适应高度） */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="font-mono text-xs">
					{filteredLogs.length === 0 ? (
						<p className="px-3 py-3 text-muted-foreground">{t('common:noMatches')}</p>
					) : (
						filteredLogs.map((entry, index) => {
							const hasDetails = !!entry.details;
							const detailsExpanded = expandedDetails.has(index);
							return (
								<div
									key={`${entry.timestamp}-${index}`}
									className="px-3 py-2 border-b border-border/50 last:border-b-0"
								>
									<div className="flex items-start gap-2">
										<span className="shrink-0 text-[10px] text-muted-foreground">
											{formatLogTime(entry.timestamp)}
										</span>
										<span
											className={`shrink-0 uppercase text-[10px] ${LEVEL_TEXT_CLASS[entry.level]}`}
										>
											{entry.level}
										</span>
										<Badge
											variant="outline"
											className={`h-5 text-[10px] px-1.5 ${CATEGORY_BADGE_CLASS[entry.category]}`}
										>
											{entry.category}
										</Badge>
										<p className="flex-1 break-all leading-5">{entry.message}</p>
										{hasDetails && (
											<button
												type="button"
												className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
												onClick={() => toggleDetails(index)}
											>
												{detailsExpanded ? (
													<ChevronUp className="h-3.5 w-3.5" />
												) : (
													<ChevronDown className="h-3.5 w-3.5" />
												)}
											</button>
										)}
									</div>
									{hasDetails && (
										<StepDetails
											details={entry.details!}
											expanded={detailsExpanded}
											expandedContainer={expanded}
										/>
									)}
								</div>
							);
						})
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

/** 关键字段优先展示，其余折叠 */
const INLINE_KEYS = [
	'kind',
	'selector',
	'selector_type',
	'url',
	'text',
	'value',
	'expression',
	'prompt',
	'model',
	'command',
	'method',
	'reply',
	'error',
	'output',
	'attribute',
	// AI 步骤相关
	'assistantText',
	'name',
	'arguments',
	'result',
	'toolCalls',
	'finalOutput',
	'rawReply',
	'parsedValue',
	'round',
	'durationMs',
];

function StepDetails({
	details,
	expanded,
	expandedContainer,
}: {
	details: Record<string, unknown>;
	expanded: boolean;
	expandedContainer: boolean;
}) {
	const inlineEntries = INLINE_KEYS.filter(
		(k) => details[k] !== undefined && details[k] !== null,
	).map((k) => [k, details[k]] as const);
	const restKeys = Object.keys(details).filter((k) => !INLINE_KEYS.includes(k));

	if (inlineEntries.length === 0 && !expanded) return null;

	return (
		<div className="mt-1 space-y-0.5">
			{inlineEntries.map(([key, val]) => {
				const strVal = typeof val === 'string' ? val : JSON.stringify(val);
				const isLong = strVal.length > 120;
				return (
					<div key={key} className="flex items-start gap-1.5">
						<span className="text-[10px] text-muted-foreground shrink-0 min-w-[70px] text-right">
							{key}
						</span>
						<span className={`text-foreground/80 break-all ${isLong ? 'whitespace-pre-wrap' : ''}`}>
							{strVal}
						</span>
					</div>
				);
			})}
			{expanded && restKeys.length > 0 && (
				<pre
					className={`text-xs bg-muted/60 p-2 rounded mt-1 overflow-auto whitespace-pre-wrap text-muted-foreground ${
						expandedContainer ? 'max-h-96' : 'max-h-40'
					}`}
				>
					{JSON.stringify(Object.fromEntries(restKeys.map((k) => [k, details[k]])), null, 2)}
				</pre>
			)}
		</div>
	);
}
