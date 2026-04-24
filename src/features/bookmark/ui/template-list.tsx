import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
	Badge,
	Button,
	Skeleton,
} from '@/components/ui';
import type { BookmarkTemplateItem } from '@/entities/bookmark/model/types';
import { cn } from '@/lib/utils';

type TemplateListProps = {
	templates: BookmarkTemplateItem[];
	isLoading: boolean;
	selectedId: number | null;
	onSelect: (template: BookmarkTemplateItem) => void;
	onNew: () => void;
	onDelete: (id: number) => void;
	isDeleting: boolean;
};

export function TemplateList({
	templates,
	isLoading,
	selectedId,
	onSelect,
	onNew,
	onDelete,
	isDeleting,
}: TemplateListProps) {
	const { t } = useTranslation('bookmark');
	const [deleteTarget, setDeleteTarget] = useState<BookmarkTemplateItem | null>(null);

	const handleDeleteConfirm = () => {
		if (!deleteTarget) return;
		onDelete(deleteTarget.id);
		setDeleteTarget(null);
	};

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* 顶部工具栏 */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0">
				<span className="text-xs font-medium text-muted-foreground">{t('templates.title')}</span>
				<Button
					size="icon"
					variant="ghost"
					className="h-6 w-6 cursor-pointer"
					onClick={onNew}
					title={t('templates.new')}
				>
					<Plus className="h-3.5 w-3.5" />
				</Button>
			</div>

			{/* 模板列表 */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{isLoading ? (
					<div className="p-2 space-y-1.5">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				) : templates.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full p-4 gap-3">
						<p className="text-xs text-muted-foreground">{t('templates.noTemplates')}</p>
						<Button size="sm" variant="outline" className="text-xs cursor-pointer" onClick={onNew}>
							<Plus className="h-3 w-3 mr-1" />
							{t('templates.new')}
						</Button>
					</div>
				) : (
					<ul className="p-1.5 space-y-0.5">
						{templates.map((tpl) => (
							<li key={tpl.id} className="group flex items-start gap-1">
								{/* 使用 div[role=button] 避免 button > button 嵌套错误 */}
								<div
									role="button"
									tabIndex={0}
									className={cn(
										'flex-1 min-w-0 text-left rounded-md px-2.5 py-2 flex items-start gap-2 group transition-colors cursor-pointer',
										selectedId === tpl.id
											? 'bg-accent text-accent-foreground'
											: 'hover:bg-accent/50',
									)}
									onClick={() => onSelect(tpl)}
									onKeyDown={(e) => e.key === 'Enter' && onSelect(tpl)}
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="text-xs font-medium truncate">{tpl.name}</span>
											<Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
												v{tpl.version}
											</Badge>
										</div>
										{tpl.tags && (
											<p className="text-[10px] text-muted-foreground truncate mt-0.5">
												{tpl.tags}
											</p>
										)}
									</div>
								</div>
								{/* 删除按钮提取到 li 同级，避免嵌套 */}
								<button
									type="button"
									className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 cursor-pointer transition-opacity shrink-0 mt-2.5 px-1"
									onClick={() => setDeleteTarget(tpl)}
									disabled={isDeleting}
									title={t('common.delete', { defaultValue: 'Delete' })}
								>
									<Trash2 className="h-3 w-3" />
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* 删除确认弹窗 */}
			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t('templates.deleteConfirm', { name: deleteTarget?.name ?? '' })}
						</AlertDialogTitle>
						<AlertDialogDescription>{t('templates.deleteWarning')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">{t('detail.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							className="cursor-pointer bg-destructive hover:bg-destructive/90"
							onClick={handleDeleteConfirm}
						>
							{t('detail.delete')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
