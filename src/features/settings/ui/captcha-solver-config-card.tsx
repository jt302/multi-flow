import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
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
} from '@/components/ui';
import type { CaptchaSolverConfig } from '@/entities/automation/model/types';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

const CAPTCHA_PROVIDER_VALUES = ['2captcha', 'capsolver', 'anticaptcha', 'capmonster'] as const;
type CaptchaProviderValue = (typeof CAPTCHA_PROVIDER_VALUES)[number];

const CAPTCHA_PROVIDERS = [
	{ value: '2captcha', label: '2Captcha' },
	{ value: 'capsolver', label: 'CapSolver' },
	{ value: 'anticaptcha', label: 'Anti-Captcha' },
	{ value: 'capmonster', label: 'CapMonster Cloud' },
];

function normalizeCaptchaProvider(provider: string): CaptchaProviderValue {
	return CAPTCHA_PROVIDER_VALUES.includes(provider as CaptchaProviderValue)
		? (provider as CaptchaProviderValue)
		: '2captcha';
}

export const captchaSolverFormSchema = z.object({
	provider: z.enum(CAPTCHA_PROVIDER_VALUES),
	apiKey: z.string().trim().min(1),
	baseUrl: z
		.string()
		.trim()
		.refine((value) => value === '' || /^https?:\/\//.test(value), {
			message: 'Invalid URL',
		})
		.refine(
			(value) => {
				if (value === '') return true;
				try {
					new URL(value);
					return true;
				} catch {
					return false;
				}
			},
			{ message: 'Invalid URL' },
		),
	isDefault: z.boolean(),
});

type FormValues = z.infer<typeof captchaSolverFormSchema>;

async function listCaptchaConfigs(): Promise<CaptchaSolverConfig[]> {
	return tauriInvoke<CaptchaSolverConfig[]>('list_captcha_configs');
}

async function createCaptchaConfig(
	entry: Omit<CaptchaSolverConfig, 'id'>,
): Promise<CaptchaSolverConfig> {
	return tauriInvoke<CaptchaSolverConfig>('create_captcha_config', { entry });
}

async function updateCaptchaConfig(entry: CaptchaSolverConfig): Promise<void> {
	return tauriInvoke<void>('update_captcha_config', { entry });
}

async function deleteCaptchaConfig(id: string): Promise<void> {
	return tauriInvoke<void>('delete_captcha_config', { id });
}

