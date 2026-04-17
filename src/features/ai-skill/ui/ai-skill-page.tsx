import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useAiSkillsQuery } from '@/entities/ai-skill/model/use-ai-skills-query';
import { AiSkillList } from './ai-skill-list';
import { AiSkillEditor } from './ai-skill-editor';

export function AiSkillPage() {
	const { t } = useTranslation('chat');
	const { data: skills = [], isLoading } = useAiSkillsQuery();
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const handleNew = () => {
		setSelectedSlug(null);
		setIsCreating(true);
	};

	const handleSelect = (slug: string) => {
		setSelectedSlug(slug);
		setIsCreating(false);
	};

	const handleSaved = (slug: string) => {
		setSelectedSlug(slug);
		setIsCreating(false);
	};

	return (
		<ResizablePanelGroup direction="horizontal" className="h-full">
			<ResizablePanel defaultSize={30} minSize={20}>
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
					/>
				</div>
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel defaultSize={70}>
				{isCreating || selectedSlug ? (
					<AiSkillEditor
						slug={selectedSlug}
						isNew={isCreating}
						onSaved={handleSaved}
						onCancel={() => { setIsCreating(false); setSelectedSlug(null); }}
					/>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{t('skills.selectOrCreate')}
					</div>
				)}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
