import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AiSkillMeta } from '@/entities/ai-skill/model/types';
import { useDeleteAiSkill, useUpdateAiSkill } from '@/features/ai-skill/model/use-ai-skill-mutations';

interface Props {
	skills: AiSkillMeta[];
	isLoading: boolean;
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
}

export function AiSkillList({ skills, isLoading, selectedSlug, onSelect }: Props) {
	const { t } = useTranslation('chat');
	const deleteMut = useDeleteAiSkill();
	const updateMut = useUpdateAiSkill();

	if (isLoading) {
		return <div className="p-4 text-sm text-muted-foreground">{t('skills.title')}...</div>;
	}

	if (skills.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
				{t('skills.empty')}
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto">
			{skills.map((skill) => (
				<div
					key={skill.slug}
					onClick={() => onSelect(skill.slug)}
					className={cn(
						'flex cursor-pointer items-center gap-2 border-b px-4 py-3 hover:bg-accent/50',
						selectedSlug === skill.slug && 'bg-accent',
					)}
				>
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium">{skill.name}</div>
						{skill.description && (
							<div className="truncate text-xs text-muted-foreground">{skill.description}</div>
						)}
					</div>
					<input
						type="checkbox"
						checked={skill.enabled}
						className="cursor-pointer"
						onClick={(e) => e.stopPropagation()}
						onChange={(e) =>
							updateMut.mutate({ slug: skill.slug, payload: { enabled: e.target.checked } })
						}
					/>
					<Button
						size="icon"
						variant="ghost"
						className="h-6 w-6 cursor-pointer shrink-0"
						onClick={(e) => {
							e.stopPropagation();
							if (!confirm(t('skills.confirmDelete', { name: skill.name }))) return;
							deleteMut.mutate(skill.slug, {
								onError: (err) => toast.error(String(err)),
							});
						}}
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			))}
		</div>
	);
}
