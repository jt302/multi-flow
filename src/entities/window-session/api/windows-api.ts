import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type { ProfileWindowStateItem, WindowBoundsItem } from '@/entities/window-session/model/types';

type BatchActionResponse = {
	total: number;
	successCount: number;
	failedCount: number;
	items: Array<{
		profileId: string;
		ok: boolean;
		message: string;
	}>;
};

export async function listOpenProfileWindows(): Promise<ProfileWindowStateItem[]> {
	return tauriInvoke<ProfileWindowStateItem[]>('list_open_profile_windows');
}

export async function openProfileTab(profileId: string, url?: string): Promise<void> {
	await tauriInvoke('open_profile_tab', {
		profileId,
		url: url?.trim() ? url : null,
	});
}

export async function closeProfileTab(profileId: string, tabId?: number): Promise<void> {
	await tauriInvoke('close_profile_tab', {
		profileId,
		tabId: typeof tabId === 'number' ? tabId : null,
	});
}

export async function closeInactiveTabs(profileId: string, windowId?: number): Promise<void> {
	await tauriInvoke('close_inactive_tabs', {
		profileId,
		windowId: typeof windowId === 'number' ? windowId : null,
	});
}

export async function openProfileWindow(profileId: string, url?: string): Promise<void> {
	await tauriInvoke('open_profile_window', {
		profileId,
		url: url?.trim() ? url : null,
	});
}

export async function closeProfileWindow(profileId: string, windowId?: number): Promise<void> {
	await tauriInvoke('close_profile_window', {
		profileId,
		windowId: typeof windowId === 'number' ? windowId : null,
	});
}

export async function focusProfileWindow(profileId: string, windowId?: number): Promise<void> {
	await tauriInvoke('focus_profile_window', {
		profileId,
		windowId: typeof windowId === 'number' ? windowId : null,
	});
}

export async function setProfileWindowBounds(
	profileId: string,
	bounds: WindowBoundsItem,
	windowId?: number,
): Promise<void> {
	await tauriInvoke('set_profile_window_bounds', {
		profileId,
		windowId: typeof windowId === 'number' ? windowId : null,
		bounds,
	});
}

export async function activateTab(profileId: string, tabId: number): Promise<void> {
	await tauriInvoke('activate_tab', { profileId, tabId });
}

export async function activateTabByIndex(profileId: string, index: number, windowId?: number): Promise<void> {
	await tauriInvoke('activate_tab_by_index', {
		profileId,
		index,
		windowId: typeof windowId === 'number' ? windowId : null,
	});
}

export async function batchOpenProfileTabs(profileIds: string[], url?: string): Promise<BatchActionResponse> {
	return tauriInvoke<BatchActionResponse>('batch_open_profile_tabs', {
		payload: {
			profileIds,
			url: url?.trim() ? url : null,
		},
	});
}

export async function batchCloseProfileTabs(profileIds: string[]): Promise<BatchActionResponse> {
	return tauriInvoke<BatchActionResponse>('batch_close_profile_tabs', {
		payload: { profileIds },
	});
}

export async function batchCloseInactiveTabs(profileIds: string[]): Promise<BatchActionResponse> {
	return tauriInvoke<BatchActionResponse>('batch_close_inactive_tabs', {
		payload: { profileIds },
	});
}

export async function batchOpenProfileWindows(
	profileIds: string[],
	url?: string,
): Promise<BatchActionResponse> {
	return tauriInvoke<BatchActionResponse>('batch_open_profile_windows', {
		payload: {
			profileIds,
			url: url?.trim() ? url : null,
		},
	});
}

export async function batchFocusProfileWindows(profileIds: string[]): Promise<BatchActionResponse> {
	return tauriInvoke<BatchActionResponse>('batch_focus_profile_windows', {
		payload: { profileIds },
	});
}
