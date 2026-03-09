import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { tauriInvoke } from '@/shared/api/tauri-invoke';

export const BACKEND_LOG_EVENT = 'backend_log_event';

export type BackendLogEvent = {
	ts: number;
	level: string;
	component: string;
	message: string;
	profileId: string | null;
	line: string;
};

type ExportBackendLogsResponse = {
	path: string;
	lineCount: number;
};

export async function readBackendLogs(limit = 400): Promise<BackendLogEvent[]> {
	return tauriInvoke<BackendLogEvent[]>('read_backend_logs', { limit });
}

export async function listenBackendLogs(
	onMessage: (payload: BackendLogEvent) => void,
): Promise<UnlistenFn> {
	return listen<BackendLogEvent>(BACKEND_LOG_EVENT, (event) => onMessage(event.payload));
}

export async function openLogPanelWindow(): Promise<void> {
	await tauriInvoke('open_log_panel_window');
}

export async function exportBackendLogs(
	lines: string[],
	fileName?: string,
): Promise<ExportBackendLogsResponse> {
	return tauriInvoke<ExportBackendLogsResponse>('export_backend_logs', {
		payload: {
			lines,
			fileName: fileName ?? null,
		},
	});
}
