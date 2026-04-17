import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { usePersistentLayout } from '@/shared/hooks/use-persistent-layout';
import { useAiSkillsQuery } from '@/entities/ai-skill/model/use-ai-skills-query';
import { AiSkillList } from './ai-skill-list';
import { AiSkillEditor } from './ai-skill-editor';

export function AiSkillPage() {
	const { t } = useTranslation('chat');
	const { defaultLayout, onLayoutChanged } = usePersistentLayout({
		id: 'ai-skill-layout',
	});
	const { data: skills = [], isLoading } = useAiSkillsQuery();
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);

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

	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="h-full"
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel defaultSize={defaultLayout?.[0] ?? 30} minSize={20}>
				<div className="flex h-full flex-col">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<span className="text-sm font-medium">{t('skills.title')}</span>
						<Button size="sm" variant="ghost" onClick={handleNew} className="cursor-pointer h-7 px-2">
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					<AiSkillList
						skills={skills}
						isLoading={isLoading}
						selectedSlug={selectedSlug}
						onSelect={handleSelect}
						onDeleted={handleDeleted}
					/>
				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={defaultLayout?.[1] ?? 70}>
				<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
					{t('skills.selectOrCreate')}
				</div>
			</ResizablePanel>
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
		</ResizablePanelGroup>
	);
}
