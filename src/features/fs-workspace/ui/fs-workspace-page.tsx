import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Folder, FileText, FolderPlus, Trash2, ChevronRight, Settings } from 'lucide-react';
import { z } from 'zod/v3';

import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Textarea,
} from '@/components/ui';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
import {
	useFsRootsQuery,
	useFsDirQuery,
	useFsDescriptionQuery,
} from '@/entities/fs-workspace/model/use-fs-workspace-query';
import {
	useCreateFolder,
	useDeleteEntry,
	useSaveDescription,
} from '../model/use-fs-workspace-mutations';
import { FsPreferencesDrawer } from './fs-preferences-drawer';
import type { FsRoot } from '@/entities/fs-workspace/model/types';

const createFolderSchema = (t: (key: string) => string) =>
	z.object({
		name: z.string().trim().min(1, t('fileSystem.folderNameRequired')),
	});

type CreateFolderValues = z.infer<ReturnType<typeof createFolderSchema>>;

export function FsWorkspacePage() {
	const { t } = useTranslation('chat');
	const { defaultLayout, onLayoutChanged } = usePersistentLayout({
		id: 'fs-workspace-layout',
		defaultSizes: [20, 40, 40],
	});

	const [selectedRoot, setSelectedRoot] = useState<FsRoot | null>(null);
	const [currentPath, setCurrentPath] = useState('.');
	const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null);
	const [selectedEntryIsDir, setSelectedEntryIsDir] = useState(false);
	const [descDraft, setDescDraft] = useState('');
	const [descDirty, setDescDirty] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [createFolderOpen, setCreateFolderOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<{ relPath: string; name: string } | null>(null);

	const rootsQuery = useFsRootsQuery();
	const roots = rootsQuery.data ?? [];

	// 默认选中第一个根
	useEffect(() => {
		if (roots.length > 0 && !selectedRoot) {
			setSelectedRoot(roots[0]);
		}
	}, [roots, selectedRoot]);

	const dirQuery = useFsDirQuery(selectedRoot?.id ?? '', currentPath);
	const entries = dirQuery.data ?? [];

	const descQuery = useFsDescriptionQuery(
		selectedRoot?.id ?? '',
		selectedEntryPath ?? '.',
		!!selectedEntryPath && selectedEntryIsDir,
	);

	useEffect(() => {
		const text = descQuery.data ?? '';
		setDescDraft(text);
		setDescDirty(false);
	}, [descQuery.data]);

	const createFolder = useCreateFolder();
	const deleteEntry = useDeleteEntry();
	const saveDesc = useSaveDescription();

	const createFolderForm = useForm<CreateFolderValues>({
		resolver: zodResolver(createFolderSchema(t)),
		defaultValues: {
			name: '',
		},
	});

	const handleCreateFolder = () => {
		if (!selectedRoot?.allowWrite) return;
		createFolderForm.reset({ name: '' });
		setCreateFolderOpen(true);
	};

	const handleDelete = (relPath: string, name: string) => {
		if (!selectedRoot) return;
		setPendingDelete({ relPath, name });
	};

	const handleConfirmDelete = () => {
		if (!selectedRoot || !pendingDelete) return;
		deleteEntry.mutate(
			{ rootId: selectedRoot.id, relPath: pendingDelete.relPath },
			{
				onSuccess: () => {
					if (selectedEntryPath === pendingDelete.relPath) {
						setSelectedEntryPath(null);
					}
					setPendingDelete(null);
				},
				onError: (e) => toast.error(String(e)),
			},
		);
	};

	const handleSaveDesc = () => {
		if (!selectedRoot || !selectedEntryPath) return;
		saveDesc.mutate(
			{ rootId: selectedRoot.id, relPath: selectedEntryPath, text: descDraft },
			{
				onSuccess: () => {
					toast.success(t('fileSystem.descSaved'));
					setDescDirty(false);
				},
				onError: (e) => toast.error(String(e)),
			},
		);
	};

	// 面包屑路径段
	const breadcrumbs = currentPath === '.' ? [] : currentPath.split('/');

	const navigateTo = (path: string) => {
		setCurrentPath(path);
		setSelectedEntryPath(null);
	};

	const selectedRootLabel =
		selectedRoot?.isDefault ? t('fileSystem.defaultRootLabel') : selectedRoot?.label;

	return (
		<>
			<ResizablePanelGroup
				direction="horizontal"
				className="h-full"
				defaultLayout={defaultLayout}
				onLayoutChanged={onLayoutChanged}
			>
				{/* 左栏: 根列表 */}
				<ResizablePanel id="fs-roots-panel" defaultSize={20} minSize={15} maxSize={35}>
					<div className="flex h-full flex-col">
						<div className="flex items-center justify-between border-b px-3 py-2">
							<span className="text-xs font-medium text-muted-foreground">
								{t('fileSystem.roots')}
							</span>
							<Button
								size="icon"
								variant="ghost"
								className="h-6 w-6 cursor-pointer"
								onClick={() => setDrawerOpen(true)}
							>
								<Settings className="h-3.5 w-3.5" />
							</Button>
						</div>
						<div className="flex-1 overflow-auto">
							{roots.map((root) => (
								<div
									key={root.id}
									onClick={() => {
										setSelectedRoot(root);
										navigateTo('.');
									}}
									className={cn(
										'cursor-pointer border-b px-3 py-2.5 hover:bg-accent/50',
										selectedRoot?.id === root.id && 'bg-accent',
									)}
								>
									<div className="truncate text-sm font-medium">
										{root.isDefault ? t('fileSystem.defaultRootLabel') : root.label}
									</div>
									<div className="truncate text-xs text-muted-foreground">{root.pathDisplay}</div>
									{!root.allowWrite && (
										<div className="mt-0.5 text-xs text-amber-600">{t('fileSystem.readOnly')}</div>
									)}
								</div>
							))}
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle />

				{/* 中栏: 目录内容 */}
				<ResizablePanel id="fs-directory-panel" defaultSize={40} minSize={25}>
					<div className="flex h-full flex-col">
						{/* 面包屑 */}
						<div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2 text-xs text-muted-foreground">
							<button
								type="button"
								onClick={() => navigateTo('.')}
								className="shrink-0 cursor-pointer hover:text-foreground"
							>
								{selectedRootLabel ?? t('fileSystem.root')}
							</button>
							{breadcrumbs.map((crumb, i) => {
								const path = breadcrumbs.slice(0, i + 1).join('/');
								return (
									<span key={path} className="flex shrink-0 items-center gap-1">
										<ChevronRight className="h-3 w-3" />
										<button
											type="button"
											onClick={() => navigateTo(path)}
											className="cursor-pointer hover:text-foreground"
										>
											{crumb}
										</button>
									</span>
								);
							})}
						</div>

						{/* 工具栏 */}
						{selectedRoot?.allowWrite && (
							<div className="flex items-center gap-1 border-b px-3 py-1.5">
								<Button
									size="sm"
									variant="ghost"
									className="h-7 cursor-pointer gap-1 text-xs"
									onClick={handleCreateFolder}
								>
									<FolderPlus className="h-3.5 w-3.5" />
									{t('fileSystem.newFolder')}
								</Button>
							</div>
						)}

						{/* 条目列表 */}
						<div className="flex-1 overflow-auto">
							{dirQuery.isLoading && (
								<div className="p-4 text-sm text-muted-foreground">{t('fileSystem.loading')}</div>
							)}
							{entries.map((entry) => (
								<div
									key={entry.relPath}
									onClick={() => {
										setSelectedEntryPath(entry.relPath);
										setSelectedEntryIsDir(entry.isDir);
									}}
									onDoubleClick={() => {
										if (entry.isDir) navigateTo(entry.relPath);
									}}
									className={cn(
										'group flex cursor-pointer items-center gap-2 border-b px-3 py-2 hover:bg-accent/50',
										selectedEntryPath === entry.relPath && 'bg-accent',
									)}
								>
									{entry.isDir ? (
										<Folder className="h-4 w-4 shrink-0 text-amber-500" />
									) : (
										<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
									)}
									<span className="flex-1 truncate text-sm">{entry.name}</span>
									{entry.hasDescription && (
										<span className="text-xs text-primary/70">
											{t('fileSystem.hasDescriptionBadge')}
										</span>
									)}
									{selectedRoot?.allowWrite && (
										<Button
											size="icon"
											variant="ghost"
											className="h-6 w-6 shrink-0 cursor-pointer opacity-0 hover:opacity-100 group-hover:opacity-100"
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(entry.relPath, entry.name);
											}}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									)}
								</div>
							))}
							{!dirQuery.isLoading && entries.length === 0 && (
								<div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
									{t('fileSystem.emptyDir')}
								</div>
							)}
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle />

				{/* 右栏: 说明编辑 */}
				<ResizablePanel id="fs-description-panel" defaultSize={40} minSize={25}>
					<div className="flex h-full flex-col">
						<div className="border-b px-3 py-2">
							<span className="text-xs font-medium text-muted-foreground">
								{selectedEntryPath && selectedEntryIsDir
									? t('fileSystem.descriptionFor', {
											name: selectedEntryPath.split('/').pop(),
										})
									: t('fileSystem.selectDirectory')}
							</span>
						</div>
						{selectedEntryPath && selectedEntryIsDir ? (
							<div className="flex flex-1 flex-col gap-2 overflow-auto p-3">
								<Textarea
									value={descDraft}
									onChange={(e) => {
										setDescDraft(e.target.value);
										setDescDirty(true);
									}}
									placeholder={t('fileSystem.descPlaceholder')}
									className="flex-1 resize-none font-mono text-sm"
								/>
								<div className="flex justify-end">
									<Button
										size="sm"
										disabled={!descDirty || saveDesc.isPending}
										onClick={handleSaveDesc}
										className="cursor-pointer"
									>
										{t('common:save')}
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
								{t('fileSystem.selectDirHint')}
							</div>
						)}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>

			<FsPreferencesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
			<Dialog
				open={createFolderOpen}
				onOpenChange={(open) => {
					setCreateFolderOpen(open);
					if (!open) {
						createFolderForm.reset({ name: '' });
					}
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{t('fileSystem.createFolderTitle')}</DialogTitle>
						<DialogDescription>{t('fileSystem.createFolderDescription')}</DialogDescription>
					</DialogHeader>
					<Form {...createFolderForm}>
						<form
							className="space-y-4"
							onSubmit={createFolderForm.handleSubmit(async (values) => {
								if (!selectedRoot) return;
								const name = values.name.trim();
								const newPath = currentPath === '.' ? name : `${currentPath}/${name}`;
								createFolder.mutate(
									{ rootId: selectedRoot.id, relPath: newPath },
									{
										onSuccess: () => {
											setCreateFolderOpen(false);
											createFolderForm.reset({ name: '' });
										},
										onError: (e) => toast.error(String(e)),
									},
								);
							})}
						>
							<FormField
								control={createFolderForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('fileSystem.folderNameLabel')}</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder={t('fileSystem.folderNamePlaceholder')}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button
									type="button"
									variant="ghost"
									onClick={() => setCreateFolderOpen(false)}
									disabled={createFolder.isPending}
								>
									{t('common:cancel')}
								</Button>
								<Button type="submit" disabled={createFolder.isPending}>
									{t('fileSystem.newFolder')}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
			<ConfirmActionDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title={t('common:confirmDelete')}
				description={t('fileSystem.confirmDelete', { name: pendingDelete?.name ?? '' })}
				confirmText={t('common:delete')}
				pending={deleteEntry.isPending}
				onConfirm={handleConfirmDelete}
			/>
		</>
	);
}
