import { useState } from 'react';

import { Plus } from 'lucide-react';

import { useAutomationRunsQuery } from '@/entities/automation/model/use-automation-runs-query';
import { useAutomationScriptsQuery } from '@/entities/automation/model/use-automation-scripts-query';
import type { AutomationScript, ScriptStep } from '@/entities/automation/model/types';
import { useAutomationActions } from '@/features/automation/model/use-automation-actions';
import { useAutomationStore } from '@/store/automation-store';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ScriptDetailPanel } from './script-detail-panel';
import { ScriptEditorDialog } from './script-editor-dialog';

export function AutomationPage() {
	const scriptsQuery = useAutomationScriptsQuery();
	const scripts = scriptsQuery.data ?? [];
	const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingScript, setEditingScript] = useState<AutomationScript | null>(null);

	const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? null;
	const runsQuery = useAutomationRunsQuery(selectedScriptId);
	const runs = runsQuery.data ?? [];

	const profilesQuery = useProfilesQuery();
	const activeProfiles = (profilesQuery.data ?? []).filter((p) => p.lifecycle === 'active');

	const liveRunStatus = useAutomationStore((s) => s.liveRunStatus);
	const liveStepResults = useAutomationStore((s) => s.liveStepResults);
	const liveVariables = useAutomationStore((s) => s.liveVariables);
	const activeRunId = useAutomationStore((s) => s.activeRunId);
	const activeScriptId = useAutomationStore((s) => s.activeScriptId);

	const actions = useAutomationActions(selectedScriptId);

	function handleNewScript() {
		setEditingScript(null);
		setEditorOpen(true);
	}

	function handleEditScript(script: AutomationScript) {
		setEditingScript(script);
		setEditorOpen(true);
	}

	async function handleSaveScript(name: string, description: string, steps: ScriptStep[]) {
		if (editingScript) {
			await actions.updateScript.mutateAsync({
				scriptId: editingScript.id,
				payload: { name, description: description || undefined, steps },
			});
		} else {
			const created = await actions.createScript.mutateAsync({
				name,
				description: description || undefined,
				steps,
			});
			setSelectedScriptId(created.id);
		}
		setEditorOpen(false);
	}

	async function handleDeleteScript(scriptId: string) {
		await actions.deleteScript.mutateAsync(scriptId);
		if (selectedScriptId === scriptId) {
			setSelectedScriptId(null);
		}
	}

	async function handleRunScript(profileId: string) {
		if (!selectedScript) return;
		await actions.runScript.mutateAsync({
			scriptId: selectedScript.id,
			profileId,
			stepTotal: selectedScript.steps.length,
		});
	}

	return (
		<div className="flex h-full">
			{/* 左侧脚本列表 */}
			<div className="w-64 flex-shrink-0 border-r flex flex-col">
				<div className="flex items-center justify-between px-4 py-3 border-b">
					<span className="text-sm font-medium">自动化脚本</span>
					<Button size="sm" variant="ghost" className="h-7 w-7 p-0 cursor-pointer" onClick={handleNewScript}>
						<Plus className="h-4 w-4" />
					</Button>
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
						isRunning={activeScriptId === selectedScript.id && liveRunStatus === 'running'}
						liveStepResults={activeScriptId === selectedScript.id ? liveStepResults : []}
						liveVariables={activeScriptId === selectedScript.id ? liveVariables : {}}
						activeRunId={activeScriptId === selectedScript.id ? activeRunId : null}
						onEdit={() => handleEditScript(selectedScript)}
						onDelete={() => handleDeleteScript(selectedScript.id)}
						onRun={handleRunScript}
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

			<ScriptEditorDialog
				open={editorOpen}
				script={editingScript}
				onOpenChange={setEditorOpen}
				onSave={handleSaveScript}
				isSaving={actions.createScript.isPending || actions.updateScript.isPending}
			/>
		</div>
	);
}

export { Badge };
