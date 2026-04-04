import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
import {
	createAiConfig,
	deleteAiConfig,
	listAiConfigs,
	updateAiConfig,
} from '@/entities/automation/api/automation-api';
import type {
	AiConfigEntry,
	AiProviderType,
} from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';

type ProviderMeta = {
	label: string;
	defaultBaseUrl: string;
	models: string[];
	requiresApiKey: boolean;
};

const PROVIDER_CONFIG: Record<AiProviderType, ProviderMeta> = {
	openai: {
		label: 'OpenAI',
		defaultBaseUrl: 'https://api.openai.com/v1',
		models: [
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-4.1',
			'gpt-4.1-mini',
			'gpt-4.1-nano',
			'o3',
			'o3-mini',
			'o4-mini',
		],
		requiresApiKey: true,
	},
	anthropic: {
		label: 'Anthropic',
		defaultBaseUrl: 'https://api.anthropic.com',
		models: [
			'claude-sonnet-4-20250514',
			'claude-opus-4-20250514',
			'claude-3-7-sonnet-20250219',
			'claude-3-5-haiku-20241022',
		],
		requiresApiKey: true,
	},
	gemini: {
		label: 'Gemini',
		defaultBaseUrl: 'https://generativelanguage.googleapis.com',
		models: [
			'gemini-2.5-flash',
			'gemini-2.5-pro',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
		],
		requiresApiKey: true,
	},
	deepseek: {
		label: 'DeepSeek',
		defaultBaseUrl: 'https://api.deepseek.com/v1',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		requiresApiKey: true,
	},
	openrouter: {
		label: 'OpenRouter',
		defaultBaseUrl: 'https://openrouter.ai/api/v1',
		models: [
			'openai/gpt-4o',
			'anthropic/claude-sonnet-4',
			'google/gemini-2.5-flash',
			'deepseek/deepseek-chat-v3',
		],
		requiresApiKey: true,
	},
	groq: {
		label: 'Groq',
		defaultBaseUrl: 'https://api.groq.com/openai/v1',
		models: [
			'llama-3.3-70b-versatile',
			'llama-3.1-8b-instant',
			'mixtral-8x7b-32768',
			'gemma2-9b-it',
		],
		requiresApiKey: true,
	},
	together: {
		label: 'Together',
		defaultBaseUrl: 'https://api.together.xyz/v1',
		models: [
			'meta-llama/Llama-3.3-70B-Instruct-Turbo',
			'mistralai/Mixtral-8x7B-Instruct-v0.1',
			'Qwen/Qwen2.5-72B-Instruct-Turbo',
		],
		requiresApiKey: true,
	},
	ollama: {
		label: 'Ollama',
		defaultBaseUrl: 'http://localhost:11434/v1',
		models: ['llama3.1', 'qwen2.5', 'mistral', 'deepseek-r1'],
		requiresApiKey: false,
	},
	custom: {
		label: 'Custom',
		defaultBaseUrl: '',
		models: [],
		requiresApiKey: true,
	},
};

function getAiProviders(t: (key: string) => string) {
	return Object.entries(PROVIDER_CONFIG).map(([value, meta]) => ({
		value: value as AiProviderType,
		label: value === 'custom' ? t('settings:ai.custom') : meta.label,
	}));
}

type FormValues = {
	name: string;
	provider: AiProviderType;
	baseUrl: string;
	apiKey: string;
	model: string;
	locale: string;
};

