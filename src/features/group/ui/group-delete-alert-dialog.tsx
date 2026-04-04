import { useTranslation } from 'react-i18next';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from '@/components/ui';
import type { GroupItem } from '@/entities/group/model/types';

type GroupDeleteAlertDialogProps = {
	open: boolean;
	group: GroupItem | null;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
};

export function GroupDeleteAlertDialog({
	open,
	group,
	onOpenChange,
	onConfirm,
}: GroupDeleteAlertDialogProps) {
	const { t } = useTranslation('group');

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('delete.description')}
						{group ? ` ${t('delete.currentGroup', { name: group.name })}` : ''}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer">
							{t('delete.cancel')}
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button
							type="button"
							variant="destructive"
							className="cursor-pointer"
							onClick={() => {
								void onConfirm();
							}}
						>
							{t('delete.confirmDelete')}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
