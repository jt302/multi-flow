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
} from '@/components/ui';

type ConfirmActionDialogProps = {
	open: boolean;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	confirmVariant?: 'default' | 'destructive';
	pending?: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function ConfirmActionDialog({
	open,
	title,
	description,
	confirmText,
	cancelText,
	confirmVariant = 'destructive',
	pending = false,
	onOpenChange,
	onConfirm,
}: ConfirmActionDialogProps) {
	const { t } = useTranslation('common');
	const resolvedConfirmText = confirmText ?? t('confirm');
	const resolvedCancelText = cancelText ?? t('cancel');
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="cursor-pointer" disabled={pending}>
						{resolvedCancelText}
					</AlertDialogCancel>
					<AlertDialogAction
						className={
							confirmVariant === 'default'
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'cursor-pointer'
						}
						disabled={pending}
						onClick={onConfirm}
					>
						{resolvedConfirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
