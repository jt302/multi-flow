import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation(['window', 'common']);
	const openTab = async (profileId: string, url?: string) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await openProfileTabApi(profileId, url);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.tabOpened'));
			} catch (error) {
				toast.error(t('window:actions.tabOpenFailed'));
				throw error;
			}
		});
	};

	const closeTab = async (profileId: string, tabId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeProfileTabApi(profileId, tabId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.tabClosed'));
			} catch (error) {
				toast.error(t('window:actions.tabCloseFailed'));
				throw error;
			}
		});
	};

	const closeInactiveTabs = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeInactiveTabsApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.inactiveTabsClosed'));
			} catch (error) {
				toast.error(t('window:actions.inactiveTabsCloseFailed'));
				throw error;
			}
		});
	};

	const activateTab = async (profileId: string, tabId: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await activateTabApi(profileId, tabId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.tabActivated'));
			} catch (error) {
				toast.error(t('window:actions.tabActivateFailed'));
				throw error;
			}
		});
	};

	const activateTabByIndex = async (profileId: string, index: number, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await activateTabByIndexApi(profileId, index, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.tabIndexSwitched'));
			} catch (error) {
				toast.error(t('window:actions.tabIndexSwitchFailed'));
				throw error;
			}
		});
	};

	const openWindow = async (profileId: string, url?: string) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await openProfileWindowApi(profileId, url);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.windowOpened'));
			} catch (error) {
				toast.error(t('window:actions.windowOpenFailed'));
				throw error;
			}
		});
	};

	const closeWindow = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await closeProfileWindowApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.windowClosed'));
			} catch (error) {
				toast.error(t('window:actions.windowCloseFailed'));
				throw error;
			}
		});
	};

	const focusWindow = async (profileId: string, windowId?: number) => {
		await withWindowActionLock(profileId, async () => {
			try {
				await focusProfileWindowApi(profileId, windowId);
				await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
				toast.success(t('window:actions.windowFocused'));
			} catch (error) {
				toast.error(t('window:actions.windowFocusFailed'));
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
				toast.success(t('window:actions.boundsUpdated'));
			} catch (error) {
				toast.error(t('window:actions.boundsUpdateFailed'));
				throw error;
			}
		});
	};

	const batchOpenTabs = async (profileIds: string[], url?: string) => {
		try {
			const result = await batchOpenProfileTabsApi(profileIds, url);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(t('common:batchResult', { action: t('window:actions.batchOpenTabs'), success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('common:batchResult', { action: t('window:actions.batchOpenTabs'), success: result.successCount, fail: 0 }));
			}
		} catch (error) {
			toast.error(t('window:actions.batchOpenTabsFailed'));
			throw error;
		}
	};

	const batchCloseTabs = async (profileIds: string[]) => {
		try {
			const result = await batchCloseProfileTabsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(t('common:batchResult', { action: t('window:actions.batchCloseTabs'), success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('common:batchResult', { action: t('window:actions.batchCloseTabs'), success: result.successCount, fail: 0 }));
			}
		} catch (error) {
			toast.error(t('window:actions.batchCloseTabsFailed'));
			throw error;
		}
	};

	const batchCloseInactiveTabs = async (profileIds: string[]) => {
		try {
			const result = await batchCloseInactiveTabsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(t('common:batchResult', { action: t('window:actions.batchCloseInactiveTabs'), success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('common:batchResult', { action: t('window:actions.batchCloseInactiveTabs'), success: result.successCount, fail: 0 }));
			}
		} catch (error) {
			toast.error(t('window:actions.batchCloseInactiveTabsFailed'));
			throw error;
		}
	};

	const batchOpenWindows = async (profileIds: string[], url?: string) => {
		try {
			const result = await batchOpenProfileWindowsApi(profileIds, url);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(t('common:batchResult', { action: t('window:actions.batchOpenWindows'), success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('common:batchResult', { action: t('window:actions.batchOpenWindows'), success: result.successCount, fail: 0 }));
			}
		} catch (error) {
			toast.error(t('window:actions.batchOpenWindowsFailed'));
			throw error;
		}
	};

	const batchFocusWindows = async (profileIds: string[]) => {
		try {
			const result = await batchFocusProfileWindowsApi(profileIds);
			await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
			if (result.failedCount > 0) {
				toast.warning(t('common:batchResult', { action: t('window:actions.batchFocusWindows'), success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('common:batchResult', { action: t('window:actions.batchFocusWindows'), success: result.successCount, fail: 0 }));
			}
		} catch (error) {
			toast.error(t('window:actions.batchFocusWindowsFailed'));
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
