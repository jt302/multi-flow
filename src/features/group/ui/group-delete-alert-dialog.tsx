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
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>确认删除分组</AlertDialogTitle>
					<AlertDialogDescription>
						删除后，当前分组下关联环境的分组信息会被清空。该操作不会自动恢复历史绑定。
						{group ? ` 当前分组：${group.name}` : ''}
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
							onClick={() => {
								void onConfirm();
							}}
						>
							确认删除
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
