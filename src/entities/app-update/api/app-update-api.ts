import { listen } from '@tauri-apps/api/event';

import { tauriInvoke } from '@/shared/api/tauri-invoke';

export const APP_UPDATE_PROGRESS_EVENT = 'app_update://progress';

export type AppUpdateInfo = {
	version: string;
	currentVersion: string;
	date: string | null;
	body: string | null;
};

export type AppUpdateProgressEvent = {
	phase: string;
	downloaded: number;
	total: number | null;
};

export function checkAppUpdate(): Promise<AppUpdateInfo | null> {
	return tauriInvoke<AppUpdateInfo | null>('check_app_update');
}

export function installAppUpdate(): Promise<void> {
	return tauriInvoke<void>('install_app_update');
}

export function listenAppUpdateProgress(
	onProgress: (progress: AppUpdateProgressEvent) => void,
) {
	return listen<AppUpdateProgressEvent>(APP_UPDATE_PROGRESS_EVENT, (event) => {
		onProgress(event.payload);
	});
}
