/**
 * step-palette.tsx
 * 画布左侧"添加步骤"面板，支持折叠/展开。
 * 展开时按分组展示所有可用步骤类型，支持搜索过滤。
 * 折叠时只显示一个展开按钮。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';

import {
	GROUP_COLORS,
	KIND_DESCRIPTIONS,
	KIND_LABELS,
	PALETTE_DOT_COLORS,
	PALETTE_GROUPS,
} from '@/entities/automation/model/step-registry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

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
	'cdp_navigate', 'cdp_click', 'cdp_type', 'cdp_screenshot',
	'cdp_get_text', 'wait', 'cdp_wait_for_page_load', 'ai_agent',
];

export function StepPalette({ onAddStep, collapsed, onToggleCollapse }: Props) {
	const { t } = useTranslation('canvas');
	const [search, setSearch] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);
	const favoritesLabel = t('palette.favorites');
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set([favoritesLabel]));

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
			kinds: FAVORITE_KINDS.filter((k) =>
				!isSearching || (KIND_LABELS[k] ?? k).toLowerCase().includes(q) || k.toLowerCase().includes(q),
			),
		};

		// 过滤其他组（排除已在常用中的）
		const favoriteSet = new Set(FAVORITE_KINDS);
		const otherGroups = PALETTE_GROUPS.map((group) => ({
			...group,
			kinds: group.kinds.filter((kind) => {
				if (favoriteSet.has(kind)) return false;
				if (!isSearching) return true;
				const label = KIND_LABELS[kind] ?? kind;
				return label.toLowerCase().includes(q) || kind.toLowerCase().includes(q);
			}),
		})).filter((group) => group.kinds.length > 0);

		const result = favoriteGroup.kinds.length > 0 ? [favoriteGroup, ...otherGroups] : otherGroups;
		return result;
	}, [search]);

	if (collapsed) {
		return (
			<div className="w-10 border-r flex-shrink-0 bg-background/50 flex flex-col items-center pt-2">
				<button
					type="button"
					className="p-1.5 rounded-md hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title={t('palette.expandPanel')}
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
					{t('palette.addSteps')}
				</span>
				<button
					type="button"
					className="p-1 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title={t('palette.collapsePanel')}
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
						placeholder={t('palette.searchSteps')}
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
										className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded ${GROUP_COLORS[group.label] ?? GROUP_COLORS['通用']}`}
									>
										{group.label}
									</span>
									<span className="text-[9px] text-muted-foreground/50 ml-auto">
										{group.kinds.length}
									</span>
								</button>

								{/* 该分组下的步骤按钮（折叠时隐藏） */}
								{isExpanded &&
									group.kinds.map((kind) => (
										<button
											key={kind}
											type="button"
											className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer flex items-center gap-2 mb-0.5 group/item"
											onClick={() => onAddStep(kind)}
											title={KIND_DESCRIPTIONS[kind] ?? kind}
										>
											<span
												className={`w-1 h-3.5 rounded-full flex-shrink-0 opacity-30 group-hover/item:opacity-60 transition-opacity ${PALETTE_DOT_COLORS[group.label] ?? 'bg-muted-foreground/50'}`}
											/>
											<span className="truncate">{KIND_LABELS[kind] ?? kind}</span>
										</button>
									))}
							</div>
						);
					})}
					{filteredGroups.length === 0 && (
						<p className="text-xs text-muted-foreground text-center py-4">
							{t('palette.noMatch')}
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
