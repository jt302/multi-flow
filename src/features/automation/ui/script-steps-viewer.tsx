import { Network } from 'lucide-react';

import { openAutomationCanvasWindow } from '@/entities/automation/api/automation-api';
import type {
  AutomationScript,
  StepResult,
} from '@/entities/automation/model/types';
import { StepStatusIcon } from '@/entities/automation/ui/step-status-icon';
import { StepSummary } from '@/entities/automation/ui/step-summary';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type Props = {
  steps: AutomationScript['steps'];
  isRunning: boolean;
  liveStepResults: StepResult[];
  liveVariables: Record<string, string>;
  scriptId: string;
  scriptName: string;
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-500',
  failed: 'text-red-500',
  running: 'text-blue-500',
  pending: 'text-muted-foreground',
  skipped: 'text-muted-foreground',
  cancelled: 'text-muted-foreground',
};

/** 脚本步骤列表视图，支持实时运行状态和变量展示 */
export function ScriptStepsViewer({
  steps,
  liveStepResults,
  liveVariables,
  scriptId,
  scriptName,
}: Props) {
  const stepResultMap = new Map(liveStepResults.map((r) => [r.index, r]));
  const varEntries = Object.entries(liveVariables);

  return (
    <ScrollArea className="h-full">
      <div className="px-5 py-4">
        {steps.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">暂无步骤</p>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => openAutomationCanvasWindow(scriptId, scriptName)}
            >
              <Network className="h-3.5 w-3.5 mr-1.5" />
              在流程编辑器中编排步骤
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {steps.map((step, i) => {
              const result = stepResultMap.get(i);
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-sm"
                >
                  <StepStatusIcon status={result?.status ?? 'pending'} />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mr-2">
                      {step.kind}
                    </span>
                    <StepSummary step={step} />
                    {result?.output && (
                      <p
                        className="text-xs text-muted-foreground mt-1 truncate cursor-pointer hover:text-foreground"
                        title={result.output}
                        onClick={() => {
                          void navigator.clipboard.writeText(result.output!);
                        }}
                      >
                        {result.output.slice(0, 120)}
                        {result.output.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  {result && (
                    <span
                      className={`text-xs shrink-0 ${STATUS_COLORS[result.status]}`}
                    >
                      {result.durationMs}ms
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 运行变量（内联在步骤下方） */}
        {varEntries.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              运行变量 ({varEntries.length})
            </p>
            <div className="space-y-1">
              {varEntries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-blue-500 shrink-0">{key}</span>
                  <span className="text-muted-foreground break-all">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
