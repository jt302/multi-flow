import { useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';

import {
	listAiConfigs,
	listenAutomationScriptUpdated,
	openAutomationCanvasWindow,
	updateAutomationScript,
} from '@/entities/automation/api/automation-api';
import { useAutomationRunsQuery } from '@/entities/automation/model/use-automation-runs-query';
import { useAutomationScriptsQuery } from '@/entities/automation/model/use-automation-scripts-query';
import type {
	AutomationScript,
	RunDelayConfig,
} from '@/entities/automation/model/types';
import { queryKeys } from '@/shared/config/query-keys';
import { useAutomationActions } from '@/features/automation/model/use-automation-actions';
import { useAutomationStore } from '@/store/automation-store';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useDefaultLayout } from 'react-resizable-panels';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScriptDetailPanel } from './script-detail-panel';
import { ScriptListSidebar } from './script-list-sidebar';
import { ScriptMetaDialog } from './script-meta-dialog';

export function AutomationPage() {
	const { t } = useTranslation('automation');
	const scriptsQuery = useAutomationScriptsQuery();
	const scripts = scriptsQuery.data ?? [];
	const queryClient = useQueryClient();
	const { defaultLayout: autoLayout, onLayoutChanged: onAutoLayoutChanged } = useDefaultLayout({ id: 'automation-layout' });
	const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

	const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? null;
	const runsQuery = useAutomationRunsQuery(selectedScriptId);
	const runs = runsQuery.data ?? [];

	const profilesQuery = useProfilesQuery();
	const allProfiles = (profilesQuery.data ?? []).filter(
		(p) => p.lifecycle === 'active',
	);
	const activeProfiles = allProfiles.filter((p) => p.running);

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

	// 元数据对话框状态
	const [metaDialogOpen, setMetaDialogOpen] = useState(false);
	const [metaDialogScript, setMetaDialogScript] =
		useState<AutomationScript | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// 监听画布保存事件 + 窗口获焦刷新
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

	// ── 新建脚本 ───────────────────────────────────────────────────────────────
	function handleNewScript() {
		setMetaDialogScript(null);
		setMetaDialogOpen(true);
	}

	// ── 编辑脚本元数据 ──────────────────────────────────────────────────────────
	function handleEditMeta(script: AutomationScript) {
		setMetaDialogScript(script);
		setMetaDialogOpen(true);
	}

	// ── 保存元数据（新建 or 编辑） ──────────────────────────────────────────────
	async function handleMetaSave(data: {
		name: string;
		description: string;
		associatedProfileIds: string[];
		aiConfigId: string | null;
	}) {
		setIsSaving(true);
		try {
			if (metaDialogScript) {
				await actions.updateScript.mutateAsync({
					scriptId: metaDialogScript.id,
					payload: {
						name: data.name,
						description: data.description || undefined,
						steps: metaDialogScript.steps,
						associatedProfileIds: data.associatedProfileIds,
						aiConfigId: data.aiConfigId,
					},
				});
				setMetaDialogOpen(false);
			} else {
				const created = await actions.createScript.mutateAsync({
					name: data.name,
					description: data.description || undefined,
					steps: [],
					associatedProfileIds: data.associatedProfileIds,
					aiConfigId: data.aiConfigId,
				});
				setSelectedScriptId(created.id);
				setMetaDialogOpen(false);
				await openAutomationCanvasWindow(created.id, created.name);
			}
		} finally {
			setIsSaving(false);
		}
	}

	// ── 删除脚本 ───────────────────────────────────────────────────────────────
	async function handleDeleteScript(scriptId: string) {
		await actions.deleteScript.mutateAsync(scriptId);
		if (selectedScriptId === scriptId) {
			setSelectedScriptId(null);
		}
	}

	// ── 运行 ───────────────────────────────────────────────────────────────────
	async function handleRun(
		profileIds: string[],
		initialVars: Record<string, string>,
		delayConfig?: RunDelayConfig | null,
	) {
		if (!selectedScript) return;
		if (selectedScript.steps.length === 0) {
			toast.error(t('page.noValidSteps'));
			return;
		}
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

		// 持久化延迟配置到脚本设置
		if (delayConfig) {
			try {
				await updateAutomationScript(selectedScript.id, {
					name: selectedScript.name,
					steps: selectedScript.steps,
					settings: {
						...selectedScript.settings,
						delayConfig,
					},
				});
				void queryClient.invalidateQueries({
					queryKey: queryKeys.automationScripts,
				});
			} catch {
				// 设置持久化失败不阻塞执行
			}
		}

		try {
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
		} catch {
			// onError 已处理 toast
		}
	}

	async function handleDebugRun(
		profileId: string,
		initialVars: Record<string, string>,
	) {
		if (!selectedScript) return;
		try {
			await actions.debugRun.mutateAsync({
				scriptId: selectedScript.id,
				profileId,
				stepTotal: selectedScript.steps.length,
				initialVars:
					Object.keys(initialVars).length > 0 ? initialVars : undefined,
			});
		} catch {
			// onError 已处理 toast
		}
	}

	// ── 导入脚本 ───────────────────────────────────────────────────────────────
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
				toast.error(t('page.invalidFile'));
				return;
			}
			const created = await actions.createScript.mutateAsync({
				name: json.name,
				description: json.description ?? undefined,
				steps: json.steps as never,
			});
			setSelectedScriptId(created.id);
			toast.success(
				t('page.imported', { name: created.name, count: created.steps.length }),
			);
		} catch {
			toast.error(t('page.parseFailed'));
		}
	}

	return (
		<>
		<ResizablePanelGroup direction="horizontal" className="h-full" defaultLayout={autoLayout} onLayoutChanged={onAutoLayoutChanged}>
			{/* 左侧脚本列表侧边栏 */}
			<ResizablePanel defaultSize={20} minSize={14} maxSize={40}>
			<ScriptListSidebar
				scripts={scripts}
				selectedScriptId={selectedScriptId}
				onSelect={setSelectedScriptId}
				onNew={handleNewScript}
				onImport={handleImportClick}
			/>
			</ResizablePanel>
			<ResizableHandle />

			{/* 右侧：详情面板 or 仪表盘 */}
			<ResizablePanel defaultSize={80}>
			<div className="flex flex-col h-full overflow-hidden">
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
						onRunsChange={() => {
							if (selectedScriptId) {
								void queryClient.invalidateQueries({
									queryKey: queryKeys.automationRuns(selectedScriptId),
								});
							}
						}}
					/>
				) : (
					<div className="flex-1 flex items-center justify-center h-full">
						<div className="text-center space-y-2">
							<p className="text-sm text-muted-foreground">
								{t('page.selectScript')}
							</p>
							<p className="text-xs text-muted-foreground/60">
								{t('page.createHint')}
							</p>
						</div>
					</div>
				)}
			</div>
			</ResizablePanel>
		</ResizablePanelGroup>

		{/* 新建/编辑元数据对话框 */}
		<ScriptMetaDialog
			open={metaDialogOpen}
			onOpenChange={setMetaDialogOpen}
			script={metaDialogScript}
			allProfiles={allProfiles}
			aiConfigs={aiConfigs}
			existingNames={scripts.map((s) => s.name)}
			onSave={handleMetaSave}
			isSaving={isSaving}
		/>

		{/* 隐藏文件输入 */}
		<input
			ref={importInputRef}
			type="file"
			accept=".json"
			className="hidden"
			onChange={handleImportFile}
		/>
		</>
	);
}

export { Badge } from '@/components/ui/badge';
