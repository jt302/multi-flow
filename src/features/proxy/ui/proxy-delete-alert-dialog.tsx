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
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>确认删除代理</AlertDialogTitle>
					<AlertDialogDescription>
						这会归档代理 “{proxyName}”，并移除相关环境绑定。此操作属于危险操作，需要二次确认。
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer" disabled={pending}>
							取消
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
							确认删除
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
