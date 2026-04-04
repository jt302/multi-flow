import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import i18next from 'i18next';
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
	name: z.string().trim().min(1, i18next.t('group:form.nameRequired')),
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
	const { t } = useTranslation(['group', 'common']);
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
				note: group.note === i18next.t('group:mock.noNote') ? '' : group.note,
			});
			return;
		}
		reset({ name: '', note: '' });
	}, [group, mode, open, reset]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{mode === 'edit'
							? t('group:form.editTitle')
							: t('group:form.createTitle')}
					</DialogTitle>
					<DialogDescription>
						{mode === 'edit'
							? t('group:form.editDesc')
							: t('group:form.createDesc')}
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
										<Input
											{...field}
											placeholder={t('group:form.namePlaceholder')}
										/>
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
										<Input
											{...field}
											placeholder={t('group:form.notePlaceholder')}
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
								className="cursor-pointer"
								onClick={() => onOpenChange(false)}
							>
								{t('common:cancel')}
							</Button>
							<Button
								type="submit"
								className="cursor-pointer"
								disabled={isSubmitting}
							>
								<Icon icon={mode === 'edit' ? Save : Plus} size={14} />
								{mode === 'edit'
									? t('group:form.saveGroup')
									: t('group:form.createGroup')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
