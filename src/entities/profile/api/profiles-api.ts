import type {
	BatchProfileActionResponse,
	ClearProfileCacheResponse,
	CreateProfilePayload,
	FontListMode,
	ProfileDevicePresetItem,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfileItem,
	ProfileLifecycle,
	ProfileRuntimeDetails,
	ProfileSettings,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';
import { tauriInvoke } from '@/shared/api/tauri-invoke';

import {
	createResourceTaskId,
	listenResourceProgress,
	listenResourceProgressByTaskPrefix,
	type ResourceDownloadProgressEvent,
} from '@/entities/resource/api/resource-api';

type BackendProfile = {
	id: string;
	name: string;
	group: string | null;
	note: string | null;
	settings: ProfileSettings | null;
	lifecycle: ProfileLifecycle;
	running: boolean;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
	lastOpenedAt: number | null;
};

type ListProfilesResponse = {
	items: BackendProfile[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

function mapBackendProfile(item: BackendProfile): ProfileItem {
	return {
		id: item.id,
		name: item.name,
		group: item.group?.trim() || '未分组',
		note: item.note?.trim() || '未填写备注',
		settings: item.settings ?? undefined,
		lifecycle: item.lifecycle,
		running: item.running,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
		deletedAt: item.deletedAt,
		lastOpenedAt: item.lastOpenedAt,
	};
}

export async function listProfiles(): Promise<ProfileItem[]> {
	const result = await tauriInvoke<ListProfilesResponse>('list_profiles', {
		includeDeleted: true,
		page: 1,
		pageSize: 200,
	});
	return result.items.map(mapBackendProfile);
}

export async function createProfile(payload: CreateProfilePayload): Promise<void> {
	await tauriInvoke('create_profile', {
		payload: {
			name: payload.name,
			group: payload.group?.trim() ? payload.group : null,
			note: payload.note?.trim() ? payload.note : null,
			proxyId: payload.proxyId?.trim() ? payload.proxyId : null,
			settings: payload.settings ?? null,
		},
	});
}

export async function updateProfile(profileId: string, payload: CreateProfilePayload): Promise<void> {
	await tauriInvoke('update_profile', {
		profileId,
		payload: {
			name: payload.name,
			group: payload.group?.trim() ? payload.group : null,
			note: payload.note?.trim() ? payload.note : null,
			proxyId: payload.proxyId?.trim() ? payload.proxyId : null,
			settings: payload.settings ?? null,
		},
	});
}

export async function updateProfileVisual(
	profileId: string,
	payload: { browserBgColor?: string; toolbarText?: string },
): Promise<void> {
	await tauriInvoke('update_profile_visual', {
		profileId,
		payload: {
			browserBgColor: payload.browserBgColor?.trim() ? payload.browserBgColor : null,
			toolbarText: payload.toolbarText?.trim() ? payload.toolbarText : null,
		},
	});
}

export async function listProfileFontFamilies(platform?: string): Promise<string[]> {
	return tauriInvoke<string[]>('list_profile_font_families', {
		platform: platform?.trim() ? platform : null,
	});
}

export async function listProfileDevicePresets(
	platform?: string,
): Promise<ProfileDevicePresetItem[]> {
	return tauriInvoke<ProfileDevicePresetItem[]>('list_profile_device_presets', {
		platform: platform?.trim() ? platform : null,
	});
}

export async function createProfileDevicePreset(
	payload: SaveProfileDevicePresetPayload,
): Promise<ProfileDevicePresetItem> {
	return tauriInvoke<ProfileDevicePresetItem>('create_profile_device_preset', {
		payload,
	});
}

export async function updateProfileDevicePreset(
	presetId: string,
	payload: SaveProfileDevicePresetPayload,
): Promise<ProfileDevicePresetItem> {
	return tauriInvoke<ProfileDevicePresetItem>('update_profile_device_preset', {
		presetId,
		payload,
	});
}

export async function listFingerprintPresets(
	platform?: string,
	browserVersion?: string,
): Promise<ProfileDevicePresetItem[]> {
	return tauriInvoke<ProfileDevicePresetItem[]>('list_fingerprint_presets', {
		platform: platform?.trim() ? platform : null,
		browserVersion: browserVersion?.trim() ? browserVersion : null,
	});
}

export async function previewFingerprintBundle(
	source: ProfileFingerprintSource,
	fontConfig?: {
		fontListMode?: FontListMode;
		customFontList?: string[];
		fingerprintSeed?: number | null;
	},
): Promise<ProfileFingerprintSnapshot> {
	return tauriInvoke<ProfileFingerprintSnapshot>('preview_fingerprint_bundle', {
		source,
		fontListMode: fontConfig?.fontListMode ?? null,
		customFontList: fontConfig?.customFontList ?? null,
		fingerprintSeed: fontConfig?.fingerprintSeed ?? null,
	});
}

export async function getProfileRuntimeDetails(
	profileId: string,
): Promise<ProfileRuntimeDetails> {
	return tauriInvoke<ProfileRuntimeDetails>('get_profile_runtime_details', { profileId });
}

export async function clearProfileCache(
	profileId: string,
): Promise<ClearProfileCacheResponse> {
	return tauriInvoke<ClearProfileCacheResponse>('clear_profile_cache', { profileId });
}

export async function openProfile(
	profileId: string,
	onProgress?: (progress: ResourceDownloadProgressEvent) => void,
): Promise<void> {
	const taskId = createResourceTaskId(`open-${profileId}`);
	const unlisten = onProgress
		? await listenResourceProgress(taskId, null, onProgress)
		: null;
	try {
		await tauriInvoke('open_profile', { profileId, options: null, taskId });
	} finally {
		unlisten?.();
	}
}

export async function batchOpenProfiles(
	profileIds: string[],
	onProgress?: (progress: ResourceDownloadProgressEvent) => void,
): Promise<BatchProfileActionResponse> {
	const taskIdPrefix = createResourceTaskId('batch-open');
	const unlisten = onProgress
		? await listenResourceProgressByTaskPrefix(taskIdPrefix, onProgress)
		: null;
	try {
		return await tauriInvoke<BatchProfileActionResponse>('batch_open_profiles', {
			payload: { profileIds },
			taskIdPrefix,
		});
	} finally {
		unlisten?.();
	}
}

export async function batchCloseProfiles(
	profileIds: string[],
): Promise<BatchProfileActionResponse> {
	return tauriInvoke<BatchProfileActionResponse>('batch_close_profiles', {
		payload: { profileIds },
	});
}

export async function closeProfile(profileId: string): Promise<void> {
	await tauriInvoke('close_profile', { profileId });
}

export async function deleteProfile(profileId: string): Promise<void> {
	await tauriInvoke('delete_profile', { profileId });
}

export async function restoreProfile(profileId: string): Promise<void> {
	await tauriInvoke('restore_profile', { profileId });
}

export async function purgeProfile(profileId: string): Promise<void> {
	await tauriInvoke('purge_profile', { profileId });
}

export async function setProfileGroup(profileId: string, groupName?: string): Promise<void> {
	await tauriInvoke('set_profile_group', {
		profileId,
		payload: {
			groupName: groupName?.trim() ? groupName : null,
		},
	});
}

export async function batchSetProfileGroup(
	profileIds: string[],
	groupName?: string,
): Promise<BatchProfileActionResponse> {
	return tauriInvoke<BatchProfileActionResponse>('batch_set_profile_group', {
		payload: {
			profileIds,
			groupName: groupName?.trim() ? groupName : null,
		},
	});
}
