import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AiSkillMeta } from '@/entities/ai-skill/model/types';
import { useDeleteAiSkill, useUpdateAiSkill } from '@/features/ai-skill/model/use-ai-skill-mutations';

interface Props {
	skills: AiSkillMeta[];
	isLoading: boolean;
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	onDeleted: (slug: string) => void;
}

export function AiSkillList({ skills, isLoading, selectedSlug, onSelect, onDeleted }: Props) {
	const { t } = useTranslation('chat');
	const deleteMut = useDeleteAiSkill();
	const updateMut = useUpdateAiSkill();
	const [pendingDelete, setPendingDelete] = useState<AiSkillMeta | null>(null);

	if (isLoading) {
		return (
			<div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
				{t('skills.title')}...
			</div>
		);
	}

	if (skills.length === 0) {
		return (
			<div className="flex h-full min-h-52 items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
				{t('skills.empty')}
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto rounded-xl border border-border/70 bg-card p-3 shadow-sm">
			<div className="space-y-2">
				{skills.map((skill) => (
					<div
						key={skill.slug}
						onClick={() => onSelect(skill.slug)}
						className={cn(
							'rounded-xl border border-border/70 bg-card px-4 py-4 transition-colors hover:bg-accent/30',
							selectedSlug === skill.slug && 'border-primary/35 bg-accent/40',
						)}
					>
						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Sparkles className="size-4" />
							</div>
							<div className="min-w-0 flex-1 space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<div className="truncate text-sm font-medium text-foreground">{skill.name}</div>
									{skill.enabled ? (
										<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
											<BadgeCheck className="size-3" />
											{t('skills.enabledBadge')}
										</span>
									) : (
										<span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
											{t('skills.disabledBadge')}
										</span>
									)}
									{skill.builtIn && (
										<span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
											{t('skills.builtInBadge')}
										</span>
									)}
								</div>
								<div className="text-xs text-muted-foreground">
									{skill.description?.trim() || t('skills.noDescription')}
								</div>
								<div className="text-[11px] text-muted-foreground/90">
									{skill.slug}
									{skill.triggers.length > 0
										? ` · ${t('skills.triggerCount', { count: skill.triggers.length })}`
										: ''}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div
									className="flex items-center gap-2"
									onClick={(e) => e.stopPropagation()}
								>
									<span className="text-xs text-muted-foreground">{t('skills.fieldEnabled')}</span>
									<Switch
										checked={skill.enabled}
										onCheckedChange={(checked) =>
											updateMut.mutate({ slug: skill.slug, payload: { enabled: checked } })
										}
									/>
								</div>
								{skill.deletable && (
									<Button
										size="icon-sm"
										variant="ghost"
										className="cursor-pointer shrink-0"
										onClick={(e) => {
											e.stopPropagation();
											setPendingDelete(skill);
										}}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								)}
								<ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
							</div>
						</div>
					</div>
				))}
			</div>
			<ConfirmActionDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title={t('common:confirmDelete')}
				description={t('skills.confirmDelete', { name: pendingDelete?.name ?? '' })}
				confirmText={t('common:delete')}
				pending={deleteMut.isPending}
				onConfirm={() => {
					if (!pendingDelete) return;
					deleteMut.mutate(pendingDelete.slug, {
						onSuccess: () => {
							onDeleted(pendingDelete.slug);
							setPendingDelete(null);
						},
						onError: (err) => toast.error(String(err)),
					});
				}}
			/>
		</div>
	);
}
