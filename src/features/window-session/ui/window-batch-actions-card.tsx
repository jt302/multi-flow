import { Focus, RefreshCw, Rows3, SquareStack, X } from 'lucide-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from '@/components/ui';

type BatchActionFormValues = {
	targetUrl: string;
};

type WindowBatchActionsCardProps = {
	register: UseFormRegister<BatchActionFormValues>;
	errors: FieldErrors<BatchActionFormValues>;
	selectedRunningIds: string[];
	runningProfileIds: string[];
	onBatchOpenTabs: () => void;
	onBatchOpenWindows: () => void;
	onBatchCloseTabs: () => void;
	onBatchCloseInactiveTabs: () => void;
	onBatchFocusWindows: () => void;
	onRefreshWindows: () => void;
};

export function WindowBatchActionsCard({
	register,
	errors,
	selectedRunningIds,
	runningProfileIds,
	onBatchOpenTabs,
	onBatchOpenWindows,
	onBatchCloseTabs,
	onBatchCloseInactiveTabs,
	onBatchFocusWindows,
	onRefreshWindows,
}: WindowBatchActionsCardProps) {
	const { t } = useTranslation('window');

	return (
		<Card className="p-3">
			<CardHeader className="px-1 pb-2">
				<CardTitle className="text-sm">{t('batch.title')}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 px-1 pt-0">
				<div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(5,auto)]">
					<div>
						<Input {...register('targetUrl')} placeholder="https://www.browserscan.net/" />
						{errors.targetUrl ? (
							<p className="mt-1 text-xs text-destructive">{errors.targetUrl.message}</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBatchOpenTabs}
						disabled={selectedRunningIds.length === 0}
					>
						<Icon icon={Rows3} size={14} />
						{t('batch.batchNewTab')}
					</Button>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBatchOpenWindows}
						disabled={selectedRunningIds.length === 0}
					>
						<Icon icon={SquareStack} size={14} />
						{t('batch.batchNewWindow')}
					</Button>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBatchCloseTabs}
						disabled={selectedRunningIds.length === 0}
					>
						<Icon icon={X} size={14} />
						{t('batch.batchCloseCurrentTab')}
					</Button>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBatchCloseInactiveTabs}
						disabled={selectedRunningIds.length === 0}
					>
						<Icon icon={X} size={14} />
						{t('batch.batchCloseBgTab')}
					</Button>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={onBatchFocusWindows}
						disabled={selectedRunningIds.length === 0}
					>
						<Icon icon={Focus} size={14} />
						{t('batch.batchFocus')}
					</Button>
				</div>
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<p>
						{t('batch.selectedRunning', {
							selected: selectedRunningIds.length,
							total: runningProfileIds.length,
						})}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="cursor-pointer"
						onClick={onRefreshWindows}
					>
						<Icon icon={RefreshCw} size={12} />
						{t('batch.refreshWindowState')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