export function AiProviderConfigCard() {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const aiProviders = getAiProviders(t);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEntry, setEditingEntry] = useState<AiConfigEntry | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AiConfigEntry | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const { data: configs = [] } = useQuery({
		queryKey: queryKeys.aiConfigs,
		queryFn: listAiConfigs,
	});

	const { register, handleSubmit, reset, setValue, watch } =
		useForm<FormValues>({
			defaultValues: {
				name: '',
				provider: 'openai',
				baseUrl: '',
				apiKey: '',
				model: '',
				locale: 'zh',
			},
		});
	const selectedProvider = watch('provider');
	const providerMeta = PROVIDER_CONFIG[selectedProvider];

	const createMutation = useMutation({
		mutationFn: createAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success(t('settings:ai.added'));
			closeDialog();
		},
		onError: (e) =>
			toast.error(t('settings:ai.addFailed', { error: String(e) })),
	});

	const updateMutation = useMutation({
		mutationFn: updateAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success(t('settings:ai.updated'));
			closeDialog();
		},
		onError: (e) =>
			toast.error(t('settings:ai.updateFailed', { error: String(e) })),
	});

	const deleteMutation = useMutation({
		mutationFn: deleteAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success(t('settings:ai.deleted'));
		},
		onError: (e) =>
			toast.error(t('settings:ai.deleteFailed', { error: String(e) })),
	});

	function openAdd() {
		setEditingEntry(null);
		reset({
			name: '',
			provider: 'openai',
			baseUrl: '',
			apiKey: '',
			model: '',
			locale: 'zh',
		});
		setShowAdvanced(false);
		setDialogOpen(true);
	}

	function openEdit(entry: AiConfigEntry) {
		setEditingEntry(entry);
		reset({
			name: entry.name,
			provider: entry.provider ?? 'openai',
			baseUrl: entry.baseUrl ?? '',
			apiKey: entry.apiKey ?? '',
			model: entry.model ?? '',
			locale: entry.locale ?? 'zh',
		});
		setShowAdvanced(!!entry.baseUrl);
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingEntry(null);
	}

	function onSubmit(values: FormValues) {
		const payload = {
			name: values.name.trim() || t('settings:ai.unnamed'),
			provider: values.provider as AiProviderType,
			baseUrl: values.baseUrl || undefined,
			apiKey: values.apiKey || undefined,
			model: values.model || undefined,
			locale: values.locale || 'zh',
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
					<CardTitle className="text-sm">{t('settings:ai.title')}</CardTitle>
					<Button
						size="sm"
						variant="outline"
						className="h-7 cursor-pointer"
						onClick={openAdd}
					>
						<Plus className="h-3.5 w-3.5 mr-1" />
						{t('common:add')}
					</Button>
				</CardHeader>
				<CardContent className="p-0">
					{configs.length === 0 ? (
						<p className="text-xs text-muted-foreground py-4 text-center">
							{t('settings:ai.empty')}
						</p>
					) : (
						<div className="space-y-2">
							{configs.map((entry) => (
								<div
									key={entry.id}
									className="flex items-center justify-between rounded-md border px-3 py-2"
								>
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium truncate">
											{entry.name}
										</div>
										<div className="text-xs text-muted-foreground truncate">
											{aiProviders.find((p) => p.value === entry.provider)
												?.label ??
												entry.provider ??
												'—'}
											{entry.model ? ` · ${entry.model}` : ''}
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

			{/* 添加/编辑对话框 */}
			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
			>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
					<DialogTitle>
						{editingEntry ? t('settings:aiDialog.editTitle') : t('settings:aiDialog.createTitle')}
					</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
					<div className="space-y-1.5">
						<Label className="text-xs">{t('settings:aiDialog.configName')}</Label>
						<Input
							{...register('name')}
							placeholder={t('settings:aiDialog.configNamePlaceholder')}
							className="h-8 text-xs"
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">{t('settings:aiDialog.provider')}</Label>
							<Select
								value={selectedProvider}
								onValueChange={(v) => setValue('provider', v as AiProviderType)}
							>
								<SelectTrigger className="h-8 text-xs cursor-pointer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{aiProviders.map((p) => (
										<SelectItem
											key={p.value}
											value={p.value}
											className="text-xs cursor-pointer"
										>
											{p.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{providerMeta.requiresApiKey && (
							<div className="space-y-1.5">
								<Label className="text-xs">{t('settings:captcha.apiKey')}</Label>
								<Input
									{...register('apiKey')}
									type="password"
									placeholder={
										selectedProvider === 'openai' ? 'sk-...' : 'API Key'
									}
									className="h-8 text-xs"
								/>
							</div>
						)}
						<div className="space-y-1.5">
						<Label className="text-xs">{t('settings:aiDialog.model')}</Label>
						<Input
							{...register('model')}
							placeholder={
								providerMeta.models.length > 0
									? t('settings:aiDialog.modelPlaceholder')
									: t('settings:aiDialog.modelInputLabel')
							}
								className="h-8 text-xs"
								list={
									providerMeta.models.length > 0
										? `model-suggestions-${watch('provider')}`
										: undefined
								}
							/>
							{providerMeta.models.length > 0 && (
								<datalist id={`model-suggestions-${watch('provider')}`}>
									{providerMeta.models.map((m) => (
										<option key={m} value={m} />
									))}
								</datalist>
							)}
						</div>
					<div className="space-y-1.5">
						<Label className="text-xs">{t('settings:aiDialog.agentLanguage')}</Label>
						<Select
							value={watch('locale') || 'zh'}
							onValueChange={(v) => setValue('locale', v)}
						>
							<SelectTrigger className="h-8 text-xs cursor-pointer">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="zh" className="text-xs cursor-pointer">
									{t('settings:language.zhCN')}
								</SelectItem>
								<SelectItem value="en" className="text-xs cursor-pointer">
									{t('settings:language.enUS')}
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-[10px] text-muted-foreground">
							{t('settings:aiDialog.agentLanguageHint')}
						</p>
					</div>
						{/* Base URL: 自定义提供商始终显示，其他提供商折叠在高级选项中 */}
					{selectedProvider === 'custom' ? (
						<div className="space-y-1.5">
							<Label className="text-xs">{t('settings:captcha.baseUrl')}</Label>
							<Input
								{...register('baseUrl')}
								placeholder="https://your-api-endpoint.com/v1"
								className="h-8 text-xs"
							/>
						</div>
					) : (
						<div className="space-y-1.5">
							<button
								type="button"
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={() => setShowAdvanced(!showAdvanced)}
							>
								{showAdvanced ? (
									<ChevronUp className="h-3 w-3" />
								) : (
									<ChevronDown className="h-3 w-3" />
								)}
								{t('settings:aiDialog.advancedOptions')}
							</button>
							{showAdvanced && (
								<div className="space-y-1.5 pl-1">
									<Label className="text-xs">
										{t('settings:captcha.baseUrl')}
										<span className="text-muted-foreground ml-1">
											{t('settings:captcha.baseUrlHint')}
										</span>
									</Label>
									<Input
										{...register('baseUrl')}
										placeholder={providerMeta.defaultBaseUrl}
										className="h-8 text-xs"
									/>
								</div>
							)}
						</div>
					)}
					<DialogFooter>
						<Button
							type="submit"
							size="sm"
							className="cursor-pointer"
							disabled={isPending}
						>
							{isPending ? t('settings:aiDialog.saving') : t('settings:aiDialog.save')}
						</Button>
					</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* 删除确认 */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('settings:aiDialog.deleteTitle')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('settings:aiDialog.deleteDesc', { name: deleteTarget?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">
							{t('settings:aiDialog.cancel')}
						</AlertDialogCancel>
						<AlertDialogAction
							className="cursor-pointer"
							onClick={() => {
								if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
								setDeleteTarget(null);
							}}
						>
							{t('settings:aiDialog.delete')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
