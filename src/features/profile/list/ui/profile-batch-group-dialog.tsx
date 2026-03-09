import { useEffect } from 'react';

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui';

type ProfileBatchGroupDialogProps = {
	open: boolean;
	groupOptions: string[];
	selectedCount: number;
	value: string;
	onOpenChange: (open: boolean) => void;
	onValueChange: (value: string) => void;
	onConfirm: () => void;
};

export function ProfileBatchGroupDialog({
	open,
	groupOptions,
	selectedCount,
	value,
	onOpenChange,
	onValueChange,
	onConfirm,
}: ProfileBatchGroupDialogProps) {
	useEffect(() => {
		if (!open || value || groupOptions.length === 0) {
			return;
		}
		onValueChange(groupOptions[0]);
	}, [groupOptions, onOpenChange, onValueChange, open, value]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>批量设置分组</DialogTitle>
					<DialogDescription>
						为当前已选的 {selectedCount} 个环境设置分组。
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					<p className="text-sm font-medium">目标分组</p>
					<Select value={value} onValueChange={onValueChange}>
						<SelectTrigger>
							<SelectValue placeholder="选择一个分组" />
						</SelectTrigger>
						<SelectContent>
							{groupOptions.map((groupName) => (
								<SelectItem key={`dialog-${groupName}`} value={groupName}>
									{groupName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						取消
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						onClick={onConfirm}
						disabled={!value}
					>
						确认设置
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
