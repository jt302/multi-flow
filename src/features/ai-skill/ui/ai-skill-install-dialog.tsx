import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInstallAiSkill } from '../model/use-ai-skill-mutations';

const schema = (t: (key: string) => string) =>
	z.object({
		source: z.string().trim().min(1, t('skills.installSourceRequired')),
	});

type FormValues = z.infer<ReturnType<typeof schema>>;

type Props = {
	sessionId: string | null;
	onInstalled: (slug: string) => void;
	onCancel: () => void;
};

export function AiSkillInstallDialog({ sessionId, onInstalled, onCancel }: Props) {
	const { t } = useTranslation('chat');
	const installSkill = useInstallAiSkill();
	const formSchema = useMemo(() => schema(t), [t]);
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			source: '',
		},
	});

	const onSubmit = (values: FormValues) => {
		installSkill.mutate(
			{
				source: values.source.trim(),
				enableForSession: !!sessionId,
				sessionId: sessionId ?? undefined,
			},
			{
				onSuccess: (installed) => {
					toast.success(
						installed.enabledForSession
							? t('skills.installedAndEnabled', { name: installed.name })
							: t('skills.installed', { name: installed.name }),
					);
					for (const warning of installed.warnings) {
						toast.warning(warning);
					}
					form.reset();
					onInstalled(installed.slug);
				},
				onError: (err) => toast.error(String(err)),
			},
		);
	};

	return (
		<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
			<div className="space-y-2">
				<Label className="text-xs">{t('skills.installSource')}</Label>
				<Input
					{...form.register('source')}
					autoFocus
					placeholder={t('skills.installSourcePlaceholder')}
					className="h-9 text-sm"
				/>
				{form.formState.errors.source ? (
					<p className="text-xs text-destructive">{form.formState.errors.source.message}</p>
				) : null}
				<p className="text-xs text-muted-foreground">{t('skills.installHint')}</p>
			</div>
			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					className="cursor-pointer"
					disabled={installSkill.isPending}
				>
					{t('cancel', '取消')}
				</Button>
				<Button type="submit" className="cursor-pointer" disabled={installSkill.isPending}>
					{installSkill.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
					{installSkill.isPending ? t('skills.installPending') : t('skills.installAction')}
				</Button>
			</DialogFooter>
		</form>
	);
}
