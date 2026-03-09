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
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>确认批量删除代理</AlertDialogTitle>
					<AlertDialogDescription>
						这会删除当前已选 {selectedCount} 条代理。删除后可在回收状态中恢复，但相关绑定可能需要重新处理。
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
							{pending ? <LoaderCircle className="animate-spin" /> : null}
							确认删除
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
