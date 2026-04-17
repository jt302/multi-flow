import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { useAiSkillsQuery } from '@/entities/ai-skill/model/use-ai-skills-query';
import { cn } from '@/lib/utils';

type Props = {
	selectedSlugs: string[];
	onSelectionChange: (slugs: string[]) => void;
};

export function SkillMultiSelect({ selectedSlugs, onSelectionChange }: Props) {
	const { t } = useTranslation('chat');
	const [open, setOpen] = useState(false);
	const { data: skills = [] } = useAiSkillsQuery();

	// 只显示 enabled=true 的 skill
	const enabledSkills = skills.filter((s) => s.enabled);

	const toggle = (slug: string) => {
		if (selectedSlugs.includes(slug)) {
			onSelectionChange(selectedSlugs.filter((s) => s !== slug));
		} else {
			onSelectionChange([...selectedSlugs, slug]);
		}
	};

	const remove = (slug: string, e: React.MouseEvent) => {
		e.stopPropagation();
		onSelectionChange(selectedSlugs.filter((s) => s !== slug));
	};

	const selectedSkills = skills.filter((s) => selectedSlugs.includes(s.slug));

	if (enabledSkills.length === 0) return null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1 h-8 px-2 rounded-md border text-xs transition-colors cursor-pointer shrink-0',
						selectedSlugs.length > 0
							? 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10'
							: 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent',
					)}
				>
					<Sparkles className="size-3" />
					{selectedSlugs.length > 0
						? t('skills.selectedCount', { count: selectedSlugs.length })
						: t('skills.selectSkills')}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-2" align="end">
				<div className="mb-2 text-xs font-medium text-muted-foreground px-1">
					{t('skills.title')}
				</div>

				{/* 已选 badges */}
				{selectedSkills.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-2 px-1">
						{selectedSkills.map((s) => (
							<Badge key={s.slug} variant="secondary" className="text-xs gap-1 pr-1">
								{s.name}
								<button
									type="button"
									onClick={(e) => remove(s.slug, e)}
									className="cursor-pointer hover:text-destructive"
								>
									<X className="size-2.5" />
								</button>
							</Badge>
						))}
					</div>
				)}

				{/* skill 列表 */}
				<div className="flex flex-col gap-0.5">
					{enabledSkills.map((skill) => {
						const selected = selectedSlugs.includes(skill.slug);
						return (
							<button
								key={skill.slug}
								type="button"
								onClick={() => toggle(skill.slug)}
								className={cn(
									'flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs w-full cursor-pointer transition-colors',
									selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
								)}
							>
								<span className={cn('size-2 rounded-full shrink-0', selected ? 'bg-primary' : 'bg-muted-foreground/30')} />
								<span className="flex-1 truncate">{skill.name}</span>
								{skill.description && (
									<span className="text-muted-foreground truncate max-w-[80px]">{skill.description}</span>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
