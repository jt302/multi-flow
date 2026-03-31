import { useEffect, useRef, useState } from 'react';

import { FileInput, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';

import {
	listAiConfigs,
	listenAutomationScriptUpdated,
	openAutomationCanvasWindow,
} from '@/entities/automation/api/automation-api';
import { useAutomationRunsQuery } from '@/entities/automation/model/use-automation-runs-query';
import { useAutomationScriptsQuery } from '@/entities/automation/model/use-automation-scripts-query';
import type { AutomationScript } from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';
import { useAutomationActions } from '@/features/automation/model/use-automation-actions';
import { useAutomationStore } from '@/store/automation-store';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ScriptDetailPanel } from './script-detail-panel';
import type { RunDelayConfig } from './run-dialog';

export function AutomationPage() {
	const scriptsQuery = useAutomationScriptsQuery();
	const scripts = scriptsQuery.data ?? [];
	const queryClient = useQueryClient();
	const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

	// 元数据编辑对话框
	const [metaDialogOpen, setMetaDialogOpen] = useState(false);
	const [metaDialogScript, setMetaDialogScript] =
		useState<AutomationScript | null>(null);
	const [metaName, setMetaName] = useState('');
	const [metaDesc, setMetaDesc] = useState('');
	const [metaAssociatedIds, setMetaAssociatedIds] = useState<string[]>([]);
	const [metaAiConfigId, setMetaAiConfigId] = useState<string | null>(null);
	const [profilePickerOpen, setProfilePickerOpen] = useState(false);

	const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? null;
	const runsQuery = useAutomationRunsQuery(selectedScriptId);
	const runs = runsQuery.data ?? [];

	const profilesQuery = useProfilesQuery();
	const allProfiles = (profilesQuery.data ?? []).filter(
		(profile) => profile.lifecycle === 'active',
	);
	const activeProfiles = allProfiles.filter((profile) => profile.running);
	const metaAssociatedProfiles = metaAssociatedIds
		.map((profileId) => allProfiles.find((profile) => profile.id === profileId))
		.filter(
			(profile): profile is (typeof allProfiles)[number] =>
				profile !== undefined,
		);
	const availableBindProfiles = allProfiles.filter(
		(profile) => !metaAssociatedIds.includes(profile.id),
	);

	const aiConfigsQuery = useQuery({
		queryKey: queryKeys.aiConfigs,
		queryFn: listAiConfigs,
	});
	const aiConfigs = aiConfigsQuery.data ?? [];

	const liveRunStatus = useAutomationStore((s) => s.liveRunStatus);
	const liveStepResults = useAutomationStore((s) => s.liveStepResults);
	const liveVariables = useAutomationStore((s) => s.liveVariables);
	const activeRunId = useAutomationStore((s) => s.activeRunId);
	const activeScriptId = useAutomationStore((s) => s.activeScriptId);

	const actions = useAutomationActions(selectedScriptId);

	const importInputRef = useRef<HTMLInputElement>(null);

	// 监听画布窗口的脚本保存事件，失效缓存确保主窗口同步最新步骤
	useEffect(() => {
		let unlistenEvent: (() => void) | undefined;
		let unlistenFocus: (() => void) | undefined;
		void listenAutomationScriptUpdated(() => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.automationScripts,
			});
		}).then((fn) => {
			unlistenEvent = fn;
		});
		// Tauri 多窗口环境：主窗口重新获得焦点时也刷新（浏览器 focus 事件不可靠）
		void getCurrentWindow()
			.onFocusChanged(({ payload: focused }) => {
				if (focused)
					void queryClient.invalidateQueries({
						queryKey: queryKeys.automationScripts,
					});
			})
			.then((fn) => {
				unlistenFocus = fn;
			});
		return () => {
			unlistenEvent?.();
			unlistenFocus?.();
		};
	}, [queryClient]);

	// ── 新建脚本：弹出名称对话框 → 创建空脚本 → 开画布窗口 ────────────────────
	function handleNewScript() {
		setMetaDialogScript(null);
		setMetaName('');
		setMetaDesc('');
		setMetaAssociatedIds([]);
		setMetaAiConfigId(null);
		setProfilePickerOpen(false);
		setMetaDialogOpen(true);
	}

	// ── 编辑元数据（名称/描述） ───────────────────────────────────────────────
	function handleEditMeta(script: AutomationScript) {
		setMetaDialogScript(script);
		setMetaName(script.name);
		setMetaDesc(script.description ?? '');
		setMetaAssociatedIds(script.associatedProfileIds ?? []);
		setMetaAiConfigId(script.aiConfigId ?? null);
		setProfilePickerOpen(false);
		setMetaDialogOpen(true);
	}

	function bindProfile(profileId: string) {
		setMetaAssociatedIds((prev) =>
			prev.includes(profileId) ? prev : [...prev, profileId],
		);
		setProfilePickerOpen(false);
	}

	function unbindProfile(profileId: string) {
		setMetaAssociatedIds((prev) => prev.filter((id) => id !== profileId));
	}

	async function handleMetaSave() {
		const name = metaName.trim();
		if (!name) return;
		if (metaDialogScript) {
			// 更新元数据，保留步骤不变
			await actions.updateScript.mutateAsync({
				scriptId: metaDialogScript.id,
				payload: {
					name,
					description: metaDesc || undefined,
					steps: metaDialogScript.steps,
					associatedProfileIds: metaAssociatedIds,
					aiConfigId: metaAiConfigId,
				},
			});
			setMetaDialogOpen(false);
		} else {
			// 新建空脚本 → 开画布窗口
			const created = await actions.createScript.mutateAsync({
				name,
				description: metaDesc || undefined,
				steps: [],
				aiConfigId: metaAiConfigId,
			});
			setSelectedScriptId(created.id);
			setMetaDialogOpen(false);
			await openAutomationCanvasWindow(created.id, created.name);
		}
	}

	// ── 删除脚本 ─────────────────────────────────────────────────────────────
	async function handleDeleteScript(scriptId: string) {
		await actions.deleteScript.mutateAsync(scriptId);
		if (selectedScriptId === scriptId) {
			setSelectedScriptId(null);
		}
	}

	// ── 运行 ─────────────────────────────────────────────────────────────────
	async function handleRun(
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) {
		if (!selectedScript) return;
		const normalizedDelay =
			delayConfig && delayConfig.enabled
				? {
						enabled: true,
						minSeconds: Math.max(
							0,
							Math.min(delayConfig.minSeconds, delayConfig.maxSeconds),
						),
						maxSeconds: Math.max(
							delayConfig.minSeconds,
							delayConfig.maxSeconds,
						),
					}
				: null;

		for (const profileId of profileIds) {
			await actions.runScript.mutateAsync({
				scriptId: selectedScript.id,
				profileId,
				stepTotal: selectedScript.steps.length,
				initialVars:
					Object.keys(initialVars).length > 0 ? initialVars : undefined,
				delayConfig: normalizedDelay,
			});
		}
	}

	async function handleDebugRun(
		profileId: string,
		initialVars: Record<string, string>,
	) {
		if (!selectedScript) return;
		await actions.debugRun.mutateAsync({
			scriptId: selectedScript.id,
			profileId,
			stepTotal: selectedScript.steps.length,
			initialVars:
				Object.keys(initialVars).length > 0 ? initialVars : undefined,
		});
	}

	// ── 导入脚本（JSON 文件） ─────────────────────────────────────────────────
	function handleImportClick() {
		importInputRef.current?.click();
	}

	async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = '';
		try {
			const text = await file.text();
			const json = JSON.parse(text) as {
				name?: string;
				description?: string;
				steps?: unknown[];
			};
			if (!json.name || !Array.isArray(json.steps)) {
				toast.error('无效的脚本文件：缺少 name 或 steps 字段');
				return;
			}
			const created = await actions.createScript.mutateAsync({
				name: json.name,
				description: json.description ?? undefined,
				steps: json.steps as never,
			});
			setSelectedScriptId(created.id);
			toast.success(
				`已导入脚本「${created.name}」（${created.steps.length} 步骤）`,
			);
		} catch {
			toast.error('脚本文件解析失败，请确认是有效的 JSON 格式');
		}
	}

	const isSaving =
		actions.createScript.isPending || actions.updateScript.isPending;

	return (
		<div className="flex h-full">
			{/* 左侧脚本列表 */}
			<div className="w-64 shrink-0 border-r flex flex-col">
				<div className="flex items-center justify-between px-4 py-3 border-b">
					<span className="text-sm font-medium">自动化脚本</span>
					<div className="flex items-center gap-1">
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0 cursor-pointer"
							onClick={handleImportClick}
							title="导入脚本"
						>
							<FileInput className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0 cursor-pointer"
							onClick={handleNewScript}
							title="新建脚本"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				</div>
				<ScrollArea className="flex-1">
					{scripts.length === 0 ? (
						<div className="px-4 py-8 text-center text-sm text-muted-foreground">
							<p>暂无脚本</p>
							<p className="mt-1">点击 + 新建</p>
						</div>
					) : (
						<div className="p-2 space-y-1">
							{scripts.map((script) => (
								<button
									key={script.id}
									type="button"
									onClick={() => setSelectedScriptId(script.id)}
									className={[
										'w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer',
										selectedScriptId === script.id
											? 'bg-accent text-accent-foreground'
											: 'hover:bg-muted',
									].join(' ')}
								>
									<div className="font-medium truncate">{script.name}</div>
									<div className="text-xs text-muted-foreground mt-0.5">
										{script.steps.length} 步骤
									</div>
								</button>
							))}
						</div>
					)}
				</ScrollArea>
			</div>

			{/* 右侧详情 */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{selectedScript ? (
					<ScriptDetailPanel
						script={selectedScript}
						runs={runs}
						activeProfiles={activeProfiles}
						allProfiles={allProfiles}
						isRunning={
							activeScriptId === selectedScript.id &&
							liveRunStatus === 'running'
						}
						liveStepResults={
							activeScriptId === selectedScript.id ? liveStepResults : []
						}
						liveVariables={
							activeScriptId === selectedScript.id ? liveVariables : {}
						}
						activeRunId={
							activeScriptId === selectedScript.id ? activeRunId : null
						}
						onEdit={() => handleEditMeta(selectedScript)}
						onDelete={() => handleDeleteScript(selectedScript.id)}
						onRun={handleRun}
						onDebugRun={handleDebugRun}
						onCancel={() => {
							const runId =
								activeScriptId === selectedScript.id ? activeRunId : null;
							if (runId) actions.cancelRun.mutate(runId);
						}}
					/>
				) : (
					<div className="flex-1 flex items-center justify-center text-muted-foreground">
						<div className="text-center">
							<p className="text-sm">选择左侧脚本查看详情</p>
							<p className="text-xs mt-1">或点击 + 新建脚本</p>
						</div>
					</div>
				)}
			</div>

			{/* 新建/编辑元数据对话框 */}
			<Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
				<DialogContent className="max-w-sm max-h-[85vh] flex flex-col gap-0">
					<DialogHeader className="shrink-0 pb-4">
						<DialogTitle>
							{metaDialogScript ? '编辑脚本信息' : '新建脚本'}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 overflow-y-auto flex-1 min-h-0 px-0.5">
						<div className="space-y-1.5">
							<Label>脚本名称</Label>
							<Input
								value={metaName}
								onChange={(e) => setMetaName(e.target.value)}
								placeholder="输入脚本名称"
								onKeyDown={(e) => e.key === 'Enter' && handleMetaSave()}
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label>描述（可选）</Label>
							<Textarea
								value={metaDesc}
								onChange={(e) => setMetaDesc(e.target.value)}
								placeholder="描述这个脚本的用途"
								rows={2}
								className="resize-none"
							/>
						</div>
						{metaDialogScript && allProfiles.length > 0 && (
							<div className="space-y-1.5">
								<Label className="text-sm">关联环境（可选）</Label>
								<p className="text-xs text-muted-foreground">
									先在这里绑定环境，运行时再勾选本次要执行的环境
								</p>
								<div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
									<div className="flex flex-wrap gap-2">
										{metaAssociatedProfiles.length > 0 ? (
											metaAssociatedProfiles.map((profile) => (
												<Badge
													key={profile.id}
													variant="secondary"
													className="flex items-center gap-1 pr-1"
												>
													<span className="max-w-45 truncate">
														{profile.name}
													</span>
													<button
														type="button"
														onClick={() => unbindProfile(profile.id)}
														className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
														aria-label={`移除环境 ${profile.name}`}
													>
														<X className="h-3 w-3" />
													</button>
												</Badge>
											))
										) : (
											<p className="text-xs text-muted-foreground px-1 py-1">
												当前未绑定环境
											</p>
										)}
									</div>
									<Popover
										open={profilePickerOpen}
										onOpenChange={setProfilePickerOpen}
									>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="cursor-pointer"
												disabled={availableBindProfiles.length === 0}
											>
												<Plus className="h-3.5 w-3.5 mr-1" />
												添加环境
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-70 p-0" align="start">
											<Command>
												<CommandInput placeholder="搜索环境名称..." />
												<CommandList>
													<CommandEmpty>没有可绑定的环境</CommandEmpty>
													{availableBindProfiles.map((profile) => (
														<CommandItem
															key={profile.id}
															onSelect={() => bindProfile(profile.id)}
														>
															{profile.name}
														</CommandItem>
													))}
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						)}
						<div className="space-y-1.5">
							<Label className="text-sm">AI 配置（可选）</Label>
							<p className="text-xs text-muted-foreground">
								{aiConfigs.length > 0
									? '留空则使用全局 AI 配置'
									: '请先在设置中添加 AI 配置，或继续使用全局默认配置'}
							</p>
							<Select
								value={metaAiConfigId ?? '__none__'}
								onValueChange={(v) =>
									setMetaAiConfigId(v === '__none__' ? null : v)
								}
								disabled={aiConfigs.length === 0}
							>
								<SelectTrigger className="h-9 text-sm cursor-pointer disabled:cursor-not-allowed">
									<SelectValue
										placeholder={
											aiConfigs.length > 0 ? '使用全局配置' : '请先添加 AI 配置'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__" className="cursor-pointer">
										使用全局配置
									</SelectItem>
									{aiConfigs.map((c) => (
										<SelectItem
											key={c.id}
											value={c.id}
											className="cursor-pointer"
										>
											{c.name}
											{c.model ? ` (${c.model})` : ''}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter className="shrink-0 pt-4">
						<Button
							variant="ghost"
							onClick={() => setMetaDialogOpen(false)}
							className="cursor-pointer"
						>
							取消
						</Button>
						<Button
							onClick={handleMetaSave}
							disabled={!metaName.trim() || isSaving}
							className="cursor-pointer"
						>
							{metaDialogScript ? '保存' : '创建并打开流程编辑'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 隐藏的导入文件输入框 */}
			<input
				ref={importInputRef}
				type="file"
				accept=".json"
				className="hidden"
				onChange={handleImportFile}
			/>
		</div>
	);
}

export { Badge };
