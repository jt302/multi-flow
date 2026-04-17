import { useEffect } from 'react';

import {
	getActiveResourceDownloads,
	listenAllResourceProgress,
} from '@/entities/resource/api/resource-api';
import { useResourceDownloadStore } from '@/store/resource-download-store';

export function ResourceDownloadListener() {
	useEffect(() => {
		let mounted = true;
		let unlisten: (() => void) | null = null;

		void (async () => {
			try {
				const active = await getActiveResourceDownloads();
				if (!mounted) return;
				useResourceDownloadStore.getState().hydrate(
					active.map((snapshot) => ({
						taskId: snapshot.taskId,
						resourceId: snapshot.resourceId,
						stage: snapshot.stage,
						percent: snapshot.percent,
						downloadedBytes: snapshot.downloadedBytes,
						totalBytes: snapshot.totalBytes,
						message: snapshot.message,
						updatedAt: snapshot.updatedAt ?? Date.now(),
					})),
				);
			} catch {
				// 后端尚未就绪时忽略；下一轮事件会自动补齐
			}

			unlisten = await listenAllResourceProgress((payload) => {
				const store = useResourceDownloadStore.getState();
				if (payload.stage === 'done' || payload.stage === 'error') {
					store.remove(payload.resourceId);
					return;
				}
				store.upsert({
					taskId: payload.taskId,
					resourceId: payload.resourceId,
					stage: payload.stage,
					percent: payload.percent,
					downloadedBytes: payload.downloadedBytes,
					totalBytes: payload.totalBytes,
					message: payload.message,
					updatedAt: Date.now(),
				});
			});
		})();

		return () => {
			mounted = false;
			unlisten?.();
		};
	}, []);

	return null;
}
