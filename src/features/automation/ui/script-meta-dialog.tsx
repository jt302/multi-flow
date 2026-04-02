import { useEffect, useState } from 'react';

import { Plus, X } from 'lucide-react';

import type {
  AiConfigEntry,
  AutomationScript,
} from '@/entities/automation/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = 新建模式，有值 = 编辑模式 */
  script: AutomationScript | null;
  allProfiles: ProfileItem[];
  aiConfigs: AiConfigEntry[];
  /** 所有已存在的脚本名称，用于重复检测 */
  existingNames: string[];
  onSave: (data: {
    name: string;
    description: string;
    associatedProfileIds: string[];
    aiConfigId: string | null;
  }) => void;
  isSaving: boolean;
};

/** 脚本元数据新建/编辑对话框 */
export function ScriptMetaDialog({
  open,
  onOpenChange,
  script,
  allProfiles,
  aiConfigs,
  existingNames,
  onSave,
  isSaving,
}: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [associatedIds, setAssociatedIds] = useState<string[]>([]);
  const [aiConfigId, setAiConfigId] = useState<string | null>(null);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);

  // 每次对话框打开时同步脚本数据
  useEffect(() => {
    if (open) {
      setName(script?.name ?? '');
      setDesc(script?.description ?? '');
      setAssociatedIds(script?.associatedProfileIds ?? []);
      setAiConfigId(script?.aiConfigId ?? null);
      setProfilePickerOpen(false);
    }
  }, [open, script]);

  const associatedProfiles = associatedIds
    .map((id) => allProfiles.find((p) => p.id === id))
    .filter((p): p is ProfileItem => p !== undefined);

  const availableProfiles = allProfiles.filter(
    (p) => !associatedIds.includes(p.id),
  );

  function bindProfile(profileId: string) {
    setAssociatedIds((prev) =>
      prev.includes(profileId) ? prev : [...prev, profileId],
    );
    setProfilePickerOpen(false);
  }

  function unbindProfile(profileId: string) {
    setAssociatedIds((prev) => prev.filter((id) => id !== profileId));
  }

  const trimmedName = name.trim();
  const isDuplicate =
    trimmedName !== '' &&
    existingNames.some(
      (n) =>
        n.toLowerCase() === trimmedName.toLowerCase() &&
        n.toLowerCase() !== (script?.name ?? '').toLowerCase(),
    );

  function handleSave() {
    if (!trimmedName || isDuplicate) return;
    onSave({
      name: trimmedName,
      description: desc,
      associatedProfileIds: associatedIds,
      aiConfigId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>{script ? '编辑脚本信息' : '新建脚本'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 min-h-0 px-0.5">
          {/* 脚本名称 */}
          <div className="space-y-1.5">
            <Label>脚本名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入脚本名称"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
              className={isDuplicate ? 'border-destructive' : ''}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">该名称已被其他脚本使用</p>
            )}
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label>描述（可选）</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="描述这个脚本的用途"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* 关联环境 */}
          {allProfiles.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm">关联环境</Label>
              <p className="text-xs text-muted-foreground">
                先在这里绑定环境，运行时再勾选本次要执行的环境
              </p>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {associatedProfiles.length > 0 ? (
                    associatedProfiles.map((profile) => (
                      <Badge
                        key={profile.id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <span className="max-w-45 truncate">{profile.name}</span>
                        <button
                          type="button"
                          onClick={() => unbindProfile(profile.id)}
                          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                          aria-label={`移除环境 ${profile.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground px-1 py-1">
                      当前未绑定环境
                    </p>
                  )}
                </div>
                <Popover
                  open={profilePickerOpen}
                  onOpenChange={setProfilePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={availableProfiles.length === 0}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      添加环境
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-70 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="搜索环境名称..." />
                      <CommandList>
                        <CommandEmpty>没有可绑定的环境</CommandEmpty>
                        {availableProfiles.map((profile) => (
                          <CommandItem
                            key={profile.id}
                            onSelect={() => bindProfile(profile.id)}
                          >
                            {profile.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* AI 配置 */}
          <div className="space-y-1.5">
            <Label className="text-sm">AI 配置（可选）</Label>
            <p className="text-xs text-muted-foreground">
              {aiConfigs.length > 0
                ? '留空则使用全局 AI 配置'
                : '请先在设置中添加 AI 配置，或继续使用全局默认配置'}
            </p>
            <Select
              value={aiConfigId ?? '__none__'}
              onValueChange={(v) =>
                setAiConfigId(v === '__none__' ? null : v)
              }
              disabled={aiConfigs.length === 0}
            >
              <SelectTrigger className="h-9 text-sm cursor-pointer disabled:cursor-not-allowed">
                <SelectValue
                  placeholder={
                    aiConfigs.length > 0 ? '使用全局配置' : '请先添加 AI 配置'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="cursor-pointer">
                  使用全局配置
                </SelectItem>
                {aiConfigs.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                    {c.name}
                    {c.model ? ` (${c.model})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!trimmedName || isDuplicate || isSaving}
            className="cursor-pointer"
          >
            {script ? '保存' : '创建并打开流程编辑'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
