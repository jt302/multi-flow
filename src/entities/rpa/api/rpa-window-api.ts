import { tauriInvoke } from '@/shared/api/tauri-invoke';

export async function openRpaFlowEditorWindow(flowId?: string | null): Promise<void> {
	await tauriInvoke('open_rpa_flow_editor_window', {
		flowId: flowId?.trim() ? flowId.trim() : null,
	});
}

export async function closeRpaFlowEditorWindow(): Promise<void> {
	await tauriInvoke('close_rpa_flow_editor_window');
}
