import { listen } from '@tauri-apps/api/event';

import { tauriInvoke } from '@/shared/api/tauri-invoke';

import type {
	AiProviderConfig,
	AutomationHumanDismissedEvent,
	AutomationHumanRequiredEvent,
	AutomationProgressEvent,
	AutomationRun,
	AutomationRunCancelledEvent,
	AutomationScript,
	AutomationVariablesUpdatedEvent,
	CreateAutomationScriptPayload,
} from '@/entities/automation/model/types';

export async function listAutomationScripts(): Promise<AutomationScript[]> {
	return tauriInvoke<AutomationScript[]>('list_automation_scripts');
}

export async function createAutomationScript(
	payload: CreateAutomationScriptPayload,
): Promise<AutomationScript> {
	return tauriInvoke<AutomationScript>('create_automation_script', { payload });
}

export async function updateAutomationScript(
	scriptId: string,
	payload: CreateAutomationScriptPayload,
): Promise<AutomationScript> {
	return tauriInvoke<AutomationScript>('update_automation_script', { scriptId, payload });
}

export async function deleteAutomationScript(scriptId: string): Promise<void> {
	return tauriInvoke<void>('delete_automation_script', { scriptId });
}

export async function listAutomationRuns(scriptId: string): Promise<AutomationRun[]> {
	return tauriInvoke<AutomationRun[]>('list_automation_runs', { scriptId });
}

export async function runAutomationScript(
	scriptId: string,
	profileId: string,
	initialVars?: Record<string, string>,
): Promise<string> {
	return tauriInvoke<string>('run_automation_script', { scriptId, profileId, initialVars: initialVars ?? null });
}

export async function listenAutomationProgress(
	runId: string,
	onProgress: (event: AutomationProgressEvent) => void,
): Promise<() => void> {
	const unlisten = await listen<AutomationProgressEvent>('automation_progress', (event) => {
		if (event.payload.runId === runId) {
			onProgress(event.payload);
		}
	});
	return unlisten;
}

export async function listenAutomationVariablesUpdated(
	runId: string,
	onUpdate: (event: AutomationVariablesUpdatedEvent) => void,
): Promise<() => void> {
	const unlisten = await listen<AutomationVariablesUpdatedEvent>(
		'automation_variables_updated',
		(event) => {
			if (event.payload.runId === runId) {
				onUpdate(event.payload);
			}
		},
	);
	return unlisten;
}

export async function listenAutomationHumanRequired(
	onEvent: (event: AutomationHumanRequiredEvent) => void,
): Promise<() => void> {
	return listen<AutomationHumanRequiredEvent>('automation_human_required', (event) => {
		onEvent(event.payload);
	});
}

export async function listenAutomationHumanDismissed(
	onEvent: (event: AutomationHumanDismissedEvent) => void,
): Promise<() => void> {
	return listen<AutomationHumanDismissedEvent>('automation_human_dismissed', (event) => {
		onEvent(event.payload);
	});
}

export async function listenAutomationRunCancelled(
	onEvent: (event: AutomationRunCancelledEvent) => void,
): Promise<() => void> {
	return listen<AutomationRunCancelledEvent>('automation_run_cancelled', (event) => {
		onEvent(event.payload);
	});
}

export async function resumeAutomationRun(runId: string, input?: string): Promise<void> {
	return tauriInvoke<void>('resume_automation_run', { runId, input });
}

export async function cancelAutomationRun(runId: string): Promise<void> {
	return tauriInvoke<void>('cancel_automation_run', { runId });
}

export async function listActiveAutomationRuns(): Promise<string[]> {
	return tauriInvoke<string[]>('list_active_automation_runs');
}

export async function runAutomationScriptDebug(
	scriptId: string,
	profileId: string,
	initialVars?: Record<string, string>,
): Promise<string> {
	return tauriInvoke<string>('run_automation_script_debug', { scriptId, profileId, initialVars: initialVars ?? null });
}

export async function openAutomationCanvasWindow(
	scriptId: string,
	scriptName: string,
): Promise<void> {
	return tauriInvoke<void>('open_automation_canvas_window', { scriptId, scriptName });
}

export async function updateScriptCanvasPositions(
	scriptId: string,
	positionsJson: string,
): Promise<void> {
	return tauriInvoke<void>('update_script_canvas_positions', { scriptId, positionsJson });
}

export async function updateScriptVariablesSchema(
	scriptId: string,
	schemaJson: string,
): Promise<void> {
	return tauriInvoke<void>('update_script_variables_schema', { scriptId, schemaJson });
}

export async function readAiProviderConfig(): Promise<AiProviderConfig> {
	return tauriInvoke<AiProviderConfig>('read_ai_provider_config');
}

export async function updateAiProviderConfig(config: AiProviderConfig): Promise<void> {
	return tauriInvoke<void>('update_ai_provider_config', { config });
}
