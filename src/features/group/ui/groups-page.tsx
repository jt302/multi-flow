import { FolderOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from '@/components/ui';
import type { GroupItem } from '@/entities/group/model/types';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
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
	const section = WORKSPACE_SECTIONS.groups;
	const searchKeyword = useGroupManagementStore((state) => state.searchKeyword);
	const isFormOpen = useGroupManagementStore((state) => state.isFormOpen);
	const editingGroupId = useGroupManagementStore((state) => state.editingGroupId);
	const editorMode = useGroupManagementStore((state) => state.editorMode);
	const setSearchKeyword = useGroupManagementStore((state) => state.setSearchKeyword);
	const openCreateForm = useGroupManagementStore((state) => state.openCreateForm);
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
		if (editorMode === 'edit' && editingGroupId) {
			await onUpdateGroup(editingGroupId, values.name.trim(), values.note.trim());
		} else {
			await onCreateGroup(values.name.trim(), values.note.trim());
		}
		closeForm();
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="分组" title={section.title} description={section.desc} />

			<Card className="p-3">
				<CardHeader className="px-1 pb-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<CardTitle className="text-sm">分组列表</CardTitle>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative w-52 max-w-full">
								<Icon icon={Search} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={searchKeyword}
									onChange={(event) => setSearchKeyword(event.target.value)}
									placeholder="搜索分组名称或备注"
									className="pl-8"
								/>
							</div>
							<Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={openCreateForm}>
								<Icon icon={Plus} size={14} />
								新建分组
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-2 px-1 pt-0">
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
							<span className="text-muted-foreground">当前分组数</span>
							<Badge>{groups.length}</Badge>
						</div>
						<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
							<span className="text-muted-foreground">覆盖环境数</span>
							<Badge variant="secondary">{totalProfiles}</Badge>
						</div>
					</div>

					<div className="space-y-2 pt-1">
						{filteredGroups.map((group) => (
							<div key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/75 px-3 py-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<p className="truncate text-sm font-medium">{group.name}</p>
										<Badge variant="outline">{group.profileCount} 个环境</Badge>
									</div>
									<p className="mt-1 truncate text-xs text-muted-foreground">{group.note}</p>
									<p className="mt-1 text-[11px] text-muted-foreground">最近更新 {group.updatedAt}</p>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={() => onOpenGroupProfiles(group.name)}>
										<Icon icon={FolderOpen} size={14} />
									</Button>
									<Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" onClick={() => openEditForm(group.id)}>
										<Icon icon={Pencil} size={14} />
									</Button>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										className="h-8 w-8 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
										onClick={() => setDeletingGroup(group)}
									>
										<Icon icon={Trash2} size={14} />
									</Button>
								</div>
							</div>
						))}
						{filteredGroups.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
								没有匹配当前搜索条件的分组。
							</div>
						) : null}
					</div>
				</CardContent>
			</Card>

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
