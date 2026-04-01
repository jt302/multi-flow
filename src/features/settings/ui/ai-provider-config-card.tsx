import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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

const AI_PROVIDERS: { value: AiProviderType; label: string }[] = [
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'anthropic', label: 'Anthropic' },
	{ value: 'gemini', label: 'Gemini' },
	{ value: 'deepseek', label: 'DeepSeek' },
	{ value: 'openrouter', label: 'OpenRouter' },
	{ value: 'groq', label: 'Groq' },
	{ value: 'together', label: 'Together' },
	{ value: 'ollama', label: 'Ollama' },
	{ value: 'custom', label: '自定义' },
];

type FormValues = {
	name: string;
	provider: AiProviderType;
	baseUrl: string;
	apiKey: string;
	model: string;
};

export function AiProviderConfigCard() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEntry, setEditingEntry] = useState<AiConfigEntry | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AiConfigEntry | null>(null);

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
			},
		});
	const selectedProvider = watch('provider');

	const createMutation = useMutation({
		mutationFn: createAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success('已添加 AI 配置');
			closeDialog();
		},
		onError: (e) => toast.error(`添加失败: ${e}`),
	});

	const updateMutation = useMutation({
		mutationFn: updateAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success('已更新 AI 配置');
			closeDialog();
		},
		onError: (e) => toast.error(`更新失败: ${e}`),
	});

	const deleteMutation = useMutation({
		mutationFn: deleteAiConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.aiConfigs });
			toast.success('已删除 AI 配置');
		},
		onError: (e) => toast.error(`删除失败: ${e}`),
	});

	function openAdd() {
		setEditingEntry(null);
		reset({ name: '', provider: 'openai', baseUrl: '', apiKey: '', model: '' });
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
		});
		setDialogOpen(true);
	}

	function closeDialog() {
		setDialogOpen(false);
		setEditingEntry(null);
	}

	function onSubmit(values: FormValues) {
		const payload = {
			name: values.name.trim() || '未命名配置',
			provider: values.provider as AiProviderType,
			baseUrl: values.baseUrl || undefined,
			apiKey: values.apiKey || undefined,
			model: values.model || undefined,
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
					<CardTitle className="text-sm">AI 模型配置</CardTitle>
					<Button
						size="sm"
						variant="outline"
						className="h-7 cursor-pointer"
						onClick={openAdd}
					>
						<Plus className="h-3.5 w-3.5 mr-1" />
						添加
					</Button>
				</CardHeader>
				<CardContent className="p-0">
					{configs.length === 0 ? (
						<p className="text-xs text-muted-foreground py-4 text-center">
							暂无 AI 配置，点击「添加」创建第一个
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
											{AI_PROVIDERS.find((p) => p.value === entry.provider)
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
							{editingEntry ? '编辑 AI 配置' : '添加 AI 配置'}
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
						<div className="space-y-1.5">
							<Label className="text-xs">配置名称</Label>
							<Input
								{...register('name')}
								placeholder="例如：GPT-4o"
								className="h-8 text-xs"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">提供商</Label>
							<Select
								value={selectedProvider}
								onValueChange={(v) => setValue('provider', v as AiProviderType)}
							>
								<SelectTrigger className="h-8 text-xs cursor-pointer">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{AI_PROVIDERS.map((p) => (
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
						<div className="space-y-1.5">
							<Label className="text-xs">Base URL</Label>
							<Input
								{...register('baseUrl')}
								placeholder="https://api.openai.com/v1"
								className="h-8 text-xs"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">API Key</Label>
							<Input
								{...register('apiKey')}
								type="password"
								placeholder="sk-..."
								className="h-8 text-xs"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">模型</Label>
							<Input
								{...register('model')}
								placeholder="gpt-4o"
								className="h-8 text-xs"
							/>
						</div>
						<DialogFooter>
							<Button
								type="submit"
								size="sm"
								className="cursor-pointer"
								disabled={isPending}
							>
								{isPending ? '保存中...' : '保存'}
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
						<AlertDialogTitle>删除 AI 配置</AlertDialogTitle>
						<AlertDialogDescription>
							确定要删除「{deleteTarget?.name}」吗？此操作无法撤销。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="cursor-pointer">
							取消
						</AlertDialogCancel>
						<AlertDialogAction
							className="cursor-pointer"
							onClick={() => {
								if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
								setDeleteTarget(null);
							}}
						>
							删除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
