import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, LoaderCircle, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useAiSkillsQuery } from '@/entities/ai-skill/model/use-ai-skills-query';
import { useChatStore } from '@/store/chat-store';
import { AiSkillList } from './ai-skill-list';
import { AiSkillEditor } from './ai-skill-editor';
import { AiSkillInstallDialog } from './ai-skill-install-dialog';

export function AiSkillPage() {
	const { t } = useTranslation('chat');
	const activeSessionId = useChatStore((state) => state.activeSessionId);
	const { data: skills = [], isLoading, isFetching, refetch } = useAiSkillsQuery();
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [installDialogOpen, setInstallDialogOpen] = useState(false);

	const handleNew = () => {
		setSelectedSlug(null);
		setIsCreating(true);
		setDialogOpen(true);
	};

	const handleSelect = (slug: string) => {
		setSelectedSlug(slug);
		setIsCreating(false);
		setDialogOpen(true);
	};

	const handleSaved = (slug: string) => {
		setSelectedSlug(slug);
		setIsCreating(false);
		setDialogOpen(false);
	};

	const handleDeleted = (deletedSlug: string) => {
		if (deletedSlug === selectedSlug) {
			setSelectedSlug(null);
			setIsCreating(false);
			setDialogOpen(false);
		}
	};

	const handleInstall = () => {
		setInstallDialogOpen(true);
	};

	const handleRefresh = () => {
		void refetch();
	};

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm">
				<div className="space-y-1">
					<h1 className="text-base font-semibold text-foreground">{t('skills.title')}</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">{t('skills.pageDescription')}</p>
				</div>
				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" onClick={handleRefresh} className="cursor-pointer">
						{isFetching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
						{isFetching ? t('skills.refreshPending') : t('skills.refreshAction')}
					</Button>
					<Button type="button" variant="outline" onClick={handleInstall} className="cursor-pointer">
						<Download className="h-4 w-4" />
						{t('skills.installAction')}
					</Button>
					<Button type="button" onClick={handleNew} className="cursor-pointer">
						<Plus className="h-4 w-4" />
						{t('skills.createTitle')}
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<AiSkillList
					skills={skills}
					isLoading={isLoading}
					selectedSlug={selectedSlug}
					onSelect={handleSelect}
					onDeleted={handleDeleted}
				/>
			</div>
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setIsCreating(false);
					}
				}}
			>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>
							{isCreating ? t('skills.createTitle') : t('skills.editTitle')}
						</DialogTitle>
						<DialogDescription>{t('skills.dialogDescription')}</DialogDescription>
					</DialogHeader>
					<AiSkillEditor
						slug={selectedSlug}
						isNew={isCreating}
						onSaved={handleSaved}
						onCancel={() => {
							setDialogOpen(false);
							setIsCreating(false);
						}}
					/>
				</DialogContent>
			</Dialog>
			<Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>{t('skills.installTitle')}</DialogTitle>
						<DialogDescription>{t('skills.installDescription')}</DialogDescription>
					</DialogHeader>
					<AiSkillInstallDialog
						sessionId={activeSessionId}
						onInstalled={(slug) => {
							setSelectedSlug(slug);
							setInstallDialogOpen(false);
						}}
						onCancel={() => setInstallDialogOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
