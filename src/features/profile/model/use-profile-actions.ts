import { toast } from 'sonner';
import i18n from '@/shared/i18n';

import {
	batchCloseProfiles as batchCloseProfilesApi,
	batchOpenProfiles as batchOpenProfilesApi,
	closeProfile as closeProfileApi,
	createProfile as createProfileApi,
	createProfileDevicePreset as createProfileDevicePresetApi,
	deleteProfileDevicePreset as deleteProfileDevicePresetApi,
	deleteProfile as deleteProfileApi,
	duplicateProfile as duplicateProfileApi,
	exportProfileCookies as exportProfileCookiesApi,
	openProfile as openProfileApi,
	purgeProfile as purgeProfileApi,
	readProfileCookies as readProfileCookiesApi,
	restoreProfile as restoreProfileApi,
	setProfileGroup as setProfileGroupApi,
	batchSetProfileGroup as batchSetProfileGroupApi,
	updateProfile as updateProfileApi,
	updateProfileDevicePreset as updateProfileDevicePresetApi,
	updateProfileVisual as updateProfileVisualApi,
} from '@/entities/profile/api/profiles-api';
import type {
	BatchProfileActionResponse,
	BrowserBgColorMode,
	CreateProfilePayload,
	ExportProfileCookiesPayload,
	ProfileActionState,
	SaveProfileDevicePresetPayload,
	ToolbarLabelMode,
} from '@/entities/profile/model/types';
import type { ResourceProgressState } from '@/entities/resource/model/types';

type ProfileActionsDeps = {
	setActionState: (profileId: string, state: ProfileActionState | null) => void;
	withProfileActionLock: (profileId: string, action: () => Promise<void>) => Promise<void>;
	setResourceProgress: (state: ResourceProgressState | null | ((prev: ResourceProgressState | null) => ResourceProgressState | null)) => void;
	refreshProfilesAndBindings: () => Promise<void>;
	refreshGroups: () => Promise<void>;
	refreshWindows: () => Promise<void>;
	refreshResources: () => Promise<void>;
	refreshDevicePresets: () => Promise<void>;
};

