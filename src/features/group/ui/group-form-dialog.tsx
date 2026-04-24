import { zodResolver } from '@hookform/resolvers/zod';
import i18next from 'i18next';
import { Plus, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';
import type { GroupItem } from '@/entities/group/model/types';
import type { ToolbarLabelMode } from '@/entities/profile/model/types';
import type { GroupEditorMode } from '@/store/group-management-store';

export const groupFormSchema = z.object({
	name: z.string().trim().min(1, i18next.t('group:form.nameRequired')),
	note: z.string(),
	browserBgColor: z.string(),
	toolbarLabelMode: z.enum(['id_only', 'group_name_and_id']),
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
	const { t } = useTranslation(['group', 'common']);
	const form = useForm<GroupFormValues>({
		resolver: zodResolver(groupFormSchema),
		defaultValues: {
			name: '',
			note: '',
			browserBgColor: '',
			toolbarLabelMode: 'id_only',
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
				note: group.note === i18next.t('group:mock.noNote') ? '' : group.note,
				browserBgColor: group.browserBgColor ?? '',
				toolbarLabelMode: group.toolbarLabelMode,
			});
			return;
		}
		reset({ name: '', note: '', browserBgColor: '', toolbarLabelMode: 'id_only' });
	}, [group, mode, open, reset]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{mode === 'edit' ? t('group:form.editTitle') : t('group:form.createTitle')}
					</DialogTitle>
					<DialogDescription>
						{mode === 'edit' ? t('group:form.editDesc') : t('group:form.createDesc')}
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
									<FormLabel>{t('group:form.name')}</FormLabel>
									<FormControl>
										<Input {...field} placeholder={t('group:form.namePlaceholder')} />
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
									<FormLabel>{t('group:form.note')}</FormLabel>
									<FormControl>
										<Input {...field} placeholder={t('group:form.notePlaceholder')} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="rounded-lg border border-border/60 p-3">
							<p className="mb-3 text-sm font-medium">{t('group:form.visualSectionTitle')}</p>
							<FormField
								control={control}
								name="toolbarLabelMode"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('group:form.toolbarLabelMode')}</FormLabel>
										<Select
											value={field.value}
											onValueChange={(value) => field.onChange(value as ToolbarLabelMode)}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="id_only">
													{t('group:form.toolbarLabelModeIdOnly')}
												</SelectItem>
												<SelectItem value="group_name_and_id">
													{t('group:form.toolbarLabelModeGroupAndId')}
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={control}
								name="browserBgColor"
								render={({ field }) => (
									<FormItem className="mt-3">
										<FormLabel>{t('group:form.browserBgColorDefault')}</FormLabel>
										<FormControl>
											<div className="flex items-center gap-2">
												<Input
													type="color"
													value={field.value || '#0F8A73'}
													onChange={(event) => field.onChange(event.target.value)}
													className="h-10 w-12 cursor-pointer rounded p-1"
												/>
												<Input {...field} placeholder="#0F8A73" />
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								className="cursor-pointer"
								onClick={() => onOpenChange(false)}
							>
								{t('common:cancel')}
							</Button>
							<Button type="submit" className="cursor-pointer" disabled={isSubmitting}>
								<Icon icon={mode === 'edit' ? Save : Plus} size={14} />
								{mode === 'edit' ? t('group:form.saveGroup') : t('group:form.createGroup')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
