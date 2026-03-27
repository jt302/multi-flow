import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readAiProviderConfig, updateAiProviderConfig } from '@/entities/automation/api/automation-api';
import type { AiProviderConfig } from '@/entities/automation/model/types';

export function AiProviderConfigCard() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ['ai-provider-config'],
		queryFn: readAiProviderConfig,
	});

	const { register, handleSubmit, reset } = useForm<AiProviderConfig>({
		defaultValues: { baseUrl: '', apiKey: '', model: '' },
	});

	useEffect(() => {
		if (data) reset(data);
	}, [data, reset]);

	const mutation = useMutation({
		mutationFn: updateAiProviderConfig,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-provider-config'] }),
	});

	function onSubmit(values: AiProviderConfig) {
		mutation.mutate(values);
	}

	return (
		<Card className="p-4">
			<CardHeader className="p-0 mb-3">
				<CardTitle className="text-sm">AI 配置</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
						<Label className="text-xs">默认模型</Label>
						<Input
							{...register('model')}
							placeholder="gpt-4o"
							className="h-8 text-xs"
						/>
					</div>
					<Button
						type="submit"
						size="sm"
						className="cursor-pointer"
						disabled={mutation.isPending}
					>
						{mutation.isPending ? '保存中...' : '保存'}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
