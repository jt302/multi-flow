import type { AutomationScript } from '@/entities/automation/model/types';
import { resolveScriptFlowEntryState } from '@/entities/automation/model/script-flow-entry';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type Props = {
	script: AutomationScript;
	isSelected: boolean;
	onClick: () => void;
};

/** 侧边栏单条脚本列表项 */
export function ScriptListItem({ script, isSelected, onClick }: Props) {
	const { t } = useTranslation('automation');
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
				'group w-full min-w-0 overflow-hidden text-left rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer',
				isSelected
					? 'bg-primary/10 text-primary'
					: 'hover:bg-muted',
			)}
		>
			<div className="flex items-start justify-between gap-2 min-w-0">
				<span className="truncate font-medium leading-5 min-w-0">{script.name}</span>
			</div>
			<div className="mt-0.5 text-[11px] text-muted-foreground">
				{t('detail.stepsShort', { count: script.steps.length })}
				{!flowEntryState.entryConnected && ` · ${t('detail.entryNotConnected')}`}
				{flowEntryState.orphanedStepCount > 0 &&
					` · ${t('detail.orphanedShort', { count: flowEntryState.orphanedStepCount })}`}
				{(script.associatedProfileIds?.length ?? 0) > 0 &&
					` · ${t('detail.profilesShort', { count: script.associatedProfileIds!.length })}`}
			</div>
		</div>
	);
}
