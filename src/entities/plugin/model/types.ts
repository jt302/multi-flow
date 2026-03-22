import type { ProfilePluginSelection } from '@/entities/profile/model/types';

export type PluginUpdateStatus =
	| 'unknown'
	| 'up_to_date'
	| 'update_available'
	| 'error';

export type PluginPackage = {
	packageId: string;
	extensionId: string;
	name: string;
	version: string;
	description?: string;
	iconPath?: string;
	crxPath: string;
	sourceType: string;
	storeUrl?: string;
	updateUrl?: string;
	latestVersion?: string;
	updateStatus?: PluginUpdateStatus;
	createdAt: number;
	updatedAt: number;
};

export type InstallPluginToProfilesPayload = {
	packageId: string;
	profileIds: string[];
};

export type PluginDownloadPreference = {
	proxyId?: string | null;
};

export type UpdateProfilePluginsPayload = {
	selections: ProfilePluginSelection[];
};
