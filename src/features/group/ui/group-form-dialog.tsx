import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save } from 'lucide-react';
import { z } from 'zod/v3';

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
	Icon,
	Input,
} from '@/components/ui';
import type { GroupEditorMode } from '@/store/group-management-store';
import type { GroupItem } from '@/entities/group/model/types';

export const groupFormSchema = z.object({
	name: z.string().trim().min(1, '分组名称不能为空'),
	note: z.string(),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;

type GroupFormDialogProps = {
	open: boolean;
	mode: GroupEditorMode;
	group: GroupItem | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: GroupFormValues) => Promise<void>;
};

export function GroupFormDialog({
	open,
	mode,
	group,
	onOpenChange,
	onSubmit,
}: GroupFormDialogProps) {
	const form = useForm<GroupFormValues>({
		resolver: zodResolver(groupFormSchema),
		defaultValues: {
			name: '',
			note: '',
		},
	});
	const {
		handleSubmit,
		reset,
		control,
		formState: { isSubmitting },
	} = form;

	useEffect(() => {
		if (!open) {
			return;
		}
		if (mode === 'edit' && group) {
			reset({
				name: group.name,
				note: group.note === '未填写备注' ? '' : group.note,
			});
			return;
		}
		reset({ name: '', note: '' });
	}, [group, mode, open, reset]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{mode === 'edit' ? '编辑分组' : '新建分组'}</DialogTitle>
					<DialogDescription>
						{mode === 'edit' ? '更新分组名称和备注信息。' : '创建一个新的分组，用于环境归类。'}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(async (values) => {
							await onSubmit(values);
							onOpenChange(false);
						})}
					>
						<FormField
							control={control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>分组名称</FormLabel>
									<FormControl>
										<Input {...field} placeholder="例如 AirDrop-Matrix" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={control}
							name="note"
							render={({ field }) => (
								<FormItem>
									<FormLabel>备注</FormLabel>
									<FormControl>
										<Input {...field} placeholder="任务目的或业务线" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								className="cursor-pointer"
								onClick={() => onOpenChange(false)}
							>
								取消
							</Button>
							<Button type="submit" className="cursor-pointer" disabled={isSubmitting}>
								<Icon icon={mode === 'edit' ? Save : Plus} size={14} />
								{mode === 'edit' ? '保存分组' : '新增分组'}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
