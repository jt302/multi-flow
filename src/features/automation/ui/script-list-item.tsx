import { Network, Trash2 } from 'lucide-react';

import type { AutomationScript } from '@/entities/automation/model/types';
import { cn } from '@/lib/utils';

type Props = {
  script: AutomationScript;
  isSelected: boolean;
  onClick: () => void;
  onOpenCanvas: () => void;
  onDelete: () => void;
};

/** 侧边栏单条脚本列表项，悬停展示操作按钮 */
export function ScriptListItem({
  script,
  isSelected,
  onClick,
  onOpenCanvas,
  onDelete,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer group',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="font-medium truncate flex-1">{script.name}</div>
        {/* 悬停才显示的操作按钮 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCanvas();
            }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 cursor-pointer text-muted-foreground hover:text-foreground"
            title="打开画布"
          >
            <Network className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {script.steps.length} 步骤
        {(script.associatedProfileIds?.length ?? 0) > 0 &&
          ` · ${script.associatedProfileIds!.length} 环境`}
      </div>
    </button>
  );
}
