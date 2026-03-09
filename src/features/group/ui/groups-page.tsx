import { Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';
import { zodResolver } from '@hookform/resolvers/zod';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from '@/components/ui';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { SessionTableCard } from '@/widgets/session-table-card/ui/session-table-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';
import type { GroupsPageProps } from '@/features/group/model/types';
import { useGroupManagementStore } from '@/features/group/model/group-management-store';

const groupFormSchema = z.object({
	name: z.string().trim().min(1, '分组名称不能为空'),
	note: z.string(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

export function GroupsPage({ groups, onCreateGroup, onDeleteGroup }: GroupsPageProps) {
	const section = CONSOLE_NAV_SECTIONS.groups;
	const searchKeyword = useGroupManagementStore((state) => state.searchKeyword);
	const isFormOpen = useGroupManagementStore((state) => state.isFormOpen);
	const setSearchKeyword = useGroupManagementStore((state) => state.setSearchKeyword);
	const openCreateForm = useGroupManagementStore((state) => state.openCreateForm);
	const closeForm = useGroupManagementStore((state) => state.closeForm);
	const resetState = useGroupManagementStore((state) => state.reset);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<GroupFormValues>({
		resolver: zodResolver(groupFormSchema),
		defaultValues: {
			name: '',
			note: '',
		},
	});

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

	useEffect(() => {
		resetState();
	}, [resetState]);

	const handleCreate = async (values: GroupFormValues) => {
		await onCreateGroup(values.name.trim(), values.note.trim());
		reset();
		openCreateForm();
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="分组" title={section.title} description={section.desc} />

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
				<Card className="p-3">
					<CardHeader className="px-1 pb-2">
						<div className="flex items-center justify-between gap-2">
							<CardTitle className="text-sm">分组列表</CardTitle>
							<div className="flex items-center gap-2">
								<div className="relative w-48 max-w-full">
									<Icon icon={Search} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={searchKeyword}
										onChange={(event) => setSearchKeyword(event.target.value)}
										placeholder="搜索分组"
										className="pl-8"
									/>
								</div>
								<Button type="button" variant="outline" size="sm" onClick={isFormOpen ? closeForm : openCreateForm}>
									{isFormOpen ? '收起表单' : '创建分组'}
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-2 px-1 pt-0">
						<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
							<span className="text-muted-foreground">当前分组数</span>
							<Badge>{groups.length}</Badge>
						</div>
						<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs">
							<span className="text-muted-foreground">覆盖环境数</span>
							<Badge variant="secondary">{totalProfiles}</Badge>
						</div>

						<div className="space-y-2 pt-1">
							{filteredGroups.map((group) => (
								<div key={group.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/75 px-3 py-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">{group.name}</p>
											<p className="truncate text-xs text-muted-foreground">
												{group.note} · {group.updatedAt}
											</p>
										</div>
										<div className="ml-3 flex items-center gap-2">
											<Badge variant="outline">{group.profileCount}</Badge>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="h-8 w-8"
												onClick={() => {
													void onDeleteGroup(group.id);
												}}
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

				{isFormOpen ? (
				<Card className="p-4">
					<CardHeader className="p-0">
						<CardTitle className="text-sm">创建分组</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-3">
						<form className="space-y-3" onSubmit={handleSubmit(handleCreate)}>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">分组名称</p>
							<Input
								{...register('name')}
								placeholder="例如 AirDrop-Matrix"
							/>
							{errors.name ? (
								<p className="mt-1 text-xs text-destructive">
									{errors.name.message}
								</p>
							) : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">备注</p>
							<Input
								{...register('note')}
								placeholder="任务目的或业务线"
							/>
						</div>
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							<Icon icon={Plus} size={14} />
							新增分组
						</Button>
						</form>
					</CardContent>
				</Card>
				) : null}
			</div>

			<SessionTableCard title={section.tableTitle} rows={section.rows} />
		</div>
	);
}
