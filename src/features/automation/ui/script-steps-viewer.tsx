import { Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openAutomationCanvasWindow } from '@/entities/automation/api/automation-api';
import type { AutomationScript, StepResult } from '@/entities/automation/model/types';
import { buildResultMap, StepTreeRenderer } from './step-tree-renderer';

type Props = {
	steps: AutomationScript['steps'];
	isRunning: boolean;
	liveStepResults: StepResult[];
	liveVariables: Record<string, string>;
	scriptId: string;
	scriptName: string;
	entryConnected?: boolean;
};

/** 脚本步骤列表视图，支持实时运行状态和变量展示（递归树形分支结构） */
export function ScriptStepsViewer({
	steps,
	liveStepResults,
	liveVariables,
	scriptId,
	scriptName,
	entryConnected = true,
}: Props) {
	const { t } = useTranslation(['automation', 'common']);
	const resultMap = buildResultMap(liveStepResults);
	const varEntries = Object.entries(liveVariables);

	return (
		<ScrollArea className="flex-1 min-h-0">
			<div className="px-5 py-4">
				{!entryConnected && steps.length > 0 && (
					<div className="mb-3 rounded-md border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-800">
						{t('common:entryNotConnectedHint')}
					</div>
				)}
				{steps.length === 0 ? (
					<div className="text-center py-8 space-y-2">
						<p className="text-sm text-muted-foreground">{t('common:noSteps')}</p>
						<Button
							size="sm"
							variant="outline"
							className="cursor-pointer"
							onClick={() => openAutomationCanvasWindow(scriptId, scriptName)}
						>
							<Network className="h-3.5 w-3.5 mr-1.5" />
							{t('common:openFlowEditor')}
						</Button>
					</div>
				) : (
					<StepTreeRenderer steps={steps} resultMap={resultMap} />
				)}

				{/* 运行变量（内联在步骤下方） */}
				{varEntries.length > 0 && (
					<div className="mt-4 pt-3 border-t">
						<p className="text-xs font-medium text-muted-foreground mb-2">
							{t('common:runVarsWithCount', { count: varEntries.length })}
						</p>
						<div className="space-y-1">
							{varEntries.map(([key, value]) => (
								<div key={key} className="flex items-start gap-2 text-xs">
									<span className="font-mono text-blue-500 shrink-0">{key}</span>
									<span className="text-muted-foreground break-all">{String(value)}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</ScrollArea>
	);
}
