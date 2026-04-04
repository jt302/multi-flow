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

type ProfileBatchClearGroupDialogProps = {
	open: boolean;
	selectedCount: number;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function ProfileBatchClearGroupDialog({
	open,
	selectedCount,
	onOpenChange,
	onConfirm,
}: ProfileBatchClearGroupDialogProps) {
	const { t } = useTranslation(['common', 'profile']);

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('profile:clearGroupConfirm')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('profile:clearGroupDesc', { count: selectedCount })}
						{t('profile:actionImmediate')}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer">
							{t('common:cancel')}
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button
							type="button"
							variant="destructive"
							className="cursor-pointer"
							onClick={onConfirm}
						>
							{t('common:confirmClear')}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
