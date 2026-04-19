import type {
	BatchProfileActionResponse,
	BrowserBgColorMode,
	ClearProfileCacheResponse,
	CreateProfilePayload,
	ExportProfileCookiesPayload,
	ExportProfileCookiesResponse,
	FontListMode,
	ProfileDevicePresetItem,
	ProfileFingerprintSnapshot,
	ProfileFingerprintSource,
	ProfileItem,
	ProfileLifecycle,
	ReadProfileCookiesResponse,
	ProfileRuntimeDetails,
	ProfileSettings,
	SaveProfileDevicePresetPayload,
	ToolbarLabelMode,
} from '@/entities/profile/model/types';
import { tauriInvoke } from '@/shared/api/tauri-invoke';
import i18next from 'i18next';

import {
	createResourceTaskId,
	listenResourceProgress,
	listenResourceProgressByTaskPrefix,
	type ResourceDownloadProgressEvent,
} from '@/entities/resource/api/resource-api';

type BackendProfile = {
	id: string;
	numericId: number;
	name: string;
	group: string | null;
	note: string | null;
	settings: ProfileSettings | null;
	resolvedToolbarText: string | null;
	resolvedBrowserBgColor: string | null;
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
		numericId: item.numericId,
		name: item.name,
		group: item.group?.trim() || i18next.t('profile:basic.ungrouped'),
		note: item.note?.trim() || i18next.t('profile:basic.noNote'),
		settings: item.settings ?? undefined,
		resolvedToolbarText: item.resolvedToolbarText ?? undefined,
		resolvedBrowserBgColor: item.resolvedBrowserBgColor,
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

export async function duplicateProfile(profileId: string): Promise<void> {
	await tauriInvoke('duplicate_profile', { profileId });
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
	payload: {
		browserBgColorMode?: BrowserBgColorMode;
		browserBgColor?: string | null;
		toolbarLabelMode?: ToolbarLabelMode;
	},
): Promise<void> {
	await tauriInvoke('update_profile_visual', {
		profileId,
		payload: {
			browserBgColorMode: payload.browserBgColorMode ?? null,
			browserBgColor: payload.browserBgColor?.trim() ? payload.browserBgColor : null,
			toolbarLabelMode: payload.toolbarLabelMode ?? null,
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

export type UpdateDevicePresetOutcome = {
	preset: ProfileDevicePresetItem;
	syncedCount: number;
};

export async function updateProfileDevicePreset(
	presetId: string,
	payload: SaveProfileDevicePresetPayload,
	options?: { syncToProfiles?: boolean },
): Promise<UpdateDevicePresetOutcome> {
	return tauriInvoke<UpdateDevicePresetOutcome>('update_profile_device_preset', {
		presetId,
		payload,
		syncToProfiles: options?.syncToProfiles ?? false,
	});
}

export async function countProfilesByDevicePreset(presetId: string): Promise<number> {
	return tauriInvoke<number>('count_profile_device_preset_references', { presetId });
}

export async function deleteProfileDevicePreset(presetId: string): Promise<void> {
	return tauriInvoke<void>('delete_profile_device_preset', { presetId });
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

export async function readProfileCookies(
	profileId: string,
): Promise<ReadProfileCookiesResponse> {
	return tauriInvoke<ReadProfileCookiesResponse>('read_profile_cookies', { profileId });
}

export async function exportProfileCookies(
	profileId: string,
	payload: ExportProfileCookiesPayload,
): Promise<ExportProfileCookiesResponse> {
	return tauriInvoke<ExportProfileCookiesResponse>('export_profile_cookies', {
		profileId,
		payload: {
			mode: payload.mode,
			url: payload.url?.trim() ? payload.url : null,
			exportPath: payload.exportPath?.trim() ? payload.exportPath : null,
		},
	});
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
