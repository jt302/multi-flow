import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AutomationCanvasPage } from '@/features/automation-canvas/ui/automation-canvas-page';
import { useAutomationStore } from '@/store/automation-store';
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

	return (
		<AutomationCanvasPage
			script={script}
			activeProfiles={activeProfiles}
			allProfiles={allProfiles}
			isRunning={isRunning}
			activeRunId={belongsToThisScript ? activeRunId : null}
			liveStepResults={belongsToThisScript ? liveStepResults : []}
			onRun={(profileIds, initialVars) =>
				void Promise.all(
					profileIds.map((profileId) =>
						runScript.mutateAsync({
							scriptId: script.id,
							profileId,
							stepTotal: script.steps.length,
							initialVars:
								Object.keys(initialVars).length > 0 ? initialVars : undefined,
						}),
					),
				)
			}
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
