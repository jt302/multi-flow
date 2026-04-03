import type { AutomationScript } from '@/entities/automation/model/types';
import { resolveScriptFlowEntryState } from '@/entities/automation/model/script-flow-entry';
import { cn } from '@/lib/utils';

type Props = {
	script: AutomationScript;
	isSelected: boolean;
	onClick: () => void;
};

/** 侧边栏单条脚本列表项 */
export function ScriptListItem({ script, isSelected, onClick }: Props) {
	const flowEntryState = resolveScriptFlowEntryState(script);

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onClick();
			}}
			className={cn(
				'w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer',
				isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
			)}
		>
			<div className="font-medium truncate">{script.name}</div>
			<div className="text-xs text-muted-foreground mt-0.5">
				{script.steps.length} 步骤
				{!flowEntryState.entryConnected && ' · 入口未连接'}
				{flowEntryState.orphanedStepCount > 0 &&
					` · ${flowEntryState.orphanedStepCount} 孤立`}
				{(script.associatedProfileIds?.length ?? 0) > 0 &&
					` · ${script.associatedProfileIds!.length} 环境`}
			</div>
		</div>
	);
}
