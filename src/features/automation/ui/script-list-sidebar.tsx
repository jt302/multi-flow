import { FileInput, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AutomationScript } from '@/entities/automation/model/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScriptListFilter } from '../model/use-script-list-filter';
import { ScriptListItem } from './script-list-item';

type Props = {
  scripts: AutomationScript[];
  selectedScriptId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
};

/** 自动化脚本左侧边栏：包含搜索框和脚本列表 */
export function ScriptListSidebar({
  scripts,
  selectedScriptId,
  onSelect,
  onNew,
  onImport,
}: Props) {
  const { t } = useTranslation('automation');
  const { filtered, searchQuery, setSearchQuery } =
    useScriptListFilter(scripts);

  return (
    <div className="w-64 shrink-0 border-r flex flex-col">
      {/* 顶部标题行 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-sm font-medium">{t('sidebar.title')}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 cursor-pointer"
            onClick={onImport}
            title={t('sidebar.import')}
          >
            <FileInput className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 cursor-pointer"
            onClick={onNew}
            title={t('sidebar.create')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 搜索框 */}
      {scripts.length > 0 && (
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder={t('sidebar.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 脚本列表 */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {scripts.length === 0 ? (
              <>
                <p>{t('sidebar.noScripts')}</p>
                <p className="mt-1">{t('sidebar.clickToCreate')}</p>
              </>
            ) : (
              <p>{t('sidebar.noMatches')}</p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((script) => (
              <ScriptListItem
                key={script.id}
                script={script}
                isSelected={selectedScriptId === script.id}
                onClick={() => onSelect(script.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

    </div>
  );
}
