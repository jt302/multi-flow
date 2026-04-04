import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
	arrangeProfileWindows,
	batchRestoreProfileWindows,
	batchSetProfileWindowBounds,
	broadcastSyncText,
} from '@/entities/window-session/api/windows-api';
import type { ArrangeWindowsPayload, WindowBoundsItem } from '@/entities/window-session/model/types';
import { syncManagerStore } from '@/store/sync-manager-store';

type WindowSyncActionsDeps = {
	refreshWindowsStable: () => Promise<void>;
	refreshProfilesAndBindings: () => Promise<void>;
};

export function useWindowSyncActions({
	refreshWindowsStable,
	refreshProfilesAndBindings,
}: WindowSyncActionsDeps) {
	const { t } = useTranslation('window');

	const refreshAll = async () => {
		await Promise.all([refreshWindowsStable(), refreshProfilesAndBindings()]);
	};

	const startSync = async (
		profileIds: string[],
		masterProfileId: string,
	) => {
		try {
			const slaveIds = profileIds.filter((profileId) => profileId !== masterProfileId);
			await syncManagerStore.getState().startSync(masterProfileId, slaveIds);
			await refreshAll();
			toast.success(t('syncActions.syncStarted'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('syncActions.syncStartFailed', { message }));
			throw error;
		}
	};

	const stopSync = async () => {
		try {
			await syncManagerStore.getState().stopSync();
			await refreshAll();
			toast.success(t('syncActions.syncStopped'));
		} catch (error) {
			toast.error(t('syncActions.syncStopFailed'));
			throw error;
		}
	};

	const restartSync = async () => {
		try {
			await syncManagerStore.getState().restartSync();
			await refreshAll();
			toast.success(t('syncActions.syncRestarted'));
		} catch (error) {
			toast.error(t('syncActions.syncRestartFailed'));
			throw error;
		}
	};

	const sendSyncText = async (text: string) => {
		try {
			const slaveIds = syncManagerStore.getState().sessionPayload?.session?.slaveIds ?? [];
			if (slaveIds.length === 0) {
				throw new Error(t('syncActions.noSlaveForText'));
			}
			const result = await broadcastSyncText(slaveIds, text);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(t('syncActions.textSyncResult', { success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('syncActions.textSyncResultShort', { success: result.successCount, total: result.total }));
			}
		} catch (error) {
			toast.error(t('syncActions.textSyncFailed'));
			throw error;
		}
	};

	const restoreWindows = async (profileIds: string[]) => {
		try {
			const result = await batchRestoreProfileWindows(profileIds);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(t('syncActions.showWindowResult', { success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('syncActions.showWindowResultShort', { success: result.successCount, total: result.total }));
			}
		} catch (error) {
			toast.error(t('syncActions.showWindowFailed'));
			throw error;
		}
	};

	const applyUniformBounds = async (profileIds: string[], bounds: WindowBoundsItem) => {
		try {
			const result = await batchSetProfileWindowBounds(profileIds, bounds);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(t('syncActions.uniformSizeResult', { success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('syncActions.uniformSizeResultShort', { success: result.successCount, total: result.total }));
			}
		} catch (error) {
			toast.error(t('syncActions.uniformSizeFailed'));
			throw error;
		}
	};

	const arrangeWindows = async (payload: ArrangeWindowsPayload) => {
		try {
			const result = await arrangeProfileWindows(payload);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(t('syncActions.arrangeResult', { success: result.successCount, fail: result.failedCount }));
			} else {
				toast.success(t('syncActions.arrangeResultShort', { success: result.successCount, total: result.total }));
			}
		} catch (error) {
			toast.error(t('syncActions.arrangeFailed'));
			throw error;
		}
	};

	return {
		startSync,
		stopSync,
		restartSync,
		sendSyncText,
		restoreWindows,
		applyUniformBounds,
		arrangeWindows,
	};
}
