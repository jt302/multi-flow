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
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>确认清空分组</AlertDialogTitle>
					<AlertDialogDescription>
						这会清空当前已选 {selectedCount} 个环境的分组信息。该操作会直接生效。
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button type="button" variant="ghost" className="cursor-pointer">
							取消
						</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button
							type="button"
							variant="destructive"
							className="cursor-pointer"
							onClick={onConfirm}
						>
							确认清空
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
