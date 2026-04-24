import { listen } from '@tauri-apps/api/event';
import type {
	InstallPluginToProfilesPayload,
	PluginDownloadPreference,
	PluginPackage,
} from '@/entities/plugin/model/types';
import type {
	BatchProfileActionResponse,
	ProfileItem,
	ProfilePluginSelection,
} from '@/entities/profile/model/types';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

export type PluginDownloadProgressEvent = {
	taskId: string;
	extensionId: string;
	packageId?: string | null;
	stage: 'start' | 'download' | 'process' | 'done' | 'error' | string;
	downloadedBytes: number;
	totalBytes: number | null;
	percent: number | null;
	message: string;
	updatedAt?: number;
};

export type PluginDownloadProgressSnapshot = PluginDownloadProgressEvent & {
	updatedAt: number;
};

export function createPluginTaskId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listenAllPluginProgress(
	onProgress: (progress: PluginDownloadProgressEvent) => void,
) {
	return listen<PluginDownloadProgressEvent>('plugin_download_progress', (event) => {
		onProgress(event.payload);
	});
}

export async function getActivePluginDownloads(): Promise<PluginDownloadProgressSnapshot[]> {
	return tauriInvoke<PluginDownloadProgressSnapshot[]>('get_active_plugin_downloads');
}

export async function listPluginPackages(): Promise<PluginPackage[]> {
	return tauriInvoke<PluginPackage[]>('list_plugin_packages');
}

export async function readPluginDownloadPreference(): Promise<PluginDownloadPreference> {
	return tauriInvoke<PluginDownloadPreference>('read_plugin_download_preference');
}

export async function updatePluginDownloadPreference(
	proxyId?: string | null,
): Promise<PluginDownloadPreference> {
	return tauriInvoke<PluginDownloadPreference>('update_plugin_download_preference', {
		proxyId: proxyId?.trim() || null,
	});
}

export async function downloadPluginByExtensionId(
	extensionId: string,
	proxyId?: string | null,
): Promise<PluginPackage> {
	const taskId = createPluginTaskId(`plugin-download-${extensionId.trim()}`);
	return tauriInvoke<PluginPackage>('download_plugin_by_extension_id', {
		payload: { extensionId: extensionId.trim(), proxyId: proxyId?.trim() || null },
		taskId,
	});
}

export async function checkPluginUpdate(
	packageId: string,
	proxyId?: string | null,
): Promise<PluginPackage> {
	return tauriInvoke<PluginPackage>('check_plugin_update', {
		packageId,
		proxyId: proxyId?.trim() || null,
	});
}

export async function updatePluginPackage(
	packageId: string,
	proxyId?: string | null,
): Promise<PluginPackage> {
	const taskId = createPluginTaskId(`plugin-update-${packageId}`);
	return tauriInvoke<PluginPackage>('update_plugin_package', {
		packageId,
		proxyId: proxyId?.trim() || null,
		taskId,
	});
}

export async function uninstallPluginPackage(packageId: string): Promise<PluginPackage> {
	return tauriInvoke<PluginPackage>('uninstall_plugin_package', { packageId });
}

export async function installPluginToProfiles(
	payload: InstallPluginToProfilesPayload,
): Promise<BatchProfileActionResponse> {
	return tauriInvoke<BatchProfileActionResponse>('install_plugin_to_profiles', {
		payload,
	});
}

export async function readProfilePlugins(profileId: string): Promise<ProfilePluginSelection[]> {
	return tauriInvoke<ProfilePluginSelection[]>('read_profile_plugins', { profileId });
}

export async function updateProfilePlugins(
	profileId: string,
	selections: ProfilePluginSelection[],
): Promise<ProfileItem> {
	return tauriInvoke<ProfileItem>('update_profile_plugins', {
		profileId,
		payload: { selections },
	});
}
