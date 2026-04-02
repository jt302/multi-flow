import { useState } from 'react';

import { Trash2 } from 'lucide-react';

import {
  clearAutomationRuns,
  deleteAutomationRun,
} from '@/entities/automation/api/automation-api';
import type { AutomationRun } from '@/entities/automation/model/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScriptRunCard } from './script-run-card';

type Props = {
  runs: AutomationRun[];
  scriptId: string;
  scriptName: string;
  onRunsChange: () => void;
};

/** 运行历史面板：展示所有运行记录，支持展开/删除/清空 */
export function ScriptRunsPanel({
  runs,
  scriptId,
  scriptName,
  onRunsChange,
}: Props) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);

  return (
    <>
      <ScrollArea className="h-full">
        {runs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">暂无运行记录</p>
            <p className="text-xs text-muted-foreground mt-1">
              运行脚本后，执行记录和详细日志将显示在这里
            </p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {/* 清空所有记录按钮 */}
            <div className="flex items-center justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-red-500 cursor-pointer"
                onClick={() => setClearAllOpen(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                清空所有记录
              </Button>
            </div>

            <div className="space-y-1.5">
              {runs.map((run, runIdx) => (
                <ScriptRunCard
                  key={run.id}
                  run={run}
                  runIndex={runIdx}
                  isExpanded={expandedRunId === run.id}
                  onToggle={() =>
                    setExpandedRunId(
                      expandedRunId === run.id ? null : run.id,
                    )
                  }
                  onDelete={() => setDeleteRunId(run.id)}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* 清空所有记录确认弹窗 */}
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有运行记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空脚本「{scriptName}」的所有 {runs.length}{' '}
              条运行记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost" className="cursor-pointer">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer"
                onClick={async () => {
                  await clearAutomationRuns(scriptId);
                  setExpandedRunId(null);
                  onRunsChange();
                }}
              >
                清空
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除单条记录确认弹窗 */}
      <AlertDialog
        open={deleteRunId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRunId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条运行记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost" className="cursor-pointer">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer"
                onClick={async () => {
                  if (deleteRunId) {
                    await deleteAutomationRun(deleteRunId);
                    setExpandedRunId((prev) =>
                      prev === deleteRunId ? null : prev,
                    );
                    onRunsChange();
                  }
                  setDeleteRunId(null);
                }}
              >
                删除
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
