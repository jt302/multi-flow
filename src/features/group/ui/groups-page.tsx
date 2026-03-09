import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';
import { zodResolver } from '@hookform/resolvers/zod';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from '@/components/ui';
import { ActiveSectionCard } from '@/features/console/components';
import { SessionTableCard } from '@/features/console/components/session-table-card';
import { NAV_SECTIONS } from '@/features/console/constants';
import type { GroupsPageProps } from '@/features/console/types';

const groupFormSchema = z.object({
	name: z.string().trim().min(1, '分组名称不能为空'),
	note: z.string(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

export function GroupsPage({ groups, onCreateGroup, onDeleteGroup }: GroupsPageProps) {
	const section = NAV_SECTIONS.groups;
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

	const handleCreate = async (values: GroupFormValues) => {
		await onCreateGroup(values.name.trim(), values.note.trim());
		reset();
	};

	return (
		<div className="space-y-3">
			<ActiveSectionCard label="分组" title={section.title} description={section.desc} />

			<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
				<Card className="p-3">
					<CardHeader className="px-1 pb-2">
						<CardTitle className="text-sm">分组列表</CardTitle>
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
							{groups.map((group) => (
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
						</div>
					</CardContent>
				</Card>

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
			</div>

			<SessionTableCard title={section.tableTitle} rows={section.rows} />
		</div>
	);
}
