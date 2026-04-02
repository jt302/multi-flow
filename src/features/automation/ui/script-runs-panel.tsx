import { useState } from 'react';

import { Trash2, X } from 'lucide-react';

import {
  clearAutomationRuns,
  deleteAutomationRun,
} from '@/entities/automation/api/automation-api';
import type { AutomationRun } from '@/entities/automation/model/types';
import { RunStatusBadge } from '@/entities/automation/ui/run-status-badge';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { RunDetailView, RunRow } from './script-run-card';

type Props = {
  runs: AutomationRun[];
  scriptId: string;
  scriptName: string;
  onRunsChange: () => void;
};

/** 运行历史面板：列表/详情分栏模式，支持删除/清空/全屏查看 */
export function ScriptRunsPanel({
  runs,
  scriptId,
  scriptName,
  onRunsChange,
}: Props) {
  const [sheetRunId, setSheetRunId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);

  const sheetRun = runs.find((r) => r.id === sheetRunId) ?? null;

  return (
    <>
      <div className="flex flex-col h-full">
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
              {/* 清空按钮 */}
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
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    onSelect={() => setSheetRunId(run.id)}
                    onDelete={() => setDeleteRunId(run.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ─── 全屏 Sheet ──────────────────────────────────────────────────── */}
      <Sheet open={sheetRun !== null} onOpenChange={(open) => { if (!open) setSheetRunId(null); }}>
        <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0" showCloseButton={false}>
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm font-medium">
              {sheetRun && <RunStatusBadge status={sheetRun.status} />}
              <span className="text-muted-foreground font-normal">
                {sheetRun
                  ? new Date(sheetRun.startedAt * 1000).toLocaleString()
                  : ''}
              </span>
              {sheetRun?.finishedAt && (
                <span className="text-[10px] text-muted-foreground/60">
                  {((sheetRun.finishedAt - sheetRun.startedAt) / 1).toFixed(1)}s
                </span>
              )}
              <div className="flex-1" />
              {sheetRun && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
                  title="删除此记录"
                  onClick={() => setDeleteRunId(sheetRun.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="关闭"
                onClick={() => setSheetRunId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </SheetTitle>
          </SheetHeader>
          {sheetRun && <RunDetailView run={sheetRun} expanded />}
        </SheetContent>
      </Sheet>

      {/* ─── 清空确认 ────────────────────────────────────────────────────── */}
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
                  setSheetRunId(null);
                  onRunsChange();
                }}
              >
                清空
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 删除单条确认 ────────────────────────────────────────────────── */}
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
                    if (sheetRunId === deleteRunId) setSheetRunId(null);
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
