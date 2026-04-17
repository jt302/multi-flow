import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAiSkillQuery } from '@/entities/ai-skill/model/use-ai-skills-query';
import { useCreateAiSkill, useUpdateAiSkill } from '../model/use-ai-skill-mutations';

const schema = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/, 'slug 只允许 a-z、0-9、-').min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	version: z.string().optional(),
	body: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

interface Props {
	slug: string | null;
	isNew: boolean;
	onSaved: (slug: string) => void;
	onCancel: () => void;
}

export function AiSkillEditor({ slug, isNew, onSaved, onCancel }: Props) {
	const { t } = useTranslation('chat');
	const { data: existing } = useAiSkillQuery(isNew ? null : slug);
	const createMut = useCreateAiSkill();
	const updateMut = useUpdateAiSkill();

	const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { slug: '', name: '', description: '', version: '0.1.0', body: '' },
	});

	useEffect(() => {
		if (existing) {
			reset({ slug: existing.slug, name: existing.name, description: existing.description ?? '', version: existing.version ?? '', body: existing.body });
		} else if (isNew) {
			reset({ slug: '', name: '', description: '', version: '0.1.0', body: '' });
		}
	}, [existing, isNew, reset]);

	const onSubmit = (values: FormValues) => {
		if (isNew) {
			createMut.mutate(values, {
				onSuccess: (saved) => { toast.success(t('skills.saved')); onSaved(saved.slug); },
				onError: (err) => toast.error(String(err)),
			});
		} else if (slug) {
			updateMut.mutate({ slug, payload: { name: values.name, description: values.description, version: values.version, body: values.body } }, {
				onSuccess: () => { toast.success(t('skills.saved')); onSaved(slug); },
				onError: (err) => toast.error(String(err)),
			});
		}
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="flex max-h-[70vh] min-h-0 flex-col gap-4 overflow-auto"
		>
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<Label className="text-xs">Slug</Label>
					<Input {...register('slug')} disabled={!isNew} placeholder="my-skill" className="h-8 text-sm" />
					{errors.slug && <span className="text-xs text-destructive">{errors.slug.message}</span>}
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-xs">{t('skills.fieldName')}</Label>
					<Input {...register('name')} className="h-8 text-sm" />
					{errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<Label className="text-xs">{t('skills.fieldDesc')}</Label>
					<Input {...register('description')} className="h-8 text-sm" />
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-xs">{t('skills.fieldVersion')}</Label>
					<Input {...register('version')} className="h-8 text-sm" />
				</div>
			</div>
			<div className="flex flex-1 flex-col gap-1">
				<Label className="text-xs">{t('skills.fieldBody')}</Label>
				<Textarea {...register('body')} placeholder={t('skills.bodyPlaceholder')} className="flex-1 resize-none font-mono text-sm" />
				{errors.body && <span className="text-xs text-destructive">{errors.body.message}</span>}
			</div>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} className="cursor-pointer">{t('common:cancel')}</Button>
				<Button type="submit" disabled={createMut.isPending || updateMut.isPending || (!isNew && !isDirty)} className="cursor-pointer">{t('common:save')}</Button>
			</div>
		</form>
	);
}
