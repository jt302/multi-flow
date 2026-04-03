/**
 * step-palette.tsx
 * 画布左侧"添加步骤"面板，支持折叠/展开。
 * 展开时按分组展示所有可用步骤类型，支持搜索过滤。
 * 折叠时只显示一个展开按钮。
 */

import { useMemo, useRef, useState } from 'react';

import { ChevronsLeft, ChevronsRight, Search } from 'lucide-react';

import {
	GROUP_COLORS,
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
export function StepPalette({ onAddStep, collapsed, onToggleCollapse }: Props) {
	const [search, setSearch] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);

	const filteredGroups = useMemo(() => {
		if (!search.trim()) return PALETTE_GROUPS;
		const q = search.toLowerCase();
		return PALETTE_GROUPS.map((group) => ({
			...group,
			kinds: group.kinds.filter((kind) => {
				const label = KIND_LABELS[kind] ?? kind;
				return (
					label.toLowerCase().includes(q) || kind.toLowerCase().includes(q)
				);
			}),
		})).filter((group) => group.kinds.length > 0);
	}, [search]);

	if (collapsed) {
		return (
			<div className="w-10 border-r flex-shrink-0 bg-background/50 flex flex-col items-center pt-2">
				<button
					type="button"
					className="p-1.5 rounded-md hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title="展开步骤面板"
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
					添加步骤
				</span>
				<button
					type="button"
					className="p-1 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
					onClick={onToggleCollapse}
					title="折叠面板"
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
						placeholder="搜索步骤..."
						className="h-7 text-xs pl-7 pr-2"
					/>
				</div>
			</div>

			{/* 步骤列表（可滚动） */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-2.5">
					{filteredGroups.map((group) => (
						<div key={group.label}>
							{/* 分组标签 */}
							<div className="px-0.5 mb-1">
								<span
									className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded ${GROUP_COLORS[group.label] ?? GROUP_COLORS['通用']}`}
								>
									{group.label}
								</span>
							</div>

							{/* 该分组下的步骤按钮 */}
							{group.kinds.map((kind) => (
								<button
									key={kind}
									type="button"
									className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer flex items-center gap-2 mb-0.5 group/item"
									onClick={() => onAddStep(kind)}
								>
									<span
										className={`w-1 h-3.5 rounded-full flex-shrink-0 opacity-30 group-hover/item:opacity-60 transition-opacity ${PALETTE_DOT_COLORS[group.label] ?? 'bg-muted-foreground/50'}`}
									/>
									<span className="truncate">{KIND_LABELS[kind] ?? kind}</span>
								</button>
							))}
						</div>
					))}
					{filteredGroups.length === 0 && (
						<p className="text-xs text-muted-foreground text-center py-4">
							无匹配步骤
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
