import { ExternalLink, Folder, Globe, Pencil, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
	AlertDialogTrigger,
	Button,
	Input,
	Label,
	Separator,
} from '@/components/ui';
import type { BookmarkDisplayNode } from '@/entities/bookmark/model/types';

type BookmarkDetailPanelProps = {
	node: BookmarkDisplayNode | null;
	isLive: boolean;
	onUpdate: (nodeId: string, title: string, url?: string) => void;
	onRemove: (nodeId: string) => void;
	isPending?: boolean;
};

export function BookmarkDetailPanel({
	node,
	isLive,
	onUpdate,
	onRemove,
	isPending,
}: BookmarkDetailPanelProps) {
	const { t } = useTranslation('bookmark');
	const [editing, setEditing] = useState(false);
	const [editTitle, setEditTitle] = useState('');
	const [editUrl, setEditUrl] = useState('');

	useEffect(() => {
		setEditing(false);
		setEditTitle(node?.title ?? '');
		setEditUrl(node?.url ?? '');
	}, [node?.id]);

	if (!node) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-xs text-muted-foreground">{t('detail.noSelection')}</p>
			</div>
		);
	}

	const isFolder = node.type === 'folder';

	const handleSave = () => {
		onUpdate(node.id, editTitle, isFolder ? undefined : editUrl);
		setEditing(false);
	};

	const handleCancel = () => {
		setEditing(false);
		setEditTitle(node.title);
		setEditUrl(node.url ?? '');
	};

	return (
		<div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
			{/* Header */}
			<div className="flex items-center gap-2">
				{isFolder ? (
					<Folder className="h-4 w-4 shrink-0 text-yellow-500" />
				) : (
					<Globe className="h-4 w-4 shrink-0 text-blue-400" />
				)}
				<span className="text-xs font-medium truncate flex-1">{node.title}</span>
				{isLive && !node.managed && (
					<Button
						size="icon"
						variant="ghost"
						className="h-6 w-6 cursor-pointer"
						onClick={() => setEditing(true)}
						disabled={editing || isPending}
					>
						<Pencil className="h-3 w-3" />
					</Button>
				)}
			</div>

			<Separator />

			{/* Fields */}
			<div className="space-y-3">
				<div className="space-y-1">
					<Label className="text-xs text-muted-foreground">{t('detail.type')}</Label>
					<p className="text-xs">{isFolder ? t('detail.folder') : t('detail.bookmark')}</p>
				</div>

				{editing ? (
					<>
						<div className="space-y-1">
							<Label className="text-xs">{t('detail.title')}</Label>
							<Input
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								placeholder={t('detail.titlePlaceholder')}
								className="h-7 text-xs"
							/>
						</div>
						{!isFolder && (
							<div className="space-y-1">
								<Label className="text-xs">{t('detail.url')}</Label>
								<Input
									value={editUrl}
									onChange={(e) => setEditUrl(e.target.value)}
									placeholder={t('detail.urlPlaceholder')}
									className="h-7 text-xs"
								/>
							</div>
						)}
						<div className="flex gap-2">
							<Button
								size="sm"
								className="h-7 text-xs cursor-pointer flex-1"
								onClick={handleSave}
								disabled={!editTitle.trim() || isPending}
							>
								<Save className="h-3 w-3 mr-1" />
								{t('detail.save')}
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="h-7 text-xs cursor-pointer"
								onClick={handleCancel}
							>
								<X className="h-3 w-3" />
							</Button>
						</div>
					</>
				) : (
					<>
						<div className="space-y-1">
							<Label className="text-xs text-muted-foreground">{t('detail.title')}</Label>
							<p className="text-xs break-all">{node.title}</p>
						</div>
						{!isFolder && node.url && (
							<div className="space-y-1">
								<Label className="text-xs text-muted-foreground">{t('detail.url')}</Label>
								<p className="text-xs break-all text-blue-400">{node.url}</p>
							</div>
						)}
					</>
				)}

				{node.managed && (
					<div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
						{t('detail.managed')}
					</div>
				)}
			</div>

			{/* Actions */}
			{isLive && !editing && !node.managed && (
				<>
					<Separator />
					<div className="flex flex-col gap-2">
						{!isFolder && node.url && (
							<Button
								size="sm"
								variant="outline"
								className="h-7 text-xs cursor-pointer w-full justify-start"
								onClick={() => void window.open(node.url, '_blank')}
							>
								<ExternalLink className="h-3 w-3 mr-1" />
								{t('detail.open')}
							</Button>
						)}
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									size="sm"
									variant="destructive"
									className="h-7 text-xs cursor-pointer w-full justify-start"
									disabled={isPending}
								>
									<Trash2 className="h-3 w-3 mr-1" />
									{t('detail.delete')}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('detail.deleteConfirm', { title: node.title })}
									</AlertDialogTitle>
									<AlertDialogDescription>{t('detail.deleteWarning')}</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel className="cursor-pointer">
										{t('detail.cancel')}
									</AlertDialogCancel>
									<AlertDialogAction className="cursor-pointer" onClick={() => onRemove(node.id)}>
										{t('detail.delete')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</>
			)}
		</div>
	);
}
