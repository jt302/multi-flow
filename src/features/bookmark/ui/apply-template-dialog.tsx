import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
	ApplyBookmarkTemplateRequest,
	BatchProfileActionResponse,
	BookmarkTemplateItem,
} from '@/entities/bookmark/model/types';
import type { ProfileItem } from '@/entities/profile/model/types';
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Input,
	Separator,
} from '@/components/ui';
import { cn } from '@/lib/utils';

type ApplyResult = BatchProfileActionResponse;

type ApplyTemplateDialogProps = {
	open: boolean;
	template: BookmarkTemplateItem;
	profiles: ProfileItem[];
	onClose: () => void;
	onApply: (req: ApplyBookmarkTemplateRequest) => void;
	isPending: boolean;
	result: ApplyResult | null;
	onClearResult: () => void;
};

export function ApplyTemplateDialog({
	open,
	template,
	profiles,
	onClose,
	onApply,
	isPending,
	result,
	onClearResult,
}: ApplyTemplateDialogProps) {
	const { t } = useTranslation('bookmark');
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [strategy, setStrategy] =
		useState<ApplyBookmarkTemplateRequest['strategy']>('mount_as_folder');
	const [folderTitle, setFolderTitle] = useState(template.name);

	const handleToggle = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleSelectAll = () => {
		if (selectedIds.size === profiles.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(profiles.map((p) => p.id)));
		}
	};

	const handleApply = () => {
		if (selectedIds.size === 0) return;
		onApply({
			templateId: template.id,
			profileIds: Array.from(selectedIds),
			strategy,
			folderTitle: strategy === 'mount_as_folder' ? folderTitle : undefined,
		});
	};

	const handleClose = () => {
		onClearResult();
		setSelectedIds(new Set());
		setStrategy('mount_as_folder');
		setFolderTitle(template.name);
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t('templates.applyTitle')}</DialogTitle>
				</DialogHeader>

				{/* 下发结果展示 */}
				{result ? (
					<div className="space-y-3 py-1">
						<p className="text-sm font-medium">{t('templates.applyResult')}</p>
						<div className="flex gap-3">
							<span className="text-xs text-green-600 font-medium">
								{t('templates.successCount', { count: result.successCount })}
							</span>
							{result.failedCount > 0 && (
								<span className="text-xs text-destructive font-medium">
									{t('templates.failedCount', { count: result.failedCount })}
								</span>
							)}
						</div>
						{result.failedCount > 0 && (
							<ul className="text-xs space-y-1 max-h-40 overflow-y-auto rounded-md border border-border/60 p-2">
								{result.items
									.filter((item) => !item.ok)
									.map((item) => (
										<li key={item.profileId} className="text-destructive">
											<span className="font-mono">{item.profileId}</span>
											{item.message && (
												<span className="text-muted-foreground ml-1">— {item.message}</span>
											)}
										</li>
									))}
							</ul>
						)}
						<Button
							size="sm"
							variant="outline"
							className="cursor-pointer"
							onClick={handleClose}
						>
							{t('detail.cancel')}
						</Button>
					</div>
				) : (
					<div className="space-y-4 py-1">
						{/* 策略选择 */}
						<div className="space-y-1.5">
							<Label className="text-xs">{t('actions.strategy')}</Label>
							<Select
								value={strategy}
								onValueChange={(v) =>
									setStrategy(v as ApplyBookmarkTemplateRequest['strategy'])
								}
							>
								<SelectTrigger className="h-8 text-xs cursor-pointer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="mount_as_folder" className="text-xs cursor-pointer">
										{t('actions.strategyMountAsFolder')}
									</SelectItem>
									<SelectItem value="merge" className="text-xs cursor-pointer">
										{t('actions.strategyMerge')}
									</SelectItem>
									<SelectItem value="replace" className="text-xs cursor-pointer">
										{t('actions.strategyReplace')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* 子文件夹名称（仅 mount_as_folder 时显示） */}
						{strategy === 'mount_as_folder' && (
							<div className="space-y-1.5">
								<Label className="text-xs">{t('actions.folderTitle')}</Label>
								<Input
									value={folderTitle}
									onChange={(e) => setFolderTitle(e.target.value)}
									className="h-8 text-xs"
									placeholder={template.name}
								/>
							</div>
						)}

						<Separator />

						{/* 目标环境多选 */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label className="text-xs">{t('templates.selectProfiles')}</Label>
								<button
									type="button"
									className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
									onClick={handleSelectAll}
								>
									{selectedIds.size === profiles.length
										? t('common.deselectAll', { defaultValue: 'Deselect all' })
										: t('common.selectAll', { defaultValue: 'Select all' })}
								</button>
							</div>

							<ul className="max-h-48 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
								{profiles.length === 0 ? (
									<li className="px-3 py-2 text-xs text-muted-foreground">
										{t('selector.noProfiles')}
									</li>
								) : (
									profiles.map((p) => (
										<li key={p.id}>
											<button
												type="button"
												className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
												onClick={() => handleToggle(p.id)}
											>
												{/* 复选框状态 */}
												<span
													className={cn(
														'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0',
														selectedIds.has(p.id)
															? 'bg-primary border-primary text-primary-foreground'
															: 'border-border/80',
													)}
												>
													{selectedIds.has(p.id) && (
														<svg
															viewBox="0 0 10 10"
															className="h-2 w-2"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
														>
															<polyline points="1.5,5 4,7.5 8.5,2" />
														</svg>
													)}
												</span>
												{/* 运行状态指示点 */}
												<span
													className={cn(
														'h-1.5 w-1.5 rounded-full shrink-0',
														p.running ? 'bg-green-500' : 'bg-muted-foreground/40',
													)}
												/>
												<span className="text-xs">{p.name}</span>
												{p.running && (
													<span className="ml-auto text-[10px] text-green-600">
														{t('status.live')}
													</span>
												)}
											</button>
										</li>
									))
								)}
							</ul>
							{selectedIds.size === 0 && (
								<p className="text-[10px] text-muted-foreground mt-1">
									{t('templates.noProfilesSelected')}
								</p>
							)}
						</div>
					</div>
				)}

				{!result && (
					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							className="cursor-pointer"
							onClick={handleClose}
						>
							{t('detail.cancel')}
						</Button>
						<Button
							size="sm"
							className="cursor-pointer"
							disabled={selectedIds.size === 0 || isPending}
							onClick={handleApply}
						>
							{isPending ? '...' : t('templates.apply')}
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
