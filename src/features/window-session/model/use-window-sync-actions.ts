import { toast } from 'sonner';

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
			toast.success('窗口同步已启动');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`启动窗口同步失败：${message}`);
			throw error;
		}
	};

	const stopSync = async () => {
		try {
			await syncManagerStore.getState().stopSync();
			await refreshAll();
			toast.success('窗口同步已停止');
		} catch (error) {
			toast.error('停止窗口同步失败');
			throw error;
		}
	};

	const restartSync = async () => {
		try {
			await syncManagerStore.getState().restartSync();
			await refreshAll();
			toast.success('窗口同步已重启');
		} catch (error) {
			toast.error('重启窗口同步失败');
			throw error;
		}
	};

	const sendSyncText = async (text: string) => {
		try {
			const slaveIds = syncManagerStore.getState().sessionPayload?.session?.slaveIds ?? [];
			if (slaveIds.length === 0) {
				throw new Error('当前没有可接收文本的从控环境');
			}
			const result = await broadcastSyncText(slaveIds, text);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(`文本同步完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`文本同步完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('同步文本输入失败');
			throw error;
		}
	};

	const restoreWindows = async (profileIds: string[]) => {
		try {
			const result = await batchRestoreProfileWindows(profileIds);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(`显示窗口完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`显示窗口完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('显示窗口失败');
			throw error;
		}
	};

	const applyUniformBounds = async (profileIds: string[], bounds: WindowBoundsItem) => {
		try {
			const result = await batchSetProfileWindowBounds(profileIds, bounds);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(`统一大小完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`统一大小完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('统一设置窗口大小失败');
			throw error;
		}
	};

	const arrangeWindows = async (payload: ArrangeWindowsPayload) => {
		try {
			const result = await arrangeProfileWindows(payload);
			await refreshAll();
			if (result.failedCount > 0) {
				toast.warning(`窗口排列完成：成功 ${result.successCount}，失败 ${result.failedCount}`);
			} else {
				toast.success(`窗口排列完成：${result.successCount}/${result.total}`);
			}
		} catch (error) {
			toast.error('窗口排列失败');
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
