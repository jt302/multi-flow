import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import {
	createGroup as createGroupApi,
	deleteGroup as deleteGroupApi,
	restoreGroup as restoreGroupApi,
} from '../api/groups-api';
import {
	closeProfile as closeProfileApi,
	createProfile as createProfileApi,
	deleteProfile as deleteProfileApi,
	batchCloseProfiles as batchCloseProfilesApi,
	batchOpenProfiles as batchOpenProfilesApi,
	createProfileDevicePreset as createProfileDevicePresetApi,
	openProfile as openProfileApi,
	restoreProfile as restoreProfileApi,
	updateProfile as updateProfileApi,
	updateProfileDevicePreset as updateProfileDevicePresetApi,
	updateProfileVisual as updateProfileVisualApi,
} from '@/entities/profile/api/profiles-api';
import { useProfileDevicePresetsQuery } from '@/entities/profile/model/use-profile-device-presets-query';
import { useProfileProxyBindingsQuery } from '@/entities/profile/model/use-profile-proxy-bindings-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import {
	bindProfileProxy as bindProfileProxyApi,
	createProxy as createProxyApi,
	deleteProxy as deleteProxyApi,
	restoreProxy as restoreProxyApi,
	unbindProfileProxy as unbindProfileProxyApi,
} from '../api/proxy-api';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import {
	activateChromiumVersion as activateChromiumVersionApi,
	installChromiumResourceWithProgress,
} from '../api/resource-api';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import {
	activateTab as activateTabApi,
	activateTabByIndex as activateTabByIndexApi,
	batchCloseInactiveTabs as batchCloseInactiveTabsApi,
	batchCloseProfileTabs as batchCloseProfileTabsApi,
	batchFocusProfileWindows as batchFocusProfileWindowsApi,
	batchOpenProfileTabs as batchOpenProfileTabsApi,
	batchOpenProfileWindows as batchOpenProfileWindowsApi,
	closeInactiveTabs as closeInactiveTabsApi,
	closeProfileTab as closeProfileTabApi,
	closeProfileWindow as closeProfileWindowApi,
	focusProfileWindow as focusProfileWindowApi,
	openProfileTab as openProfileTabApi,
	openProfileWindow as openProfileWindowApi,
	setProfileWindowBounds as setProfileWindowBoundsApi,
} from '../api/windows-api';
import { useWindowStatesQuery } from '@/entities/window-session/model/use-window-states-query';
import type {
	CreateProxyPayload,
	ResourceProgressState,
	WindowBoundsItem,
} from '../types';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	ProfileItem,
	SaveProfileDevicePresetPayload,
} from '@/entities/profile/model/types';

type UseConsoleStateOptions = {
	onRequireSettings?: () => void;
};

