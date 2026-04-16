import { toast } from 'sonner';
import i18n from '@/shared/i18n';

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
		const toastId = toast.loading(i18n.t('resource:downloadingBrowser'));
		let lastShownPercent = -1;
		setResourceProgress({
			resourceId,
			stage: 'start',
			percent: 0,
			downloadedBytes: 0,
			totalBytes: null,
			message: i18n.t('resource:startDownloadResource'),
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
						toast.loading(i18n.t('resource:browserDownloadingPercent', { percent }), { id: toastId });
					} else {
						toast.loading(i18n.t('resource:browserDownloading'), { id: toastId });
					}
					return;
				}
				if (progress.stage === 'install') {
					toast.loading(i18n.t('resource:browserInstalling'), { id: toastId });
					return;
				}
				if (progress.stage === 'error') {
					toast.error(progress.message || i18n.t('resource:browserInstallFailed'), { id: toastId });
				}
			});
			await refreshResources();
			setResourceProgress((prev) => (prev ? { ...prev, stage: 'done', percent: 100 } : prev));
			toast.success(i18n.t('resource:browserInstalled'), { id: toastId });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : i18n.t('resource:installFailed');
			setResourceProgress((prev) =>
				prev
					? {
							...prev,
							stage: 'error',
							message: errorMessage,
						}
					: prev,
			);
			toast.error(errorMessage, { id: toastId });
			throw error;
		}
	};

	const activateChromium = async (version: string) => {
		try {
			await activateChromiumVersionApi(version);
			await refreshResources();
			toast.success(i18n.t('resource:switchedChromium', { version }));
		} catch (error) {
			toast.error(i18n.t('resource:switchVersionFailed'));
			throw error;
		}
	};

	const downloadResource = async (resourceId: string, label = '资源') => {
		const toastId = toast.loading(i18n.t('resource:startDownloadLabel', { label }));
		setResourceProgress({
			resourceId,
			stage: 'start',
			percent: 0,
			downloadedBytes: 0,
			totalBytes: null,
			message: i18n.t('resource:startDownloadResource'),
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
					const percent = progress.percent === null ? null : Math.floor(progress.percent);
					if (percent === null) {
						toast.loading(i18n.t('resource:downloadingLabel', { label }), { id: toastId });
					} else {
						toast.loading(i18n.t('resource:downloadingLabelPercent', { label, percent }), { id: toastId });
					}
				}
			});
			await refreshResources();
			setResourceProgress((prev) => (prev ? { ...prev, stage: 'done', percent: 100 } : prev));
			toast.success(i18n.t('resource:labelDownloaded', { label }), { id: toastId });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : i18n.t('resource:downloadFailed');
			setResourceProgress((prev) =>
				prev
					? {
							...prev,
							stage: 'error',
							message: errorMessage,
						}
					: prev,
			);
			toast.error(errorMessage, { id: toastId });
			throw error;
		}
	};

	return {
		installChromium,
		activateChromium,
		downloadResource,
	};
}