export function CaptchaSolverConfigCard() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEntry, setEditingEntry] = useState<CaptchaSolverConfig | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CaptchaSolverConfig | null>(null);

	const { data: configs = [] } = useQuery({
		queryKey: ['captcha-configs'],
		queryFn: listCaptchaConfigs,
	});

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(captchaSolverFormSchema),
		defaultValues: {
			provider: '2captcha',
			apiKey: '',
			baseUrl: '',
			isDefault: false,
		},
	});
	const selectedProvider = watch('provider');

	const createMutation = useMutation({
		mutationFn: createCaptchaConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['captcha-configs'] });
			toast.success(t('settings:captcha.added'));
			closeDialog();
		},
		onError: (e) => toast.error(t('settings:captcha.addFailed', { error: String(e) })),
	});

	const updateMutation = useMutation({
		mutationFn: updateCaptchaConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['captcha-configs'] });
			toast.success(t('settings:captcha.updated'));
			closeDialog();
		},
		onError: (e) => toast.error(t('settings:captcha.updateFailed', { error: String(e) })),
	});

	const deleteMutation = useMutation({
		mutationFn: deleteCaptchaConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['captcha-configs'] });
			toast.success(t('settings:captcha.deleted'));
		},
		onError: (e) => toast.error(t('settings:captcha.deleteFailed', { error: String(e) })),
	});

	function openAdd() {
		setEditingEntry(null);
		reset({ provider: '2captcha', apiKey: '', baseUrl: '', isDefault: false });
		setDialogOpen(true);
	}

	function openEdit(entry: CaptchaSolverConfig) {
		setEditingEntry(entry);
		reset({
			provider: normalizeCaptchaProvider(entry.provider),
			apiKey: entry.apiKey,
			baseUrl: entry.baseUrl ?? '',
			isDefault: entry.isDefault,
		});
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingEntry(null);
	}

	function onSubmit(values: FormValues) {
		const payload = {
			provider: values.provider,
			apiKey: values.apiKey.trim(),
			baseUrl: values.baseUrl.trim() || undefined,
			isDefault: values.isDefault,
		};
		if (editingEntry) {
			updateMutation.mutate({ id: editingEntry.id, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	}

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<>
			<Card className="p-4">
				<CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
					<CardTitle className="text-sm">{t('settings:captcha.title')}</CardTitle>
					<Button size="sm" variant="outline" className="h-7 cursor-pointer" onClick={openAdd}>
						<Plus className="h-3.5 w-3.5 mr-1" />
						{t('common:add')}
					</Button>
				</CardHeader>
				<CardContent className="p-0">
					{configs.length === 0 ? (
						<p className="text-xs text-muted-foreground py-4 text-center">
							{t('settings:captcha.empty')}
						</p>
					) : (
						<div className="space-y-2">
							{configs.map((entry) => (
								<div
									key={entry.id}
									className="flex items-center justify-between rounded-md border px-3 py-2"
								>
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium truncate flex items-center gap-1.5">
											{entry.isDefault && (
												<Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
											)}
											{CAPTCHA_PROVIDERS.find((p) => p.value === entry.provider)?.label ??
												entry.provider}
										</div>
										<div className="text-xs text-muted-foreground truncate">
											{entry.apiKey.slice(0, 8)}...
										</div>
									</div>
									<div className="flex items-center gap-1 ml-2 shrink-0">
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 cursor-pointer"
											onClick={() => openEdit(entry)}
										>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive"
											onClick={() => setDeleteTarget(entry)}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingEntry ? t('settings:captcha.editTitle') : t('settings:captcha.createTitle')}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
						<div className="space-y-1.5">
							<Label className="text-xs">{t('settings:captcha.provider')}</Label>
							<Select
								value={selectedProvider}
								onValueChange={(v) =>
									setValue('provider', v as FormValues['provider'], { shouldValidate: true })
								}
							>
								<SelectTrigger className="h-8 text-xs cursor-pointer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CAPTCHA_PROVIDERS.map((p) => (
										<SelectItem key={p.value} value={p.value} className="text-xs cursor-pointer">
											{p.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.provider && (
								<p className="text-xs text-destructive">{t('settings:captcha.invalidProvider')}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">{t('settings:captcha.apiKey')}</Label>
							<Input
								{...register('apiKey')}
								type="password"
								placeholder="API Key"
								className="h-8 text-xs"
							/>
							{errors.apiKey && (
								<p className="text-xs text-destructive">{t('settings:captcha.apiKeyRequired')}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">
								{t('settings:captcha.baseUrl')}
								<span className="text-muted-foreground ml-1">
									{t('settings:captcha.baseUrlHint')}
								</span>
							</Label>
							<Input
								{...register('baseUrl')}
								placeholder={t('settings:captcha.baseUrlPlaceholder')}
								className="h-8 text-xs"
							/>
							{errors.baseUrl && (
								<p className="text-xs text-destructive">{t('settings:captcha.baseUrlInvalid')}</p>
							)}
						</div>
						<DialogFooter>
							<Button type="submit" size="sm" className="cursor-pointer" disabled={isPending}>
								{isPending ? t('common:savingInProgress') : t('common:save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings:captcha.deleteTitle')}</AlertDialogTitle>
						<AlertDialogDescription>{t('settings:captcha.deleteDesc')}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">{t('common:cancel')}</AlertDialogCancel>
						<AlertDialogAction
							className="cursor-pointer"
							onClick={() => {
								if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
								setDeleteTarget(null);
							}}
						>
							{t('common:delete')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
