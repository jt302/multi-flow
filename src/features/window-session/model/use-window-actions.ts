import { toast } from 'sonner';

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
} from '@/entities/window-session/api/windows-api';
import type { WindowBoundsItem } from '@/entities/window-session/model/types';

type WindowActionsDeps = {
	withWindowActionLock: (profileId: string, action: () => Promise<void>) => Promise<void>;
	refreshWindowsStable: () => Promise<void>;
	refreshProfilesAndBindings: () => Promise<void>;
};

export function useWindowActions({
	withWindowActionLock,
	refreshWindowsStable,
	refreshProfilesAndBindings,
}: WindowActionsDeps) {
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

	const setWindowBounds = async (
		profileId: string,
		bounds: WindowBoundsItem,
		windowId?: number,
	) => {
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

	return {
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
