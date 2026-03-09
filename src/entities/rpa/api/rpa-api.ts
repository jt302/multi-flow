import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	RpaFlowItem,
	RpaRunDetailsItem,
	RpaRunItem,
	RpaRunStepItem,
	RunRpaFlowPayload,
	SaveRpaFlowPayload,
} from '@/entities/rpa/model/types';

export async function listRpaFlows(includeDeleted = true): Promise<RpaFlowItem[]> {
	return tauriInvoke<RpaFlowItem[]>('list_rpa_flows', {
		includeDeleted,
	});
}

export async function getRpaFlow(flowId: string): Promise<RpaFlowItem | null> {
	return tauriInvoke<RpaFlowItem | null>('get_rpa_flow', { flowId });
}

export async function createRpaFlow(payload: SaveRpaFlowPayload): Promise<RpaFlowItem> {
	return tauriInvoke<RpaFlowItem>('create_rpa_flow', { payload });
}

export async function updateRpaFlow(flowId: string, payload: SaveRpaFlowPayload): Promise<RpaFlowItem> {
	return tauriInvoke<RpaFlowItem>('update_rpa_flow', { flowId, payload });
}

export async function deleteRpaFlow(flowId: string): Promise<RpaFlowItem> {
	return tauriInvoke<RpaFlowItem>('delete_rpa_flow', { flowId });
}

export async function restoreRpaFlow(flowId: string): Promise<RpaFlowItem> {
	return tauriInvoke<RpaFlowItem>('restore_rpa_flow', { flowId });
}

export async function purgeRpaFlow(flowId: string): Promise<void> {
	await tauriInvoke('purge_rpa_flow', { flowId });
}

export async function runRpaFlow(payload: RunRpaFlowPayload): Promise<RpaRunItem> {
	return tauriInvoke<RpaRunItem>('run_rpa_flow', {
		payload: {
			flowId: payload.flowId,
			targetProfileIds: payload.targetProfileIds,
			concurrencyLimit: payload.concurrencyLimit ?? null,
			runtimeInput: payload.runtimeInput ?? {},
		},
	});
}

export async function listRpaRuns(limit = 20): Promise<RpaRunItem[]> {
	return tauriInvoke<RpaRunItem[]>('list_rpa_runs', { limit });
}

export async function getRpaRunDetails(runId: string): Promise<RpaRunDetailsItem | null> {
	return tauriInvoke<RpaRunDetailsItem | null>('get_rpa_run_details', { runId });
}

export async function listRpaRunSteps(instanceId: string): Promise<RpaRunStepItem[]> {
	return tauriInvoke<RpaRunStepItem[]>('list_rpa_run_steps', { instanceId });
}

export async function cancelRpaRun(runId: string): Promise<RpaRunItem> {
	return tauriInvoke<RpaRunItem>('cancel_rpa_run', {
		payload: { runId },
	});
}

export async function cancelRpaRunInstance(instanceId: string): Promise<void> {
	await tauriInvoke('cancel_rpa_run_instance', { instanceId });
}

export async function resumeRpaInstance(instanceId: string): Promise<void> {
	await tauriInvoke('resume_rpa_instance', {
		payload: { instanceId },
	});
}
