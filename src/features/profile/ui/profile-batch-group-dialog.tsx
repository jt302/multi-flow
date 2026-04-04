import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
	const { t } = useTranslation('profile');
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
					<DialogTitle>{t('list:batchSetGroupTitle')}</DialogTitle>
					<DialogDescription>
						{t('list:batchSetGroupDesc', { count: selectedCount })}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					<p className="text-sm font-medium">{t('list:targetGroup')}</p>
					<Select value={value} onValueChange={onValueChange}>
						<SelectTrigger>
							<SelectValue placeholder={t('list:selectGroup')} />
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
						{t('common:cancel')}
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						onClick={onConfirm}
						disabled={!value}
					>
						{t('list:confirmSet')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
