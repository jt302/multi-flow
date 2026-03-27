import { listen } from '@tauri-apps/api/event';

import { tauriInvoke } from '@/shared/api/tauri-invoke';

import type {
	AutomationProgressEvent,
	AutomationRun,
	AutomationScript,
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
): Promise<string> {
	return tauriInvoke<string>('run_automation_script', { scriptId, profileId });
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
