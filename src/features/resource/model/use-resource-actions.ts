import { toast } from 'sonner';
import {
	activateChromiumVersion as activateChromiumVersionApi,
	downloadResourceWithProgress,
	type InstallChromiumOptions,
	installChromiumResourceWithProgress,
} from '@/entities/resource/api/resource-api';
import i18n from '@/shared/i18n';

type ResourceActionsDeps = {
	refreshResources: () => Promise<void>;
};

/**
 * 资源下载/安装 action。
 *
 * 进度状态的持久化由全局 `useResourceDownloadStore` 负责（见
 * `ResourceDownloadListener`），本 hook 只负责：
 *  1. 触发 tauri 命令；
 *  2. 维护本次调用的 sonner toast 生命周期（开始 / 进度文案 / 完成 / 失败）。
 *
 * 这样切页面 / webview 刷新都不会丢进度 UI —— 顶部 toast 与卡片内的进度条
 * 分别由当前活跃的 action 调用 / 持久 store 驱动，互不耦合。
 */
export function useResourceActions({ refreshResources }: ResourceActionsDeps) {
	const installChromium = async (resourceId: string, options: InstallChromiumOptions = {}) => {
		const force = options.force ?? false;
		const toastId = toast.loading(
			i18n.t(force ? 'resource:redownloadingBrowser' : 'resource:downloadingBrowser'),
		);
		let lastShownPercent = -1;
		try {
			await installChromiumResourceWithProgress(
				resourceId,
				(progress) => {
					if (progress.stage === 'download') {
						const percent = progress.percent === null ? null : Math.floor(progress.percent);
						if (percent !== null && percent <= lastShownPercent) {
							return;
						}
						if (percent !== null) {
							lastShownPercent = percent;
							toast.loading(i18n.t('resource:browserDownloadingPercent', { percent }), {
								id: toastId,
							});
						} else {
							toast.loading(i18n.t('resource:browserDownloading'), {
								id: toastId,
							});
						}
						return;
					}
					if (progress.stage === 'install') {
						toast.loading(i18n.t('resource:browserInstalling'), { id: toastId });
						return;
					}
					if (progress.stage === 'error') {
						toast.error(progress.message || i18n.t('resource:browserInstallFailed'), {
							id: toastId,
						});
					}
				},
				{ force },
			);
			await refreshResources();
			toast.success(i18n.t(force ? 'resource:browserRedownloaded' : 'resource:browserInstalled'), {
				id: toastId,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : i18n.t('resource:installFailed');
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
		try {
			await downloadResourceWithProgress(resourceId, (progress) => {
				if (progress.stage === 'download') {
					const percent = progress.percent === null ? null : Math.floor(progress.percent);
					if (percent === null) {
						toast.loading(i18n.t('resource:downloadingLabel', { label }), {
							id: toastId,
						});
					} else {
						toast.loading(i18n.t('resource:downloadingLabelPercent', { label, percent }), {
							id: toastId,
						});
					}
				}
			});
			await refreshResources();
			toast.success(i18n.t('resource:labelDownloaded', { label }), {
				id: toastId,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : i18n.t('resource:downloadFailed');
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
