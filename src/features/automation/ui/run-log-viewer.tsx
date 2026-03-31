import { useMemo, useState } from 'react';

import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

import type { RunLogEntry } from '@/entities/automation/model/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type Props = {
	logs: RunLogEntry[];
	runStartedAt: number;
};

const LOG_LEVELS: RunLogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
const LOG_CATEGORIES: RunLogEntry['category'][] = [
	'flow',
	'step',
	'ai',
	'cdp',
	'magic',
	'error',
];

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

function formatRelativeTime(timestampMs: number, runStartedAt: number) {
	const runStartMs =
		runStartedAt > 1_000_000_000_000 ? runStartedAt : runStartedAt * 1000;
	const seconds = (timestampMs - runStartMs) / 1000;
	const sign = seconds >= 0 ? '+' : '-';
	return `${sign}${Math.abs(seconds).toFixed(3)}s`;
}

export function RunLogViewer({ logs, runStartedAt }: Props) {
	const [enabledLevels, setEnabledLevels] = useState<Set<RunLogEntry['level']>>(
		() => new Set(LOG_LEVELS),
	);
	const [enabledCategories, setEnabledCategories] = useState<
		Set<RunLogEntry['category']>
	>(() => new Set(LOG_CATEGORIES));
	const [expandedDetails, setExpandedDetails] = useState<Set<number>>(
		() => new Set(),
	);

	const filteredLogs = useMemo(
		() =>
			logs.filter(
				(entry) =>
					enabledLevels.has(entry.level) &&
					enabledCategories.has(entry.category),
			),
		[enabledCategories, enabledLevels, logs],
	);

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
				<p className="text-xs text-muted-foreground">暂无执行日志</p>
			</div>
		);
	}

	return (
		<div className="border-t border-border/50">
			<div className="flex gap-1 flex-wrap px-3 py-2 border-b bg-muted/20">
				<div className="flex items-center gap-1 mr-2">
					<Filter className="h-3 w-3 text-muted-foreground" />
					<span className="text-[10px] text-muted-foreground">级别</span>
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
					<span className="text-[10px] text-muted-foreground">分类</span>
				</div>
				{LOG_CATEGORIES.map((category) => (
					<ToggleChip
						key={category}
						active={enabledCategories.has(category)}
						label={category}
						onClick={() => toggleCategory(category)}
					/>
				))}
			</div>
			<ScrollArea className="h-64">
				<div className="font-mono text-xs">
					{filteredLogs.length === 0 ? (
						<p className="px-3 py-3 text-muted-foreground">没有匹配的日志条目</p>
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
											{formatRelativeTime(entry.timestamp, runStartedAt)}
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
									{hasDetails && <StepDetails details={entry.details!} expanded={detailsExpanded} />}
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
const INLINE_KEYS = ['kind', 'selector', 'selector_type', 'url', 'text', 'value', 'expression', 'prompt', 'model', 'command', 'method', 'reply', 'error', 'output', 'attribute'];

function StepDetails({ details, expanded }: { details: Record<string, unknown>; expanded: boolean }) {
	const inlineEntries = INLINE_KEYS
		.filter((k) => details[k] !== undefined && details[k] !== null)
		.map((k) => [k, details[k]] as const);
	const restKeys = Object.keys(details).filter((k) => !INLINE_KEYS.includes(k));

	if (inlineEntries.length === 0 && !expanded) return null;

	return (
		<div className="mt-1 space-y-0.5">
			{inlineEntries.map(([key, val]) => {
				const strVal = typeof val === 'string' ? val : JSON.stringify(val);
				const isLong = strVal.length > 120;
				return (
					<div key={key} className="flex items-start gap-1.5">
						<span className="text-[10px] text-muted-foreground shrink-0 min-w-[70px] text-right">{key}</span>
						<span className={`text-foreground/80 break-all ${isLong ? 'whitespace-pre-wrap' : ''}`}>{strVal}</span>
					</div>
				);
			})}
			{expanded && restKeys.length > 0 && (
				<pre className="text-xs bg-muted/60 p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap text-muted-foreground">
					{JSON.stringify(
						Object.fromEntries(restKeys.map((k) => [k, details[k]])),
						null,
						2,
					)}
				</pre>
			)}
		</div>
	);
}
