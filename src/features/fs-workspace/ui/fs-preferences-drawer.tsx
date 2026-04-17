import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fsWorkspaceApi } from '@/entities/fs-workspace/api/fs-workspace-api';
import { queryKeys } from '@/shared/config/query-keys';
import type { FsWhitelistEntry } from '@/entities/fs-workspace/model/types';

interface Props {
	open: boolean;
	onClose: () => void;
}

export function FsPreferencesDrawer({ open, onClose }: Props) {
	const { t } = useTranslation('chat');
	const qc = useQueryClient();

	const sandboxQuery = useQuery({
		queryKey: ['fs-sandbox-root'],
		queryFn: fsWorkspaceApi.getSandboxRoot,
		enabled: open,
	});

	const whitelistQuery = useQuery({
		queryKey: ['fs-whitelist'],
		queryFn: fsWorkspaceApi.getWhitelist,
		enabled: open,
	});

	const [sandboxDraft, setSandboxDraft] = useState('');
	const whitelist = whitelistQuery.data ?? [];

	useEffect(() => {
		setSandboxDraft(sandboxQuery.data ?? '');
	}, [sandboxQuery.data]);

	const setSandboxMut = useMutation({
		mutationFn: (path: string | null) => fsWorkspaceApi.setSandboxRoot(path),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.fsRoots });
			qc.invalidateQueries({ queryKey: ['fs-sandbox-root'] });
			toast.success(t('fileSystem.saved'));
		},
		onError: (e) => toast.error(String(e)),
	});

	const addMut = useMutation({
		mutationFn: (entry: FsWhitelistEntry) => fsWorkspaceApi.addWhitelistEntry(entry),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['fs-whitelist'] });
			qc.invalidateQueries({ queryKey: queryKeys.fsRoots });
		},
		onError: (e) => toast.error(String(e)),
	});

	const removeMut = useMutation({
		mutationFn: (id: string) => fsWorkspaceApi.removeWhitelistEntry(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['fs-whitelist'] });
			qc.invalidateQueries({ queryKey: queryKeys.fsRoots });
		},
		onError: (e) => toast.error(String(e)),
	});

	const handleAddEntry = () => {
		const path = prompt(t('fileSystem.enterPath'));
		if (!path?.trim()) return;
		const label = prompt(t('fileSystem.enterLabel')) ?? path.split('/').pop() ?? path;
		addMut.mutate({ id: crypto.randomUUID(), label: label.trim(), path: path.trim(), allowWrite: false });
	};

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent side="right" className="w-[400px]">
				<SheetHeader>
					<SheetTitle>{t('fileSystem.preferences')}</SheetTitle>
				</SheetHeader>
				<div className="mt-4 flex flex-col gap-6 overflow-auto">
					{/* 沙箱根路径 */}
					<div className="flex flex-col gap-2">
						<Label className="text-sm font-medium">{t('fileSystem.sandboxRoot')}</Label>
						<p className="text-xs text-muted-foreground">{t('fileSystem.sandboxRootHint')}</p>
						<div className="flex gap-2">
							<Input
								value={sandboxDraft}
								onChange={(e) => setSandboxDraft(e.target.value)}
								placeholder={t('fileSystem.sandboxRootPlaceholder')}
								className="text-sm"
							/>
							<Button
								variant="outline"
								size="sm"
								className="cursor-pointer shrink-0"
								onClick={() => setSandboxMut.mutate(sandboxDraft.trim() || null)}
								disabled={setSandboxMut.isPending}
							>
								{t('common:save')}
							</Button>
						</div>
					</div>

					{/* 外部白名单 */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label className="text-sm font-medium">{t('fileSystem.whitelist')}</Label>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 cursor-pointer gap-1 text-xs"
								onClick={handleAddEntry}
							>
								<Plus className="h-3.5 w-3.5" />
								{t('fileSystem.addEntry')}
							</Button>
						</div>
						{whitelist.length === 0 && (
							<p className="text-xs text-muted-foreground">{t('fileSystem.whitelistEmpty')}</p>
						)}
						{whitelist.map((entry) => (
							<div key={entry.id} className="flex items-center gap-2 rounded border p-2">
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium">{entry.label}</div>
									<div className="truncate text-xs text-muted-foreground">{entry.path}</div>
									<div className="text-xs text-muted-foreground">
										{entry.allowWrite ? t('fileSystem.readWrite') : t('fileSystem.readOnlyLabel')}
									</div>
								</div>
								<Button
									size="icon"
									variant="ghost"
									className="h-7 w-7 cursor-pointer shrink-0"
									onClick={() => {
										if (!confirm(t('fileSystem.confirmRemoveEntry', { label: entry.label }))) return;
										removeMut.mutate(entry.id);
									}}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						))}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
