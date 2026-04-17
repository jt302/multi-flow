import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AutomationCanvasPage } from '@/features/automation-canvas/ui/automation-canvas-page';
import { useAutomationStore, useRunsByScript } from '@/store/automation-store';
import { useAutomationScriptsQuery } from '@/entities/automation/model/use-automation-scripts-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useAutomationActions } from '@/features/automation/model/use-automation-actions';

export function AutomationCanvasRoutePage() {
	const { t } = useTranslation('common');
	const { scriptId } = useParams<{ scriptId: string }>();
	const { data: scripts = [], isLoading } = useAutomationScriptsQuery();
	const { data: profiles = [] } = useProfilesQuery();
	const allProfiles = profiles.filter((p) => p.lifecycle === 'active');
	const activeProfiles = allProfiles.filter((p) => p.running);

	const activeRunId = useAutomationStore((s) => s.activeRunId);
	const activeScriptId = useAutomationStore((s) => s.activeScriptId);
	const liveRunStatus = useAutomationStore((s) => s.liveRunStatus);
	const liveStepResults = useAutomationStore((s) => s.liveStepResults);

	const { runScript, debugRun, cancelRun } = useAutomationActions(
		scriptId ?? null,
	);

	const script = scripts.find((s) => s.id === scriptId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
				{t('loading')}
			</div>
		);
	}

	if (!script) {
		return (
			<div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
				{t('scriptNotFound')}
			</div>
		);
	}

	const belongsToThisScript = activeScriptId === scriptId;
	const isRunning =
		belongsToThisScript &&
		(liveRunStatus === 'running' || liveRunStatus === 'waiting_human');

	// 计算各 step 的并发 profile 数（多个 profile 同时跑同一 script 时）
	const scriptRuns = useRunsByScript(scriptId ?? null);
	const concurrentCounts: Record<number, number> = {};
	for (const run of scriptRuns) {
		if (run.liveRunStatus !== 'running' && run.liveRunStatus !== 'waiting_human') continue;
		for (const result of run.liveStepResults) {
			if (result.status === 'running') {
				concurrentCounts[result.index] = (concurrentCounts[result.index] ?? 0) + 1;
			}
		}
	}

	return (
		<AutomationCanvasPage
			script={script}
			activeProfiles={activeProfiles}
			allProfiles={allProfiles}
			isRunning={isRunning}
			activeRunId={belongsToThisScript ? activeRunId : null}
			liveStepResults={belongsToThisScript ? liveStepResults : []}
			concurrentCounts={Object.keys(concurrentCounts).length > 0 ? concurrentCounts : undefined}
			onRun={(profileIds, initialVars, delayConfig) => {
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
				const batchId = profileIds.length > 1 ? crypto.randomUUID() : null;
				return void Promise.all(
					profileIds.map((profileId) =>
						runScript.mutateAsync({
							scriptId: script.id,
							profileId,
							stepTotal: script.steps.length,
							initialVars:
								Object.keys(initialVars).length > 0 ? initialVars : undefined,
							delayConfig: normalizedDelay,
							batchId,
						}),
					),
				);
			}}
			onDebugRun={(profileId, initialVars) =>
				void debugRun.mutateAsync({
					scriptId: script.id,
					profileId,
					stepTotal: script.steps.length,
					initialVars:
						Object.keys(initialVars).length > 0 ? initialVars : undefined,
				})
			}
			onCancel={() => {
				if (activeRunId) cancelRun.mutate(activeRunId);
			}}
		/>
	);
}
