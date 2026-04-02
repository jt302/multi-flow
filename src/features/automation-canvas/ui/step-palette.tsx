/**
 * step-palette.tsx
 * 画布左侧"添加步骤"面板，按分组展示所有可用步骤类型，点击后调用 onAddStep 回调。
 */

import {
	GROUP_COLORS,
	KIND_LABELS,
	PALETTE_DOT_COLORS,
	PALETTE_GROUPS,
} from '@/entities/automation/model/step-registry';
import { ScrollArea } from '@/components/ui/scroll-area';

type Props = {
	/** 点击步骤按钮时的回调，参数为步骤种类字符串（kind） */
	onAddStep: (kind: string) => void;
};

/**
 * 步骤调色板侧栏
 * 宽度固定为 w-44，按分组列出所有步骤，点击后通知外层添加节点。
 */
export function StepPalette({ onAddStep }: Props) {
	return (
		<div className="w-44 border-r flex-shrink-0 bg-background flex flex-col min-h-0">
			{/* 标题 */}
			<div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground border-b uppercase tracking-wide flex-shrink-0">
				添加步骤
			</div>

			{/* 步骤列表（可滚动） */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-3">
					{PALETTE_GROUPS.map((group) => (
						<div key={group.label}>
							{/* 分组标签 */}
							<div className="px-0.5 mb-1.5">
								<span
									className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border ${GROUP_COLORS[group.label] ?? GROUP_COLORS['通用']}`}
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
				</div>
			</ScrollArea>
		</div>
	);
}
