import { useTranslation } from 'react-i18next';
import { LoaderCircle } from 'lucide-react';
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

type ProxyBatchDeleteAlertDialogProps = {
	open: boolean;
	selectedCount: number;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function ProxyBatchDeleteAlertDialog({
	open,
	selectedCount,
	pending,
	onOpenChange,
	onConfirm,
}: ProxyBatchDeleteAlertDialogProps) {
	const { t } = useTranslation(['proxy', 'common']);
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('common:batchDelete')}</AlertDialogTitle>
					<AlertDialogDescription>{t('proxy:batchDeleteDesc', { count: selectedCount })} {t('proxy:deleteRecoverable')}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending}>
							{t('common:cancel')}
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button
							type="button"
							variant="destructive"
							className="cursor-pointer"
							disabled={pending}
							onClick={onConfirm}
						>
							{pending ? <LoaderCircle className="animate-spin" /> : null}
							{t('common:confirm')}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
