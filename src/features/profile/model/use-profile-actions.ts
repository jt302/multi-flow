import { toast } from 'sonner';

import {
	batchCloseProfiles as batchCloseProfilesApi,
	batchOpenProfiles as batchOpenProfilesApi,
	closeProfile as closeProfileApi,
	createProfile as createProfileApi,
	createProfileDevicePreset as createProfileDevicePresetApi,
	deleteProfile as deleteProfileApi,
	openProfile as openProfileApi,
	restoreProfile as restoreProfileApi,
	setProfileGroup as setProfileGroupApi,
	batchSetProfileGroup as batchSetProfileGroupApi,
	updateProfile as updateProfileApi,
	updateProfileDevicePreset as updateProfileDevicePresetApi,
	updateProfileVisual as updateProfileVisualApi,
} from '@/entities/profile/api/profiles-api';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	SaveProfileDevicePresetPayload,
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
			throw new Error('环境名称不能为空');
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
			toast.success('环境已创建');
		} catch (error) {
			toast.error('创建环境失败');
			throw error;
		}
	};

	const createDevicePreset = async (payload: SaveProfileDevicePresetPayload) => {
		try {
			await createProfileDevicePresetApi(payload);
			await refreshDevicePresets();
			toast.success('机型映射已添加');
		} catch (error) {
			toast.error('添加机型映射失败');
			throw error;
		}
	};

	const updateDevicePreset = async (
		presetId: string,
		payload: SaveProfileDevicePresetPayload,
	) => {
		try {
			await updateProfileDevicePresetApi(presetId, payload);
			await Promise.all([refreshDevicePresets(), refreshProfilesAndBindings()]);
			toast.success('机型映射已更新');
		} catch (error) {
			toast.error('更新机型映射失败');
			throw error;
		}
	};

	const updateProfile = async (profileId: string, payload: CreateProfilePayload) => {
		const name = payload.name.trim();
		if (!name) {
			throw new Error('环境名称不能为空');
		}
		try {
			await updateProfileApi(profileId, {
				...payload,
				name,
			});
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success('环境配置已更新');
		} catch (error) {
			toast.error('更新环境配置失败');
			throw error;
		}
	};

	const updateProfileVisual = async (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => {
		try {
			await updateProfileVisualApi(profileId, payload);
			toast.success('环境外观已更新');
			const refreshResults = await Promise.allSettled([
				refreshProfilesAndBindings(),
				refreshWindows(),
			]);
			if (refreshResults.some((item) => item.status === 'rejected')) {
				toast.warning('外观已保存，状态刷新延迟');
			}
		} catch (error) {
			toast.error('更新环境外观失败');
			throw error;
		}
	};

	const openProfile = async (profileId: string) => {
		await withProfileActionLock(profileId, async () => {
			setActionState(profileId, 'opening');
			const toastId = toast.loading('环境启动中...');
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
							toast.loading(`浏览器版本下载中 ${percent}%`, { id: toastId });
						} else {
							toast.loading('浏览器版本下载中...', { id: toastId });
						}
						return;
					}
					if (progress.stage === 'install') {
						toast.loading('浏览器版本安装中...', { id: toastId });
						return;
					}
					if (progress.stage === 'done') {
						toast.loading('浏览器版本已就绪，继续启动环境...', { id: toastId });
					}
				});
				await Promise.all([refreshProfilesAndBindings(), refreshWindows(), refreshResources()]);
				toast.success('环境已启动', { id: toastId });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes('no chromium build')) {
					toast.error('当前系统没有这个浏览器版本', {
						id: toastId,
						description: '请切换到宿主系统可用的 Chromium 版本后再启动',
					});
				} else if (message.includes('current system has no chromium builds')) {
					toast.error('当前系统没有可用的 Chromium 构建', {
						id: toastId,
						description: '请先检查资源清单和当前宿主系统平台',
					});
				} else {
					toast.error('启动环境失败', { id: toastId });
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
				toast.success('环境已关闭');
			} catch (error) {
				toast.error('关闭环境失败');
				throw error;
			} finally {
				setActionState(profileId, null);
			}
		});
	};

	const deleteProfile = async (profileId: string) => {
		setActionState(profileId, 'deleting');
		try {
			await deleteProfileApi(profileId);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups(), refreshWindows()]);
			toast.success('环境已归档');
		} catch (error) {
			toast.error('删除环境失败');
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
			toast.success('环境已恢复');
		} catch (error) {
			toast.error('恢复环境失败');
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
		const toastId = toast.loading('批量启动环境中...');
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
						toast.loading(`批量启动准备浏览器资源 ${percent}%`, { id: toastId });
					} else {
						toast.loading('批量启动准备浏览器资源...', { id: toastId });
					}
					return;
				}
				if (progress.stage === 'install') {
					toast.loading('批量启动安装浏览器资源...', { id: toastId });
					return;
				}
				if (progress.stage === 'done') {
					toast.loading('浏览器资源已就绪，继续批量启动...', { id: toastId });
				}
			});
			await Promise.all([
				refreshProfilesAndBindings(),
				refreshWindows(),
				refreshResources(),
			]);
			if (result.failedCount > 0) {
				toast.warning(`批量启动完成：成功 ${result.successCount}，失败 ${result.failedCount}`, {
					id: toastId,
				});
			} else {
				toast.success(`批量启动完成：${result.successCount}/${result.total}`, {
					id: toastId,
				});
			}
			return result;
		} catch (error) {
			toast.error('批量启动环境失败', { id: toastId });
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
				toast.warning(`批量关闭完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量关闭完成：${result.successCount}/${result.total}`);
			}
			return result;
		} catch (error) {
			toast.error('批量关闭环境失败');
			throw error;
		}
	};

	const setProfileGroup = async (profileId: string, groupName?: string) => {
		try {
			await setProfileGroupApi(profileId, groupName);
			await Promise.all([refreshProfilesAndBindings(), refreshGroups()]);
			toast.success(groupName ? '分组已更新' : '分组已清空');
		} catch (error) {
			toast.error(groupName ? '更新分组失败' : '清空分组失败');
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
				toast.warning(groupName ? '部分环境分组设置失败' : '部分环境清空分组失败');
			} else {
				toast.success(groupName ? '批量分组设置完成' : '批量清空分组完成');
			}
			return result;
		} catch (error) {
			toast.error(groupName ? '批量分组设置失败' : '批量清空分组失败');
			throw error;
		}
	};

	return {
		createProfile,
		createDevicePreset,
		updateDevicePreset,
		updateProfile,
		updateProfileVisual,
		openProfile,
		closeProfile,
		deleteProfile,
		restoreProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		setProfileGroup,
		batchSetProfileGroup,
	};
}