export function useConsoleState(_options: UseConsoleStateOptions = {}) {
	const queryClient = useQueryClient();
	const [isRunning, setIsRunning] = useState(true);
	const [profileActionStates, setProfileActionStates] = useState<Record<string, ProfileActionState>>({});
	const [resourceProgress, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const profileActionLocksRef = useRef<Set<string>>(new Set());
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const prevProfilesRef = useRef<ProfileItem[]>([]);
	const profileActionStatesRef = useRef<Record<string, ProfileActionState>>({});

	const groupsQuery = useGroupsQuery();
	const profilesQuery = useProfilesQuery();
	const proxiesQuery = useProxiesQuery();
	const resourcesQuery = useResourcesQuery();
	const devicePresetsQuery = useProfileDevicePresetsQuery();
	const windowStatesQuery = useWindowStatesQuery();
	const activeProfileIds = useMemo(
		() =>
			(profilesQuery.data ?? [])
				.filter((item) => item.lifecycle === 'active')
				.map((item) => item.id),
		[profilesQuery.data],
	);
	const bindingsQuery = useProfileProxyBindingsQuery(activeProfileIds);

	const groups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[groupsQuery.data],
	);
	const deletedGroups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'deleted'),
		[groupsQuery.data],
	);
	const profiles = profilesQuery.data ?? [];
	const proxies = proxiesQuery.data ?? [];
	const resources = resourcesQuery.data ?? [];
	const devicePresets = devicePresetsQuery.data ?? [];
	const windowStates = windowStatesQuery.data ?? [];
	const profileProxyBindings = bindingsQuery.data ?? {};

	useEffect(() => {
		profileActionStatesRef.current = profileActionStates;
	}, [profileActionStates]);

	const setActionState = (profileId: string, state: ProfileActionState | null) => {
		setProfileActionStates((prev) => {
			if (state === null) {
				if (!(profileId in prev)) {
					return prev;
				}
				const next = { ...prev };
				delete next[profileId];
				return next;
			}
			return { ...prev, [profileId]: state };
		});
	};

	const withProfileActionLock = async (profileId: string, action: () => Promise<void>) => {
		if (profileActionLocksRef.current.has(profileId)) {
			return;
		}
		profileActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			profileActionLocksRef.current.delete(profileId);
		}
	};

	const withWindowActionLock = async (profileId: string, action: () => Promise<void>) => {
		if (windowActionLocksRef.current.has(profileId)) {
			return;
		}
		windowActionLocksRef.current.add(profileId);
		try {
			await action();
		} finally {
			windowActionLocksRef.current.delete(profileId);
		}
	};

	const refreshGroups = async () => {
		await groupsQuery.refetch();
	};

	const refreshProfiles = async () => {
		const result = await profilesQuery.refetch();
		const items = result.data ?? [];
		const prevMap = new Map(prevProfilesRef.current.map((item) => [item.id, item]));
		for (const item of items) {
			const prev = prevMap.get(item.id);
			const actionState = profileActionStatesRef.current[item.id];
			if (
				prev?.running &&
				!item.running &&
				!actionState &&
				!profileActionLocksRef.current.has(item.id) &&
				item.lifecycle === 'active'
			) {
				setActionState(item.id, 'recovering');
				toast.info(`环境 ${item.name} 已退出，状态已自动回收`);
				window.setTimeout(() => setActionState(item.id, null), 1800);
			}
		}
		prevProfilesRef.current = items;
		return items;
	};

	const refreshProxies = async () => {
		await proxiesQuery.refetch();
	};

	const refreshResources = async () => {
		await resourcesQuery.refetch();
	};

	const refreshDevicePresets = async () => {
		await devicePresetsQuery.refetch();
	};

	const refreshWindows = async () => {
		await windowStatesQuery.refetch();
	};

	const refreshWindowsStable = async () => {
		await refreshWindows();
		await new Promise((resolve) => window.setTimeout(resolve, 220));
		await refreshWindows();
	};

	const refreshBindingsByProfiles = async (sourceProfiles: ProfileItem[]) => {
		const profileIds = sourceProfiles
			.filter((item) => item.lifecycle === 'active')
			.map((item) => item.id);
		if (profileIds.length === 0) {
			return {};
		}
		await queryClient.invalidateQueries({ queryKey: ['profile-proxy-bindings'] });
		const result = await bindingsQuery.refetch();
		return result.data ?? {};
	};

	const refreshProfilesAndBindings = async () => {
		const items = await refreshProfiles();
		await refreshBindingsByProfiles(items);
	};

	useEffect(() => {
		const prevMap = new Map(prevProfilesRef.current.map((item) => [item.id, item]));
		for (const item of profiles) {
			const prev = prevMap.get(item.id);
			const actionState = profileActionStatesRef.current[item.id];
			if (
				prev?.running &&
				!item.running &&
				!actionState &&
				!profileActionLocksRef.current.has(item.id) &&
				item.lifecycle === 'active'
			) {
				setActionState(item.id, 'recovering');
				toast.info(`环境 ${item.name} 已退出，状态已自动回收`);
				window.setTimeout(() => setActionState(item.id, null), 1800);
			}
		}
		prevProfilesRef.current = profiles;
	}, [profiles]);

	const createGroup = async (name: string, note: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}
		try {
			await createGroupApi(trimmedName, note);
			await refreshGroups();
			toast.success('分组已创建');
		} catch {
			toast.error('创建分组失败');
			// backend unavailable: keep current UI state unchanged
		}
	};

	const deleteGroup = async (id: string) => {
		try {
			await deleteGroupApi(id);
			await refreshGroups();
			toast.success('分组已删除');
		} catch {
			toast.error('删除分组失败');
		}
	};

	const restoreGroup = async (id: string) => {
		try {
			await restoreGroupApi(id);
			await refreshGroups();
			toast.success('分组已恢复');
		} catch (error) {
			toast.error('恢复分组失败');
			throw error;
		}
	};

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
			await Promise.all([refreshDevicePresets(), refreshProfiles()]);
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

	const createProxy = async (payload: CreateProxyPayload) => {
		try {
			await createProxyApi(payload);
			await refreshProxies();
			toast.success('代理已创建');
		} catch (error) {
			toast.error('创建代理失败');
			throw error;
		}
	};

	const deleteProxy = async (proxyId: string) => {
		try {
			await deleteProxyApi(proxyId);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success('代理已删除');
		} catch (error) {
			toast.error('删除代理失败');
			throw error;
		}
	};

	const restoreProxy = async (proxyId: string) => {
		try {
			await restoreProxyApi(proxyId);
			await refreshProxies();
			toast.success('代理已恢复');
		} catch (error) {
			toast.error('恢复代理失败');
			throw error;
		}
	};

	const bindProfileProxy = async (profileId: string, proxyId: string) => {
		try {
			await bindProfileProxyApi(profileId, proxyId);
			await refreshProfilesAndBindings();
			toast.success('绑定已更新');
		} catch (error) {
			toast.error('绑定代理失败');
			throw error;
		}
	};

	const installChromium = async (resourceId: string) => {
		const toastId = toast.loading('开始下载浏览器资源...');
		let lastShownPercent = -1;
		setResourceProgress({
			resourceId,
			stage: 'start',
			percent: 0,
			downloadedBytes: 0,
			totalBytes: null,
			message: '开始下载资源',
		});
		try {
			await installChromiumResourceWithProgress(resourceId, (progress) => {
				setResourceProgress({
					resourceId,
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
						toast.loading(`浏览器下载中 ${percent}%`, { id: toastId });
					} else {
						toast.loading('浏览器下载中...', { id: toastId });
					}
					return;
				}
				if (progress.stage === 'install') {
					toast.loading('浏览器安装中...', { id: toastId });
					return;
				}
				if (progress.stage === 'error') {
					toast.error(progress.message || '浏览器安装失败', { id: toastId });
				}
			});
			await refreshResources();
			setResourceProgress((prev) => (prev ? { ...prev, stage: 'done', percent: 100 } : prev));
			toast.success('浏览器已安装并激活', { id: toastId });
		} catch (error) {
			setResourceProgress((prev) =>
				prev
					? { ...prev, stage: 'error', message: error instanceof Error ? error.message : '安装失败' }
					: prev,
			);
			toast.error('安装浏览器失败', { id: toastId });
			throw error;
		}
	};

	const activateChromium = async (version: string) => {
		try {
			await activateChromiumVersionApi(version);
			await refreshResources();
			toast.success(`已切换 Chromium ${version}`);
		} catch (error) {
			toast.error('切换浏览器版本失败');
			throw error;
		}
	};

	const unbindProfileProxy = async (profileId: string) => {
		try {
			await unbindProfileProxyApi(profileId);
			await refreshProfilesAndBindings();
			toast.success('已解除绑定');
		} catch (error) {
			toast.error('解绑代理失败');
			throw error;
		}
	};

	const openTab = async (profileId: string, url?: string) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await openProfileTabApi(profileId, url);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('已新增标签页');
			} catch (error) {
				toast.error('新增标签页失败');
				throw error;
			}
		});
	};

	const closeTab = async (profileId: string, tabId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeProfileTabApi(profileId, tabId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('标签页已关闭');
			} catch (error) {
				toast.error('关闭标签页失败');
				throw error;
			}
		});
	};

	const closeInactiveTabs = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeInactiveTabsApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('后台标签已关闭');
			} catch (error) {
				toast.error('关闭后台标签失败');
				throw error;
			}
		});
	};

	const activateTab = async (profileId: string, tabId: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await activateTabApi(profileId, tabId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('标签页已激活');
			} catch (error) {
				toast.error('激活标签页失败');
				throw error;
			}
		});
	};

	const activateTabByIndex = async (profileId: string, index: number, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await activateTabByIndexApi(profileId, index, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('标签页索引切换成功');
			} catch (error) {
				toast.error('按索引激活标签页失败');
				throw error;
			}
		});
	};

	const openWindow = async (profileId: string, url?: string) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await openProfileWindowApi(profileId, url);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('已新增窗口');
			} catch (error) {
				toast.error('新增窗口失败');
				throw error;
			}
		});
	};

	const closeWindow = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeProfileWindowApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('窗口已关闭');
			} catch (error) {
				toast.error('关闭窗口失败');
				throw error;
			}
		});
	};

	const focusWindow = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await focusProfileWindowApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('窗口已聚焦');
			} catch (error) {
				toast.error('聚焦窗口失败');
				throw error;
			}
		});
	};

	const setWindowBounds = async (profileId: string, bounds: WindowBoundsItem, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await setProfileWindowBoundsApi(profileId, bounds, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success('窗口尺寸已更新');
			} catch (error) {
				toast.error('设置窗口尺寸失败');
				throw error;
			}
		});
	};

	const batchOpenTabs = async (profileIds: string[], url?: string) => {
		try {
			const result = await batchOpenProfileTabsApi(profileIds, url);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(`批量新标签完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量新标签完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('批量新增标签页失败');
			throw error;
		}
	};

	const batchCloseTabs = async (profileIds: string[]) => {
		try {
			const result = await batchCloseProfileTabsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(`批量关标签完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量关标签完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('批量关闭标签页失败');
			throw error;
		}
	};

	const batchCloseInactiveTabs = async (profileIds: string[]) => {
		try {
			const result = await batchCloseInactiveTabsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(`批量关后台标签完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量关后台标签完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('批量关闭后台标签失败');
			throw error;
		}
	};

	const batchOpenWindows = async (profileIds: string[], url?: string) => {
		try {
			const result = await batchOpenProfileWindowsApi(profileIds, url);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(`批量新窗口完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量新窗口完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('批量新增窗口失败');
			throw error;
		}
	};

	const batchFocusWindows = async (profileIds: string[]) => {
		try {
			const result = await batchFocusProfileWindowsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(`批量聚焦完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`批量聚焦完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('批量聚焦窗口失败');
			throw error;
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

	return {
		isRunning,
		setIsRunning,
		groups,
		deletedGroups,
		profiles,
		profileActionStates,
		proxies,
		profileProxyBindings,
		resources,
		resourceProgress,
		devicePresets,
		windowStates,
		createGroup,
		deleteGroup,
		restoreGroup,
		createProfile,
		updateProfile,
		updateProfileVisual,
		openProfile,
		closeProfile,
		deleteProfile,
		restoreProfile,
		batchOpenProfiles,
		batchCloseProfiles,
		createDevicePreset,
		updateDevicePreset,
		createProxy,
		deleteProxy,
		restoreProxy,
		bindProfileProxy,
		unbindProfileProxy,
		refreshProfiles: refreshProfilesAndBindings,
		refreshGroups,
		refreshProxies,
		refreshResources,
		refreshDevicePresets,
		refreshWindows,
		installChromium,
		activateChromium,
		openTab,
		closeTab,
		closeInactiveTabs,
		activateTab,
		activateTabByIndex,
		openWindow,
		closeWindow,
		focusWindow,
		setWindowBounds,
		batchOpenTabs,
		batchCloseTabs,
		batchCloseInactiveTabs,
		batchOpenWindows,
		batchFocusWindows,
	};
}
