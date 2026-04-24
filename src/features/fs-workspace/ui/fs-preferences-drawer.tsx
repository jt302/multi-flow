import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { FolderCog, FolderOpen, FolderPlus, FolderTree, Save, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod/v3';

import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import {
	Badge,
	Button,
	Card,
	CardContent,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from '@/components/ui';
import { fsWorkspaceApi } from '@/entities/fs-workspace/api/fs-workspace-api';
import type { FsWhitelistEntry } from '@/entities/fs-workspace/model/types';
import { queryKeys } from '@/shared/config/query-keys';

interface Props {
	open: boolean;
	onClose: () => void;
}

const sandboxFormSchema = z.object({
	path: z.string(),
});

const whitelistFormSchema = (t: (key: string, options?: Record<string, unknown>) => string) =>
	z.object({
		label: z.string().trim().min(1, t('fileSystem.labelRequired')),
		path: z.string().trim().min(1, t('fileSystem.pathRequired')),
	});

type SandboxFormValues = z.infer<typeof sandboxFormSchema>;
type WhitelistFormValues = z.infer<ReturnType<typeof whitelistFormSchema>>;

function pickResultToPath(result: string | string[] | null) {
	if (!result) return null;
	return Array.isArray(result) ? (result[0] ?? null) : result;
}

function buildLabelFromPath(path: string) {
	return path.split('/').filter(Boolean).pop() ?? path;
}

export function FsPreferencesDrawer({ open, onClose }: Props) {
	const { t } = useTranslation(['chat', 'common']);
	const qc = useQueryClient();
	const [pendingRemoveEntry, setPendingRemoveEntry] = useState<FsWhitelistEntry | null>(null);

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

	const whitelist = whitelistQuery.data ?? [];

	const sandboxForm = useForm<SandboxFormValues>({
		resolver: zodResolver(sandboxFormSchema),
		defaultValues: { path: '' },
	});

	const whitelistForm = useForm<WhitelistFormValues>({
		resolver: zodResolver(whitelistFormSchema(t)),
		defaultValues: {
			label: '',
			path: '',
		},
	});

	useEffect(() => {
		if (!open) return;
		sandboxForm.reset({
			path: sandboxQuery.data ?? '',
		});
	}, [open, sandboxForm, sandboxQuery.data]);

	useEffect(() => {
		if (!open) return;
		whitelistForm.reset({
			label: '',
			path: '',
		});
	}, [open, whitelistForm]);

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
			whitelistForm.reset({ label: '', path: '' });
			toast.success(t('fileSystem.entryAdded'));
		},
		onError: (e) => toast.error(String(e)),
	});

	const removeMut = useMutation({
		mutationFn: (id: string) => fsWorkspaceApi.removeWhitelistEntry(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['fs-whitelist'] });
			qc.invalidateQueries({ queryKey: queryKeys.fsRoots });
			setPendingRemoveEntry(null);
			toast.success(t('fileSystem.entryRemoved'));
		},
		onError: (e) => toast.error(String(e)),
	});

	const handlePickSandboxRoot = async () => {
		const selected = pickResultToPath(
			await openDialog({
				directory: true,
				multiple: false,
				title: t('fileSystem.pickSandboxRoot'),
			}),
		);
		if (!selected) return;
		sandboxForm.setValue('path', selected, { shouldDirty: true });
	};

	const handlePickWhitelistPath = async () => {
		const selected = pickResultToPath(
			await openDialog({
				directory: true,
				multiple: false,
				title: t('fileSystem.pickWhitelistPath'),
			}),
		);
		if (!selected) return;

		whitelistForm.setValue('path', selected, { shouldValidate: true, shouldDirty: true });
		if (!whitelistForm.getValues('label').trim()) {
			whitelistForm.setValue('label', buildLabelFromPath(selected), {
				shouldValidate: true,
				shouldDirty: true,
			});
		}
	};

	const sandboxPath = sandboxForm.watch('path');
	const currentSandboxPath = sandboxQuery.data ?? '';
	const hasCustomSandbox = currentSandboxPath.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={(value) => !value && onClose()}>
			<DialogContent className="grid max-h-[85vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
				<DialogHeader className="border-b border-border/50 px-5 py-4">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-primary/8 p-2 text-primary">
							<FolderCog className="h-4 w-4" />
						</div>
						<div className="space-y-1">
							<DialogTitle>{t('fileSystem.preferences')}</DialogTitle>
							<DialogDescription>{t('fileSystem.preferencesDescription')}</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
					<div className="space-y-3">
						<Card className="gap-0 rounded-2xl border-border/50 bg-card shadow-none">
							<CardContent className="space-y-4 px-4 py-4">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="flex items-center gap-2 text-sm font-medium">
											<FolderTree className="h-4 w-4 text-primary" />
											{t('fileSystem.sandboxRoot')}
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{t('fileSystem.sandboxCardDescription')}
										</p>
									</div>
									<Badge variant={hasCustomSandbox ? 'outline' : 'secondary'}>
										{hasCustomSandbox
											? t('fileSystem.customRootMode')
											: t('fileSystem.defaultRootMode')}
									</Badge>
								</div>

								<Form {...sandboxForm}>
									<form
										className="space-y-3"
										onSubmit={sandboxForm.handleSubmit(async (values) => {
											await setSandboxMut.mutateAsync(values.path.trim() || null);
										})}
									>
										<FormField
											control={sandboxForm.control}
											name="path"
											render={({ field }) => (
												<FormItem>
													<FormLabel>{t('fileSystem.sandboxPathLabel')}</FormLabel>
													<div className="flex gap-2">
														<FormControl>
															<Input
																{...field}
																placeholder={t('fileSystem.sandboxRootPlaceholder')}
																className="font-mono text-xs"
															/>
														</FormControl>
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="shrink-0"
															onClick={handlePickSandboxRoot}
														>
															<FolderOpen className="h-4 w-4" />
															{t('common:selectFolder')}
														</Button>
													</div>
													<FormDescription>{t('fileSystem.sandboxRootHint')}</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => sandboxForm.reset({ path: '' })}
												disabled={!sandboxPath && !sandboxForm.formState.isDirty}
											>
												{t('fileSystem.restoreDefault')}
											</Button>
											<Button type="submit" size="sm" disabled={setSandboxMut.isPending}>
												<Save className="h-4 w-4" />
												{t('common:save')}
											</Button>
										</div>
									</form>
								</Form>
							</CardContent>
						</Card>

						<Card className="gap-0 rounded-2xl border-border/50 bg-card shadow-none">
							<CardContent className="space-y-4 px-4 py-4">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="flex items-center gap-2 text-sm font-medium">
											<Shield className="h-4 w-4 text-primary" />
											{t('fileSystem.whitelist')}
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{t('fileSystem.whitelistCardDescription')}
										</p>
									</div>
									<div className="text-xs text-muted-foreground">
										{t('fileSystem.whitelistCount', { count: whitelist.length })}
									</div>
								</div>

								<Form {...whitelistForm}>
									<form
										className="space-y-3"
										onSubmit={whitelistForm.handleSubmit(async (values) => {
											await addMut.mutateAsync({
												id: crypto.randomUUID(),
												label: values.label.trim(),
												path: values.path.trim(),
												allowWrite: false,
											});
										})}
									>
										<div className="grid gap-3 sm:grid-cols-[168px_minmax(0,1fr)]">
											<FormField
												control={whitelistForm.control}
												name="label"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t('common:name')}</FormLabel>
														<FormControl>
															<Input {...field} placeholder={t('fileSystem.labelPlaceholder')} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={whitelistForm.control}
												name="path"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t('fileSystem.pathLabel')}</FormLabel>
														<div className="flex gap-2">
															<FormControl>
																<Input
																	{...field}
																	placeholder={t('fileSystem.pathPlaceholder')}
																	className="font-mono text-xs"
																/>
															</FormControl>
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="shrink-0"
																onClick={handlePickWhitelistPath}
															>
																<FolderOpen className="h-4 w-4" />
																{t('common:selectFolder')}
															</Button>
														</div>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>

										<p className="col-span-full text-xs text-muted-foreground">
											{t('fileSystem.whitelistTip')}
										</p>

										<div className="col-span-full flex justify-end">
											<Button type="submit" size="sm" disabled={addMut.isPending}>
												<FolderPlus className="h-4 w-4" />
												{t('fileSystem.addEntry')}
											</Button>
										</div>
									</form>
								</Form>

								{whitelistQuery.isLoading ? (
									<div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
										{t('fileSystem.loading')}
									</div>
								) : whitelist.length === 0 ? (
									<div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-7 text-center">
										<div className="text-sm font-medium">{t('fileSystem.whitelistEmptyTitle')}</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{t('fileSystem.whitelistEmpty')}
										</p>
									</div>
								) : (
									<div className="space-y-2 border-t border-border/40 pt-3">
										{whitelist.map((entry) => (
											<div
												key={entry.id}
												className="flex items-start gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5"
											>
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<div className="text-sm font-medium">{entry.label}</div>
														<Badge variant="outline" className="text-[11px]">
															{entry.allowWrite
																? t('fileSystem.readWrite')
																: t('fileSystem.readOnlyLabel')}
														</Badge>
													</div>
													<div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
														{entry.path}
													</div>
												</div>
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													className="shrink-0 text-muted-foreground hover:text-destructive"
													onClick={() => setPendingRemoveEntry(entry)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
				<ConfirmActionDialog
					open={pendingRemoveEntry !== null}
					onOpenChange={(open) => {
						if (!open) setPendingRemoveEntry(null);
					}}
					title={t('common:confirmDelete')}
					description={t('fileSystem.confirmRemoveEntry', {
						label: pendingRemoveEntry?.label ?? '',
					})}
					confirmText={t('common:delete')}
					pending={removeMut.isPending}
					onConfirm={() => {
						if (!pendingRemoveEntry) return;
						removeMut.mutate(pendingRemoveEntry.id);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}
