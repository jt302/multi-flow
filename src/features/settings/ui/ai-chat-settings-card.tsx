import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Star, Wifi, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatContextWindow, getModelCapability } from '@/entities/ai/model/model-capabilities';
import { useDefaultAiConfigQuery, useSetDefaultAiConfigMutation } from '@/entities/ai/model/use-default-ai-config-query';
import { listAiConfigs } from '@/entities/automation/api/automation-api';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

type ConnectionTestResult = {
	success: boolean;
	latencyMs?: number;
	error?: string;
};

export function AiChatSettingsCard() {
	const { t } = useTranslation('settings');
	const configsQuery = useQuery({ queryKey: ['ai-configs'], queryFn: listAiConfigs });
	const configs = configsQuery.data ?? [];
	const hasConfigs = configs.length > 0;

	const defaultConfigQuery = useDefaultAiConfigQuery();
	const setDefaultMutation = useSetDefaultAiConfigMutation();
	const defaultConfigId = defaultConfigQuery.data ?? null;

	const [selectedConfigId, setSelectedConfigId] = useState<string>('');
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

	const selectedConfig = configs.find((c) => c.id === selectedConfigId);
	const modelCap = selectedConfig ? getModelCapability(selectedConfig.model ?? '') : null;
	const configSelectPlaceholder = hasConfigs
		? t('aiChatSettings.selectConfig', 'Select AI Config')
		: t('aiChatSettings.noConfigs', '暂无 AI 配置');

	const handleTest = async () => {
		if (!selectedConfigId) return;
		setTesting(true);
		setTestResult(null);
		try {
			const result = await tauriInvoke<ConnectionTestResult>('test_ai_connection', {
				configId: selectedConfigId,
			});
			setTestResult(result);
		} catch (e) {
			setTestResult({ success: false, error: String(e) });
		} finally {
			setTesting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Wifi className="h-5 w-5" />
					{t('aiChatSettings.title', 'AI Chat Settings')}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* 默认 AI 模型 */}
				<div className="space-y-2">
					<label className="text-sm font-medium">
						{t('aiChatSettings.defaultModel', '默认 AI 模型')}
					</label>
					<Select
						value={defaultConfigId ?? '__none__'}
						disabled={!hasConfigs}
						onValueChange={(v) => setDefaultMutation.mutate(v === '__none__' ? null : v)}
					>
						<SelectTrigger className="w-full cursor-pointer">
							<SelectValue>
								{defaultConfigId
									? (() => {
											const c = configs.find((c) => c.id === defaultConfigId);
											return c ? `${c.name}${c.model ? ` (${c.model})` : ''}` : t('aiChatSettings.noDefault', '未设置默认');
										})()
									: t('aiChatSettings.noDefault', '未设置默认')}
							</SelectValue>
						</SelectTrigger>
						{hasConfigs ? (
							<SelectContent position="popper" className="z-[200]">
								<SelectItem value="__none__">
									{t('aiChatSettings.noDefault', '未设置默认')}
								</SelectItem>
								{configs.map((c) => (
									<SelectItem key={c.id} value={c.id} className="cursor-pointer">
										{c.name}
										{c.model ? ` (${c.model})` : ''}
									</SelectItem>
								))}
							</SelectContent>
						) : null}
					</Select>
				</div>

				{/* 连接测试 */}
				<div className="space-y-2">
					<label className="text-sm font-medium">
						{t('aiChatSettings.connectionTest', 'Connection Test')}
					</label>
					<div className="flex items-center gap-2">
						<Select value={selectedConfigId} onValueChange={setSelectedConfigId} disabled={!hasConfigs}>
							<SelectTrigger className="flex-1">
								<SelectValue placeholder={configSelectPlaceholder} />
							</SelectTrigger>
							{hasConfigs ? (
								<SelectContent>
									{configs.map((c) => (
										<SelectItem key={c.id} value={c.id}>
											{c.name} ({c.model}){c.id === defaultConfigId ? ` ${t('aiChatSettings.isDefault', '（默认）')}` : ''}
										</SelectItem>
									))}
								</SelectContent>
							) : null}
						</Select>
						<Button
							size="sm"
							variant="outline"
							disabled={!selectedConfigId || testing}
							onClick={handleTest}
							className="cursor-pointer"
						>
							{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('aiChatSettings.test', 'Test')}
						</Button>
						<Button
							size="sm"
							variant={selectedConfigId && selectedConfigId === defaultConfigId ? 'default' : 'outline'}
							disabled={!selectedConfigId || setDefaultMutation.isPending}
							onClick={() => {
								if (selectedConfigId === defaultConfigId) {
									setDefaultMutation.mutate(null);
								} else {
									setDefaultMutation.mutate(selectedConfigId);
								}
							}}
							className="cursor-pointer"
							title={selectedConfigId === defaultConfigId
								? t('aiChatSettings.removeDefault', '取消默认')
								: t('aiChatSettings.setDefault', '设为默认')}
						>
							<Star className={`h-4 w-4 ${selectedConfigId && selectedConfigId === defaultConfigId ? 'fill-current' : ''}`} />
						</Button>
					</div>
					{testResult && (
						<div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
							{testResult.success ? (
								<>
									<Check className="h-4 w-4" />
									<span>{t('aiChatSettings.connected', 'Connected')} ({testResult.latencyMs}ms)</span>
								</>
							) : (
								<>
									<X className="h-4 w-4" />
									<span className="truncate">{testResult.error}</span>
								</>
							)}
						</div>
					)}
				</div>

				{/* 模型能力 */}
				{modelCap && (
					<div className="space-y-2">
						<label className="text-sm font-medium">
							{t('aiChatSettings.modelCapabilities', 'Model Capabilities')}
						</label>
						<div className="flex flex-wrap gap-2 text-xs">
							<span className="rounded bg-muted px-2 py-1 tabular-nums">
								{formatContextWindow(modelCap.contextWindow)} ctx
							</span>
							{modelCap.vision && (
								<span className="rounded bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
									Vision
								</span>
							)}
							{modelCap.tools && (
								<span className="rounded bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300">
									Tools
								</span>
							)}
							{modelCap.thinking && (
								<span className="rounded bg-purple-100 px-2 py-1 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
									Thinking
								</span>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
