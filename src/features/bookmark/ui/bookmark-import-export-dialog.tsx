import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { ImportBookmarksRequest } from '@/entities/bookmark/model/types';

type ImportDialogProps = {
	open: boolean;
	onClose: () => void;
	profileId: string;
	onImport: (req: ImportBookmarksRequest) => void;
	isPending?: boolean;
};

export function BookmarkImportDialog({
	open,
	onClose,
	profileId,
	onImport,
	isPending,
}: ImportDialogProps) {
	const { t } = useTranslation('bookmark');
	const [strategy, setStrategy] = useState<'mount_as_folder' | 'merge' | 'replace'>(
		'mount_as_folder',
	);
	const [folderTitle, setFolderTitle] = useState('');
	const [content, setContent] = useState('');
	const [error, setError] = useState<string | null>(null);

	const handleConfirm = () => {
		setError(null);
		try {
			JSON.parse(content);
		} catch {
			setError(t('errors.invalidJson'));
			return;
		}
		onImport({
			profileId,
			stateJson: content,
			strategy,
			folderTitle: strategy === 'mount_as_folder' && folderTitle ? folderTitle : undefined,
		});
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t('actions.importTitle')}</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<div className="space-y-1">
						<Label className="text-xs">{t('actions.strategy')}</Label>
						<Select value={strategy} onValueChange={(v) => setStrategy(v as typeof strategy)}>
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

					{strategy === 'mount_as_folder' && (
						<div className="space-y-1">
							<Label className="text-xs">{t('actions.folderTitle')}</Label>
							<Input
								value={folderTitle}
								onChange={(e) => setFolderTitle(e.target.value)}
								placeholder={t('detail.folderNamePlaceholder')}
								className="h-8 text-xs"
							/>
						</div>
					)}

					<div className="space-y-1">
						<Label className="text-xs">{t('actions.importContent')}</Label>
						<Textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder={t('actions.importContentPlaceholder')}
							className="h-32 text-xs font-mono resize-none"
						/>
					</div>

					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
						{t('detail.cancel')}
					</Button>
					<Button
						size="sm"
						className="cursor-pointer"
						onClick={handleConfirm}
						disabled={!content.trim() || isPending}
					>
						{t('actions.confirm')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

type ExportDialogProps = {
	open: boolean;
	onClose: () => void;
	content: string;
};

export function BookmarkExportDialog({ open, onClose, content }: ExportDialogProps) {
	const { t } = useTranslation('bookmark');
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t('actions.exportTitle')}</DialogTitle>
				</DialogHeader>
				<Textarea value={content} readOnly className="h-64 text-xs font-mono resize-none" />
				<DialogFooter>
					<Button variant="outline" size="sm" className="cursor-pointer" onClick={onClose}>
						{t('detail.cancel')}
					</Button>
					<Button size="sm" className="cursor-pointer" onClick={() => void handleCopy()}>
						{copied ? t('actions.exportCopied') : t('actions.exportJson')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
