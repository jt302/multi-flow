import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	getActivePluginDownloads,
	listenAllPluginProgress,
	type PluginDownloadProgressEvent,
} from '@/entities/plugin/api/plugins-api';
import { usePluginDownloadStore } from '@/store/plugin-download-store';
import { queryKeys } from '@/shared/config/query-keys';
import i18n from '@/shared/i18n';

function formatPluginProgressMessage(payload: PluginDownloadProgressEvent) {
	if (payload.stage === 'download') {
		const percent =
			payload.percent === null ? null : Math.floor(payload.percent);
		return percent === null
			? i18n.t('plugin:toast.downloadProgress')
			: i18n.t('plugin:toast.downloadProgressPercent', { percent });
	}
	if (payload.stage === 'process') {
		return i18n.t('plugin:toast.downloadProcessing');
	}
	return i18n.t('plugin:toast.downloadStarting');
}

export function PluginDownloadListener() {
	const queryClient = useQueryClient();
	const toastIdsRef = useRef<Record<string, string | number>>({});

	useEffect(() => {
		let mounted = true;
		let unlisten: (() => void) | null = null;

		const handleProgress = (payload: PluginDownloadProgressEvent) => {
			const store = usePluginDownloadStore.getState();

			if (payload.stage === 'done') {
				store.remove(payload.extensionId);
				const toastId = toastIdsRef.current[payload.taskId];
				if (toastId) {
					toast.dismiss(toastId);
				}
				delete toastIdsRef.current[payload.taskId];
				void queryClient.invalidateQueries({ queryKey: queryKeys.pluginPackages });
				void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
				return;
			}

			if (payload.stage === 'error') {
				store.remove(payload.extensionId);
				const toastId = toastIdsRef.current[payload.taskId];
				toast.error(
					payload.message || i18n.t('plugin:toast.downloadFailed'),
					{ id: toastId },
				);
				delete toastIdsRef.current[payload.taskId];
				return;
			}

			store.upsert({
				...payload,
				updatedAt: payload.updatedAt ?? Date.now(),
			});
			const message = formatPluginProgressMessage(payload);
			const toastId = toastIdsRef.current[payload.taskId];
			const nextToastId = toast.loading(message, toastId ? { id: toastId } : undefined);
			toastIdsRef.current[payload.taskId] = nextToastId;
		};

		void (async () => {
			try {
				const active = await getActivePluginDownloads();
				if (!mounted) return;
				usePluginDownloadStore.getState().hydrate(
					active.map((snapshot) => ({
						...snapshot,
						updatedAt: snapshot.updatedAt ?? Date.now(),
					})),
				);
				for (const snapshot of active) {
					handleProgress(snapshot);
				}
			} catch {
				// 后端尚未就绪时忽略；下一轮事件会自动补齐
			}

			unlisten = await listenAllPluginProgress(handleProgress);
		})();

		return () => {
			mounted = false;
			unlisten?.();
		};
	}, [queryClient]);

	return null;
}