export function useProfileActions({
	setActionState,
	withProfileActionLock,
	setResourceProgress,
	refreshProfilesAndBindings,
	refreshGroups,
	refreshWindows,
	refreshResources,
	refreshDevicePresets,
}: ProfileActionsDeps) {
	

	const createProfile = async (payload: CreateProfilePayload) => {
		const name = payload.name.trim();
		if (!name) {
			throw new Error(i18n.t('profile:profileNameRequired'));
		}
		try {
			await createProfileApi({
				name,
				group: payload.group,
				note: payload.note,
				proxyId: payload.proxyId,
				settings: payload.settings,
			});
			await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			toast.success(i18n.t('profile:profileCreated'));
		} catch (error) {
			toast.error(i18n.t('profile:createProfileFailed'));
			throw error;
		}
	};

	const createDevicePreset = async (payload: SaveProfileDevicePresetPayload) => {
		try {
			await createProfileDevicePresetApi(payload);
			await refreshDevicePresets();
			toast.success(i18n.t('profile:devicePresetAdded'));
		} catch (error) {
			toast.error(i18n.t('profile:addDevicePresetFailed'));
			throw error;
		}
	};

	const updateDevicePreset = async (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
		options?: { syncToProfiles?: boolean },
	) => {
		try {
			const outcome = await updateProfileDevicePresetApi(presetId, payload, options);
			await Promise.all([refreshDevicePresets(), refreshProfilesAndBindings()]);
			if (outcome.syncedCount > 0) {
				toast.success(
					i18n.t('device:page.syncedToast', { count: outcome.syncedCount }),
				);
			} else {
				toast.success(i18n.t('profile:devicePresetUpdated'));
			}
		} catch (error) {
			toast.error(i18n.t('profile:updateDevicePresetFailed'));
			throw error;
		}
	};

	const deleteDevicePreset = async (presetId: string) => {
		try {
			await deleteProfileDevicePresetApi(presetId);
			await Promise.all([refreshDevicePresets(), refreshProfilesAndBindings()]);
			toast.success(i18n.t('profile:devicePresetDeleted'));
		} catch (error) {
			toast.error(i18n.t('profile:deleteDevicePresetFailed'));
			throw error;
		}
	};

	const updateProfile = async (profileId: string, payload: CreateProfilePayload) => {
		const name = payload.name.trim();
		if (!name) {
			throw new Error(i18n.t('profile:profileNameRequired'));
		}
		try {
			await updateProfileApi(profileId, {
				...payload,
				name,
			});
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success(i18n.t('profile:profileUpdated'));
		} catch (error) {
			toast.error(i18n.t('profile:updateProfileFailed'));
			throw error;
		}
	};

	const updateProfileVisual = async (
		profileId: string,
		payload: {
			browserBgColorMode?: BrowserBgColorMode;
			browserBgColor?: string | null;
			toolbarLabelMode?: ToolbarLabelMode;
		},
	) => {
		try {
			await updateProfileVisualApi(profileId, payload);
			toast.success(i18n.t('profile:profileVisualUpdated'));
			const refreshResults = await Promise.allSettled([
				refreshProfilesAndBindings(),
				refreshWindows(),
			]);
			if (refreshResults.some((item) => item.status === 'rejected')) {
				toast.warning(i18n.t('profile:visualSavedRefreshDelayed'));
			}
		} catch (error) {
			toast.error(i18n.t('profile:updateProfileVisualFailed'));
			throw error;
		}
	};

	const openProfile = async (profileId: string) => {
		await withProfileActionLock(profileId, async () => {
			setActionState(profileId, 'opening');
			const toastId = toast.loading(i18n.t('profile:startingEnv'));
			let lastShownPercent = -1;
			try {
				await openProfileApi(profileId, (progress) => {
					setResourceProgress({
						resourceId: progress.resourceId,
						stage: progress.stage,
						percent: progress.percent,
						downloadedBytes: progress.downloadedBytes,
						totalBytes: progress.totalBytes,
						message: progress.message,
					});
					if (progress.stage === 'download') {
						const percent = progress.percent === null ? null : Math.floor(progress.percent);
						if (percent !== null && percent <= lastShownPercent) {
							return;
						}
						if (percent !== null) {
							lastShownPercent = percent;
							toast.loading(i18n.t('profile:downloadingBrowserVersion', { percent }), { id: toastId });
						} else {
							toast.loading(i18n.t('profile:downloadingBrowserVersion'), { id: toastId });
						}
						return;
					}
					if (progress.stage === 'install') {
						toast.loading(i18n.t('profile:installingBrowserVersion'), { id: toastId });
						return;
					}
					if (progress.stage === 'done') {
						toast.loading(i18n.t('profile:browserVersionReady'), { id: toastId });
					}
				});
				await Promise.all([refreshProfilesAndBindings(), refreshWindows(), refreshResources()]);
				toast.success(i18n.t('profile:envStarted'), { id: toastId });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes('no chromium build')) {
					toast.error(i18n.t('profile:noBrowserForSystem'), {
						id: toastId,
						description: i18n.t('profile:noBrowserForSystemDesc'),
					});
				} else if (message.includes('current system has no chromium builds')) {
					toast.error(i18n.t('profile:noChromiumBuilds'), {
						id: toastId,
						description: i18n.t('profile:noChromiumBuildsDesc'),
					});
				} else {
					toast.error(i18n.t('profile:startEnvFailed'), { id: toastId });
				}
				throw error;
			} finally {
				setActionState(profileId, null);
			}
		});
	};

	const closeProfile = async (profileId: string) => {
		await withProfileActionLock(profileId, async () => {
			setActionState(profileId, 'closing');
			try {
				await closeProfileApi(profileId);
				await Promise.all([refreshProfilesAndBindings(), refreshWindows()]);
				toast.success(i18n.t('profile:envClosed'));
			} catch (error) {
				toast.error(i18n.t('profile:closeEnvFailed'));
				throw error;
			} finally {
				setActionState(profileId, null);
			}
		});
	};

	const duplicateProfile = async (profileId: string) => {
		try {
			await duplicateProfileApi(profileId);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			toast.success(i18n.t('profile:profileDuplicated'));
		} catch (error) {
			toast.error(i18n.t('profile:duplicateProfileFailed'));
			throw error;
		}
	};

	const deleteProfile = async (profileId: string) => {
		setActionState(profileId, 'deleting');
		try {
			await deleteProfileApi(profileId);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success(i18n.t('profile:envArchived'));
		} catch (error) {
			toast.error(i18n.t('profile:deleteEnvFailed'));
			throw error;
		} finally {
			setActionState(profileId, null);
		}
	};

	const restoreProfile = async (profileId: string) => {
		setActionState(profileId, 'restoring');
		try {
			await restoreProfileApi(profileId);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success(i18n.t('profile:envRestored'));
		} catch (error) {
			toast.error(i18n.t('profile:restoreEnvFailed'));
			throw error;
		} finally {
			setActionState(profileId, null);
		}
	};

	const purgeProfile = async (profileId: string) => {
		setActionState(profileId, 'deleting');
		try {
			await purgeProfileApi(profileId);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success(i18n.t('profile:envPermanentlyDeleted'));
		} catch (error) {
			toast.error(i18n.t('profile:purgeEnvFailed'));
			throw error;
		} finally {
			setActionState(profileId, null);
		}
	};

	const batchOpenProfiles = async (profileIds: string[]) => {
		if (profileIds.length === 0) {
			return {
				total: 0,
				successCount: 0,
				failedCount: 0,
				items: [],
			} satisfies BatchProfileActionResponse;
		}
		const toastId = toast.loading(i18n.t('profile:batchStartingEnv'));
		let lastShownPercent = -1;
		try {
			const result = await batchOpenProfilesApi(profileIds, (progress) => {
				setResourceProgress({
					resourceId: progress.resourceId,
					stage: progress.stage,
					percent: progress.percent,
					downloadedBytes: progress.downloadedBytes,
					totalBytes: progress.totalBytes,
					message: progress.message,
				});
				if (progress.stage === 'download') {
					const percent = progress.percent === null ? null : Math.floor(progress.percent);
					if (percent !== null && percent <= lastShownPercent) {
						return;
					}
					if (percent !== null) {
						lastShownPercent = percent;
						toast.loading(i18n.t('profile:batchPreparingBrowserResource', { percent }), { id: toastId });
					} else {
						toast.loading(i18n.t('profile:batchPreparingBrowserResource'), { id: toastId });
					}
					return;
				}
				if (progress.stage === 'install') {
					toast.loading(i18n.t('profile:batchInstallingBrowserResource'), { id: toastId });
					return;
				}
				if (progress.stage === 'done') {
					toast.loading(i18n.t('profile:browserResourceReady'), { id: toastId });
				}
			});
			await Promise.all([
				refreshProfilesAndBindings(),
				refreshWindows(),
				refreshResources(),
			]);
			if (result.failedCount > 0) {
				toast.warning(i18n.t('profile:batchStartCompleteWarning', { successCount: result.successCount, failedCount: result.failedCount }), {
					id: toastId,
				});
			} else {
				toast.success(i18n.t('profile:batchStartComplete', { successCount: result.successCount, total: result.total }), {
					id: toastId,
				});
			}
			return result;
		} catch (error) {
			toast.error(i18n.t('profile:batchStartEnvFailed'), { id: toastId });
			throw error;
		}
	};

	const batchCloseProfiles = async (profileIds: string[]) => {
		if (profileIds.length === 0) {
			return {
				total: 0,
				successCount: 0,
				failedCount: 0,
				items: [],
			} satisfies BatchProfileActionResponse;
		}
		try {
			const result = await batchCloseProfilesApi(profileIds);
			await Promise.all([refreshProfilesAndBindings(), refreshWindows()]);
			if (result.failedCount > 0) {
				toast.warning(i18n.t('profile:batchCloseCompleteWarning', { successCount: result.successCount, failedCount: result.failedCount }));
			} else {
				toast.success(i18n.t('profile:batchCloseComplete', { successCount: result.successCount, total: result.total }));
			}
			return result;
		} catch (error) {
			toast.error(i18n.t('profile:batchCloseEnvFailed'));
			throw error;
		}
	};

	const setProfileGroup = async (profileId: string, groupName?: string) => {
		try {
			await setProfileGroupApi(profileId, groupName);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			toast.success(groupName ? i18n.t('profile:groupUpdated') : i18n.t('profile:groupCleared'));
		} catch (error) {
			toast.error(groupName ? i18n.t('profile:updateGroupFailed') : i18n.t('profile:clearGroupFailed'));
			throw error;
		}
	};

	const batchSetProfileGroup = async (profileIds: string[], groupName?: string) => {
		if (profileIds.length === 0) {
			return {
				total: 0,
				successCount: 0,
				failedCount: 0,
				items: [],
			} satisfies BatchProfileActionResponse;
		}
		try {
			const result = await batchSetProfileGroupApi(profileIds, groupName);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			if (result.failedCount > 0) {
				toast.warning(groupName ? i18n.t('profile:batchSetGroupPartialFailed') : i18n.t('profile:batchClearGroupPartialFailed'));
			} else {
				toast.success(groupName ? i18n.t('profile:batchSetGroupComplete') : i18n.t('profile:batchClearGroupComplete'));
			}
			return result;
		} catch (error) {
			toast.error(groupName ? i18n.t('profile:batchSetGroupFailed') : i18n.t('profile:batchClearGroupFailed'));
			throw error;
		}
	};

	const readProfileCookies = async (profileId: string) => {
		return readProfileCookiesApi(profileId);
	};

	const exportProfileCookies = async (
		profileId: string,
		payload: ExportProfileCookiesPayload,
	) => {
		try {
			const result = await exportProfileCookiesApi(profileId, payload);
			toast.success(i18n.t('profile:cookieExported'), {
				description: result.path,
			});
			return result;
		} catch (error) {
			toast.error(i18n.t('profile:exportCookieFailed'));
			throw error;
		}
	};

	return {
		createProfile,
		createDevicePreset,
		updateDevicePreset,
		deleteDevicePreset,
		updateProfile,
		updateProfileVisual,
		duplicateProfile,
		openProfile,
		closeProfile,
		deleteProfile,
		restoreProfile,
		purgeProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		setProfileGroup,
		batchSetProfileGroup,
		readProfileCookies,
		exportProfileCookies,
	};
}
