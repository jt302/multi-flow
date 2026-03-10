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
	confirmText = '确认',
	cancelText = '取消',
	confirmVariant = 'destructive',
	pending = false,
	onOpenChange,
	onConfirm,
}: ConfirmActionDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending}>
							{cancelText}
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button
							type="button"
							variant={confirmVariant}
							className="cursor-pointer"
							disabled={pending}
							onClick={onConfirm}
						>
							{confirmText}
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
