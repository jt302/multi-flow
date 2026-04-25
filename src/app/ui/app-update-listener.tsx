import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from '@/components/ui';
import {
	checkAppUpdate,
	installAppUpdate,
	listenAppUpdateProgress,
	type AppUpdateInfo,
	type AppUpdateProgressEvent,
} from '@/entities/app-update/api/app-update-api';

const AUTO_CHECK_KEY = 'mf_app_update_auto_checked';

function progressPercent(progress: AppUpdateProgressEvent | null): number | null {
	if (!progress?.total || progress.total <= 0) return null;
	return Math.min(100, Math.round((progress.downloaded / progress.total) * 100));
}

export function AppUpdateListener() {
	const { t } = useTranslation('settings');
	const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
	const [progress, setProgress] = useState<AppUpdateProgressEvent | null>(null);
	const [installing, setInstalling] = useState(false);

	useEffect(() => {
		if (import.meta.env.DEV || sessionStorage.getItem(AUTO_CHECK_KEY) === '1') {
			return;
		}
		sessionStorage.setItem(AUTO_CHECK_KEY, '1');
		void checkAppUpdate()
			.then((nextUpdate) => {
				if (nextUpdate) setUpdate(nextUpdate);
			})
			.catch(() => {
				// 自动检查失败不打扰用户；设置页可手动重试。
			});
	}, []);

	useEffect(() => {
		let unlisten: (() => void) | null = null;
		void listenAppUpdateProgress((payload) => {
			setProgress(payload);
		}).then((dispose) => {
			unlisten = dispose;
		});
		return () => {
			unlisten?.();
		};
	}, []);

	const percent = useMemo(() => progressPercent(progress), [progress]);

	const install = async () => {
		setInstalling(true);
		setProgress({ phase: 'checking', downloaded: 0, total: null });
		try {
			await installAppUpdate();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('appUpdate.installFailed', { error: message }));
			setInstalling(false);
		}
	};

	return (
		<AlertDialog open={!!update} onOpenChange={(open) => !open && !installing && setUpdate(null)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('appUpdate.foundTitle', { version: update?.version })}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('appUpdate.foundDesc', { currentVersion: update?.currentVersion })}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="space-y-3 text-sm">
					{update?.date && (
						<p className="text-xs text-muted-foreground">
							{t('appUpdate.date', { date: update.date })}
						</p>
					)}
					{update?.body && (
						<div className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 whitespace-pre-wrap">
							{update.body}
						</div>
					)}
					{installing && (
						<p className="text-xs text-muted-foreground">
							{percent === null
								? t('appUpdate.downloadUnknown')
								: t('appUpdate.downloadProgress', { percent })}
						</p>
					)}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={installing}>{t('appUpdate.cancel')}</AlertDialogCancel>
					<Button type="button" onClick={install} disabled={installing}>
						{installing ? t('appUpdate.installing') : t('appUpdate.install')}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
