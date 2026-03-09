import { toast } from 'sonner';

import {
	activateChromiumVersion as activateChromiumVersionApi,
	downloadResourceWithProgress,
	installChromiumResourceWithProgress,
} from '@/entities/resource/api/resource-api';
import type { ResourceProgressState } from '@/entities/resource/model/types';

type ResourceActionsDeps = {
	setResourceProgress: (
		state:
			| ResourceProgressState
			| null
			| ((prev: ResourceProgressState | null) => ResourceProgressState | null),
	) => void;
	refreshResources: () => Promise<void>;
};

export function useResourceActions({
	setResourceProgress,
	refreshResources,
}: ResourceActionsDeps) {
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
					? {
							...prev,
							stage: 'error',
							message: error instanceof Error ? error.message : '安装失败',
						}
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

	const downloadResource = async (resourceId: string, label = '资源') => {
		const toastId = toast.loading(`开始下载${label}...`);
		setResourceProgress({
			resourceId,
			stage: 'start',
			percent: 0,
			downloadedBytes: 0,
			totalBytes: null,
			message: '开始下载资源',
		});
		try {
			await downloadResourceWithProgress(resourceId, (progress) => {
				setResourceProgress({
					resourceId,
					stage: progress.stage,
					percent: progress.percent,
					downloadedBytes: progress.downloadedBytes,
					totalBytes: progress.totalBytes,
					message: progress.message,
				});
				if (progress.stage === 'download') {
					toast.loading(
						progress.percent === null
							? `${label}下载中...`
							: `${label}下载中 ${Math.floor(progress.percent)}%`,
						{ id: toastId },
					);
				}
			});
			await refreshResources();
			setResourceProgress((prev) => (prev ? { ...prev, stage: 'done', percent: 100 } : prev));
			toast.success(`${label}已下载`, { id: toastId });
		} catch (error) {
			setResourceProgress((prev) =>
				prev
					? {
							...prev,
							stage: 'error',
							message: error instanceof Error ? error.message : '下载失败',
						}
					: prev,
			);
			toast.error(`${label}下载失败`, { id: toastId });
			throw error;
		}
	};

	return {
		installChromium,
		activateChromium,
		downloadResource,
	};
}
