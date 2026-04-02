import { useState } from 'react';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

import type { AutomationRun } from '@/entities/automation/model/types';
import { RunStatusBadge } from '@/entities/automation/ui/run-status-badge';
import { StepStatusIcon } from '@/entities/automation/ui/step-status-icon';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RunLogViewer } from './run-log-viewer';

type Props = {
  run: AutomationRun;
  /** 用于生成展开输出的唯一 key 前缀（run 在列表中的索引） */
  runIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

/** 单条运行记录卡片，可展开查看步骤结果和执行日志 */
export function ScriptRunCard({
  run,
  runIndex,
  isExpanded,
  onToggle,
  onDelete,
}: Props) {
  const [runDetailTab, setRunDetailTab] = useState<string>('results');
  const [expandedOutputIndex, setExpandedOutputIndex] = useState<number | null>(
    null,
  );

  return (
    <div
      className={`rounded-lg border ${isExpanded ? 'bg-card shadow-sm' : 'bg-muted/20'}`}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-3 px-3 py-2 text-xs">
        <button
          type="button"
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
          onClick={onToggle}
        >
          <RunStatusBadge status={run.status} />
          <span className="text-muted-foreground flex-1 min-w-0 truncate">
            {new Date(run.startedAt * 1000).toLocaleString()}
          </span>
          {run.finishedAt && (
            <span className="text-muted-foreground/60 text-[10px] shrink-0">
              {((run.finishedAt - run.startedAt) / 1).toFixed(1)}s
            </span>
          )}
          {run.error && !isExpanded && (
            <span className="text-red-500 truncate max-w-40">{run.error}</span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="删除此记录"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 展开内容（CSS 动画） */}
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="border-t">
            <Tabs
              value={runDetailTab}
              onValueChange={setRunDetailTab}
              className="w-full"
            >
              <TabsList className="mx-3 mt-2 mb-0 h-7 bg-muted/40">
                <TabsTrigger value="results" className="text-xs h-6 px-2.5">
                  步骤结果{run.results ? ` (${run.results.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs h-6 px-2.5">
                  执行日志
                  {run.logs && run.logs.length > 0 && (
                    <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded px-1">
                      {run.logs.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* 步骤结果 Tab */}
              <TabsContent
                value="results"
                className="px-3 pb-3 pt-2 space-y-2 mt-0"
              >
                {run.error && (
                  <div className="rounded bg-red-50 dark:bg-red-950/20 p-2">
                    <p className="text-xs text-red-500 font-medium mb-0.5">
                      错误信息
                    </p>
                    <p className="text-xs text-red-400 break-all whitespace-pre-wrap">
                      {run.error}
                    </p>
                  </div>
                )}
                {run.results && run.results.length > 0 ? (
                  <div className="space-y-1">
                    {run.results.map((r, resultIdx) => {
                      const stepDef = run.steps[r.index];
                      const outputKey = runIndex * 100_000 + resultIdx;
                      const isOutputExpanded = expandedOutputIndex === outputKey;
                      return (
                        <div
                          key={`${run.id}-${r.index}-${resultIdx}`}
                          className="text-xs bg-muted/40 rounded p-1.5 space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <StepStatusIcon status={r.status} />
                            <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs shrink-0">
                              {stepDef?.kind ?? `步骤 ${r.index + 1}`}
                            </span>
                            <span className="text-muted-foreground ml-auto shrink-0">
                              {r.durationMs}ms
                            </span>
                          </div>
                          {r.output && (
                            <div>
                              <p
                                className={`text-muted-foreground break-all ${isOutputExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}
                              >
                                {isOutputExpanded
                                  ? r.output
                                  : r.output.slice(0, 200)}
                              </p>
                              {r.output.length > 200 && (
                                <button
                                  type="button"
                                  className="text-blue-500 cursor-pointer text-xs mt-0.5 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedOutputIndex(
                                      isOutputExpanded ? null : outputKey,
                                    );
                                  }}
                                >
                                  {isOutputExpanded ? '收起' : '展开全部'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">暂无步骤结果</p>
                )}
              </TabsContent>

              {/* 执行日志 Tab */}
              <TabsContent value="logs" className="px-0 pb-0 pt-0 mt-0">
                <RunLogViewer
                  logs={run.logs ?? []}
                  runStartedAt={run.startedAt}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
