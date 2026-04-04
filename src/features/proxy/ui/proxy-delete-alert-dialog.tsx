import { LoaderCircle } from 'lucide-react';
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

type ProxyDeleteAlertDialogProps = {
	open: boolean;
	pending: boolean;
	proxyName: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function ProxyDeleteAlertDialog({
	open,
	pending,
	proxyName,
	onOpenChange,
	onConfirm,
}: ProxyDeleteAlertDialogProps) {
	const { t } = useTranslation(['proxy', 'common']);
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('common:deleteItemConfirm', { item: t('common:proxy') })}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('proxy:archiveProxy', { name: proxyName })}，{t('proxy:removeBindings')}。{t('common:dangerousOperation')}。
					</AlertDialogDescription>
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
