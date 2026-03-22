import type { BatchProfileActionResponse, ProfileItem, ProfilePluginSelection } from '@/entities/profile/model/types';
import type {
	InstallPluginToProfilesPayload,
	PluginPackage,
} from '@/entities/plugin/model/types';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

export async function listPluginPackages(): Promise<PluginPackage[]> {
	return tauriInvoke<PluginPackage[]>('list_plugin_packages');
}

export async function downloadPluginByExtensionId(
	extensionId: string,
	proxyId?: string | null,
): Promise<PluginPackage> {
	return tauriInvoke<PluginPackage>('download_plugin_by_extension_id', {
		payload: { extensionId: extensionId.trim(), proxyId: proxyId?.trim() || null },
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
	return tauriInvoke<PluginPackage>('update_plugin_package', {
		packageId,
		proxyId: proxyId?.trim() || null,
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
