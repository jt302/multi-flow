import { useTranslation } from 'react-i18next';
import { FolderOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
	Badge,
	Button,
	Icon,
	Input,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import { DataSection, EmptyState } from '@/components/common';
import type { GroupItem } from '@/entities/group/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { getWorkspaceSections } from '@/app/model/workspace-sections';
import { useGroupManagementStore } from '@/store/group-management-store';
import type { GroupsPageProps } from '@/features/group/model/types';
import { GroupDeleteAlertDialog } from './group-delete-alert-dialog';
import { GroupFormDialog, type GroupFormValues } from './group-form-dialog';

export function GroupsPage({
	groups,
	onCreateGroup,
	onUpdateGroup,
	onDeleteGroup,
	onOpenGroupProfiles,
}: GroupsPageProps) {
	const { t } = useTranslation('group');
	const section = getWorkspaceSections().groups;
	const searchKeyword = useGroupManagementStore((state) => state.searchKeyword);
	const isFormOpen = useGroupManagementStore((state) => state.isFormOpen);
	const editingGroupId = useGroupManagementStore(
		(state) => state.editingGroupId,
	);
	const editorMode = useGroupManagementStore((state) => state.editorMode);
	const setSearchKeyword = useGroupManagementStore(
		(state) => state.setSearchKeyword,
	);
	const openCreateForm = useGroupManagementStore(
		(state) => state.openCreateForm,
	);
	const openEditForm = useGroupManagementStore((state) => state.openEditForm);
	const closeForm = useGroupManagementStore((state) => state.closeForm);
	const resetState = useGroupManagementStore((state) => state.reset);
	const [deletingGroup, setDeletingGroup] = useState<GroupItem | null>(null);

	const totalProfiles = useMemo(
		() => groups.reduce((total, item) => total + item.profileCount, 0),
		[groups],
	);
	const normalizedKeyword = searchKeyword.trim().toLowerCase();
	const filteredGroups = useMemo(() => {
		if (!normalizedKeyword) {
			return groups;
		}
		return groups.filter((group) => {
			const haystack = `${group.name} ${group.note}`.toLowerCase();
			return haystack.includes(normalizedKeyword);
		});
	}, [groups, normalizedKeyword]);
	const editingGroup = useMemo(
		() => groups.find((group) => group.id === editingGroupId) ?? null,
		[editingGroupId, groups],
	);

	useEffect(() => {
		resetState();
	}, [resetState]);

	const handleSubmitGroup = async (values: GroupFormValues) => {
		const visualOptions = {
			browserBgColor: values.browserBgColor.trim() || null,
			toolbarLabelMode: values.toolbarLabelMode,
		};
		if (editorMode === 'edit' && editingGroupId) {
			await onUpdateGroup(
				editingGroupId,
				values.name.trim(),
				values.note.trim(),
				visualOptions,
			);
		} else {
			await onCreateGroup(values.name.trim(), values.note.trim(), visualOptions);
		}
		closeForm();
	};

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<ActiveSectionCard
				label={t('page.label', { defaultValue: '分组' })}
				title={section.title}
				description={section.desc}
			/>

			<DataSection
				title={t('page.title')}
				className="flex-1 min-h-0 overflow-hidden flex flex-col"
				actions={
					<>
						<div className="relative w-52 max-w-full">
							<Icon
								icon={Search}
								size={14}
								className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								value={searchKeyword}
								onChange={(event) => setSearchKeyword(event.target.value)}
								placeholder={t('page.searchPlaceholder')}
								className="pl-8"
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={openCreateForm}
						>
							<Icon icon={Plus} size={14} />
							{t('page.newGroup')}
						</Button>
					</>
				}
			>
				<div className="mb-3 grid gap-2 sm:grid-cols-2">
					<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
						<span className="text-muted-foreground">{t('page.currentGroups')}</span>
						<Badge>{groups.length}</Badge>
					</div>
					<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
						<span className="text-muted-foreground">{t('page.coveredProfiles')}</span>
						<Badge variant="secondary">{totalProfiles}</Badge>
					</div>
				</div>

				{filteredGroups.length === 0 ? (
					<EmptyState title={t('page.noMatchingGroups')} />
				) : (
					<div className="overflow-hidden rounded-xl border border-border/70">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/20 hover:bg-muted/20">
									<TableHead>{t('page.table.group')}</TableHead>
									<TableHead>{t('page.table.note')}</TableHead>
									<TableHead className="w-[110px]">{t('page.table.profileCount')}</TableHead>
									<TableHead className="w-[160px]">{t('page.table.lastUpdated')}</TableHead>
									<TableHead className="w-[140px] text-right">{t('page.table.actions')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredGroups.map((group) => (
									<TableRow key={group.id}>
										<TableCell>
											<div className="flex items-center gap-2">
												<p className="font-medium">{group.name}</p>
												<Badge variant="outline">
													{t('page.profileCountBadge', { count: group.profileCount })}
												</Badge>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{group.note}
										</TableCell>
										<TableCell>{group.profileCount}</TableCell>
										<TableCell className="text-muted-foreground">
											{group.updatedAt}
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													onClick={() => onOpenGroupProfiles(group.name)}
												>
													<Icon icon={FolderOpen} size={14} />
												</Button>
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													onClick={() => openEditForm(group.id)}
												>
													<Icon icon={Pencil} size={14} />
												</Button>
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													className="text-destructive hover:bg-destructive/10 hover:text-destructive"
													onClick={() => setDeletingGroup(group)}
												>
													<Icon icon={Trash2} size={14} />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</DataSection>

			<GroupFormDialog
				open={isFormOpen}
				mode={editorMode}
				group={editingGroup}
				onOpenChange={(open) => {
					if (!open) {
						closeForm();
					}
				}}
				onSubmit={handleSubmitGroup}
			/>

			<GroupDeleteAlertDialog
				open={Boolean(deletingGroup)}
				group={deletingGroup}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingGroup(null);
					}
				}}
				onConfirm={async () => {
					if (!deletingGroup) {
						return;
					}
					await onDeleteGroup(deletingGroup.id);
					setDeletingGroup(null);
				}}
			/>
		</div>
	);
}
