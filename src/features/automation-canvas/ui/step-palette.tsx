/**
 * step-palette.tsx
 * 画布左侧"添加步骤"面板，支持折叠/展开。
 * 展开时按分组展示所有可用步骤类型，支持搜索过滤。
 * 折叠时只显示一个展开按钮。
 */

import {
	ChevronDown,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	HelpCircle,
	Search,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
	GROUP_ACCENT_COLORS,
	GROUP_COLORS,
	getGroupLabel,
	getKindDescription,
	getKindLabel,
	KIND_GROUPS,
	PALETTE_DOT_COLORS,
	PALETTE_GROUPS,
	STEP_TOOL_INFO,
} from '@/entities/automation/model/step-registry';

function StepToolPopover({ kind }: { kind: string }) {
	const { t } = useTranslation(['automation', 'common']);
	const info =
		STEP_TOOL_INFO[kind] ??
		(() => {
			const description = getKindDescription(kind);
			if (!description) return null;
			return {
				description,
				inputs: [],
				outputs: [],
				whenToUse: t(
					'automation:stepTooltip.genericWhenToUse',
					'用于快速了解该步骤作用，详细参数可在右侧属性面板中继续查看。',
				),
			};
		})();
	if (!info) return null;

	const groupKey = KIND_GROUPS[kind] ?? 'general';
	const accentColor = GROUP_ACCENT_COLORS[groupKey] ?? 'border-l-slate-400';
	const groupLabel = getGroupLabel(groupKey);

	return (
		<div className={`w-80 border-l-4 ${accentColor} bg-popover rounded-lg shadow-lg`}>
			{/* Header */}
			<div className="px-4 py-3 border-b">
				<div className="flex items-center gap-2 mb-1">
					<span
						className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${GROUP_COLORS[groupKey] ?? GROUP_COLORS.通用}`}
					>
						{groupLabel}
					</span>
				</div>
				<h4 className="font-semibold text-xs text-muted-foreground mt-3 break-words [overflow-wrap:anywhere]">
					{getKindLabel(kind)}
				</h4>
			</div>

			<div className="p-4 space-y-4">
				{/* Description */}
				<p className="text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
					{info.description}
				</p>

				{/* Inputs */}
				{info.inputs.length > 0 && (
					<div>
						<h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
							<span className="w-1 h-1 rounded-full bg-primary" />
							{t('automation:stepTooltip.inputs', '输入参数')}
						</h5>
						<div className="space-y-2">
							{info.inputs.map((input) => (
								<div
									key={input.name}
									className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2 text-xs"
								>
									<code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded shrink-0">
										{input.name}
									</code>
									{input.required ? (
										<Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
											{t('automation:stepTooltip.required', '必需')}
										</Badge>
									) : (
										<Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
											{t('automation:stepTooltip.optional', '可选')}
										</Badge>
									)}
									<span className="min-w-0 text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
										{input.desc}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Outputs */}
				{info.outputs.length > 0 && (
					<div>
						<h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
							<span className="w-1 h-1 rounded-full bg-emerald-500" />
							{t('automation:stepTooltip.outputs', '输出')}
						</h5>
						<div className="space-y-1.5">
							{info.outputs.map((output) => (
								<div
									key={output.name}
									className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs"
								>
									<code className="font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded shrink-0">
										{output.name}
									</code>
									<span className="min-w-0 text-muted-foreground break-words [overflow-wrap:anywhere]">
										{output.desc}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* When to Use */}
				<div>
					<h5 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
						<span className="w-1 h-1 rounded-full bg-amber-500" />
						{t('automation:stepTooltip.whenToUse', '使用时机')}
					</h5>
					<p className="text-xs text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
						{info.whenToUse}
					</p>
				</div>

				{/* Example */}
				{info.example && (
					<div>
						<h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
							<span className="w-1 h-1 rounded-full bg-purple-500" />
							{t('automation:stepTooltip.example', '示例')}
						</h5>
						<pre className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-md overflow-x-auto whitespace-pre-wrap break-all border border-slate-200 dark:border-slate-700">
							{info.example}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}

type Props = {
	/** 点击步骤按钮时的回调，参数为步骤种类字符串（kind） */
	onAddStep: (kind: string) => void;
	collapsed: boolean;
	onToggleCollapse: () => void;
};

/**
 * 步骤调色板侧栏
 * 折叠：40px 宽，仅显示展开按钮
 * 展开：208px 宽，搜索 + 分组列表
 */
// 常用步骤（置顶显示，始终展开）
const FAVORITE_KINDS = [
	'cdp_navigate',
	'cdp_click',
	'cdp_type',
	'cdp_screenshot',
	'cdp_get_text',
	'wait',
	'cdp_wait_for_page_load',
	'ai_agent',
];

export function StepPalette({ onAddStep, collapsed, onToggleCollapse }: Props) {
	const { t } = useTranslation(['automation', 'common']);
	const [search, setSearch] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);
	const favoritesLabel = t('automation:palette.favorites', {
		ns: 'automation',
	});
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
		() => new Set([favoritesLabel]),
	);

	const toggleGroup = useCallback((label: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	}, []);

	const filteredGroups = useMemo(() => {
		const isSearching = !!search.trim();
		const q = search.toLowerCase();

		// 构建常用组
		const favoriteGroup = {
			label: favoritesLabel,
			kinds: FAVORITE_KINDS.filter(
				(k) =>
					!isSearching || getKindLabel(k).toLowerCase().includes(q) || k.toLowerCase().includes(q),
			),
		};

		// 过滤其他组（排除已在常用中的）
		const favoriteSet = new Set(FAVORITE_KINDS);
		const otherGroups = PALETTE_GROUPS.map((group) => ({
			...group,
			// 使用翻译后的标签显示
			displayLabel: getGroupLabel(group.label),
			kinds: group.kinds.filter((kind) => {
				if (favoriteSet.has(kind)) return false;
				if (!isSearching) return true;
				const label = getKindLabel(kind);
				return label.toLowerCase().includes(q) || kind.toLowerCase().includes(q);
			}),
		})).filter((group) => group.kinds.length > 0);

		const result = favoriteGroup.kinds.length > 0 ? [favoriteGroup, ...otherGroups] : otherGroups;
		return result;
	}, [search, favoritesLabel]);

	if (collapsed) {
		return (
			<div className="w-10 border-r flex-shrink-0 bg-background/50 flex flex-col items-center pt-2">
				<button
					type="button"
					className="p-1.5 rounded-md hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title={t('automation:palette.expandPanel', { ns: 'automation' })}
				>
					<ChevronsRight className="h-4 w-4" />
				</button>
			</div>
		);
	}

	return (
		<div className="w-52 border-r flex-shrink-0 bg-background/50 flex flex-col min-h-0">
			{/* 标题行 + 折叠按钮 */}
			<div className="flex items-center justify-between px-2.5 py-2 border-b flex-shrink-0">
				<span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
					{t('automation:palette.addSteps', { ns: 'automation' })}
				</span>
				<button
					type="button"
					className="p-1 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title={t('automation:palette.collapsePanel', { ns: 'automation' })}
				>
					<ChevronsLeft className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* 搜索框 */}
			<div className="px-2 py-1.5 flex-shrink-0">
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
					<Input
						ref={searchRef}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t('common:placeholder.search', { ns: 'common' })}
						className="h-7 text-xs pl-7 pr-2"
					/>
				</div>
			</div>

			{/* 步骤列表（可滚动） */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-2.5">
					{filteredGroups.map((group) => {
						const isSearching = !!search.trim();
						const isExpanded = isSearching || expandedGroups.has(group.label);
						// 显示翻译后的分组名称，回退到原始 label
						const displayLabel =
							'displayLabel' in group
								? (group as { displayLabel: string }).displayLabel
								: group.label;
						return (
							<div key={group.label}>
								{/* 分组标签（可点击折叠/展开） */}
								<button
									type="button"
									className="w-full flex items-center gap-1 px-0.5 mb-1 cursor-pointer group/grp"
									onClick={() => toggleGroup(group.label)}
								>
									{isExpanded ? (
										<ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
									) : (
										<ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
									)}
									<span
										className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded ${GROUP_COLORS[group.label] ?? GROUP_COLORS.通用}`}
									>
										{displayLabel}
									</span>
									<span className="text-[11px] text-muted-foreground/50 ml-auto">
										{group.kinds.length}
									</span>
								</button>

								{/* 该分组下的步骤按钮（折叠时隐藏） */}
								{isExpanded &&
									group.kinds.map((kind) => (
										<div key={kind} className="flex items-center gap-1 group/item">
											<button
												type="button"
												className="flex-1 text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer flex items-center gap-2"
												onClick={() => onAddStep(kind)}
											>
												<span
													className={`w-1 h-3.5 rounded-full flex-shrink-0 opacity-30 group-hover/item:opacity-60 transition-opacity ${PALETTE_DOT_COLORS[group.label] ?? 'bg-muted-foreground/50'}`}
												/>
												<span className="truncate">{getKindLabel(kind)}</span>
											</button>
											<TooltipProvider delayDuration={200}>
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															type="button"
															className="p-1 rounded hover:bg-accent text-muted-foreground opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
														>
															<HelpCircle className="h-3 w-3" />
														</button>
													</TooltipTrigger>
													<TooltipContent
														side="right"
														className="p-0 w-auto border-none bg-transparent shadow-none"
													>
														<StepToolPopover kind={kind} />
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									))}
							</div>
						);
					})}
					{filteredGroups.length === 0 && (
						<p className="text-xs text-muted-foreground text-center py-4">
							{t('automation:palette.noMatch', { ns: 'automation' })}
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
